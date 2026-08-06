"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import PageHeader from "@/components/ui/PageHeader";
import Button from "@/components/ui/Button";
import { getPaquetes, getServicios, savePaquete } from "@/lib/eventos/storage";
import type { Paquete, ServicioCatalogo } from "@/lib/eventos/types";

interface ItemDraft {
  servicio_id: string;
  cantidad: number;
  precio_unitario: number;
}

const inputClass =
  "rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#0EA5E9]";

export default function PaquetesPage() {
  const [lista, setLista] = useState<Paquete[]>([]);
  const [servicios, setServicios] = useState<ServicioCatalogo[]>([]);
  const [cargando, setCargando] = useState(true);
  const [nombre, setNombre] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [items, setItems] = useState<ItemDraft[]>([]);
  const [modo, setModo] = useState<"lista" | "nuevo">("lista");

  const cargar = async () => {
    setCargando(true);
    const [ps, ss] = await Promise.all([getPaquetes(), getServicios()]);
    setLista(ps);
    setServicios(ss);
    setCargando(false);
  };

  useEffect(() => {
    cargar();
  }, []);

  const addItem = () =>
    setItems((prev) => [...prev, { servicio_id: "", cantidad: 1, precio_unitario: 0 }]);

  const totalCalc = items.reduce((s, it) => s + it.cantidad * it.precio_unitario, 0);

  const onGuardar = async () => {
    if (!nombre.trim() || items.length === 0) return;
    await savePaquete({
      nombre: nombre.trim(),
      descripcion: descripcion || null,
      items: items.filter((it) => it.servicio_id),
    });
    setNombre("");
    setDescripcion("");
    setItems([]);
    setModo("lista");
    await cargar();
  };

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-8 lg:px-8">
      <div className="mx-auto max-w-5xl">
        <PageHeader
          eyebrow="NCG · Eventos"
          title="Paquetes de eventos"
          description="Packs pre-armados de servicios (ej: 'Boda completa' = catering + decoración + música)."
          backHref="/eventos"
          actions={
            <Button
              variant="primary"
              size="sm"
              onClick={() => setModo(modo === "nuevo" ? "lista" : "nuevo")}
            >
              {modo === "nuevo" ? "Ver lista" : "+ Nuevo paquete"}
            </Button>
          }
        />

        {modo === "nuevo" ? (
          <div className="mt-6 space-y-4 rounded-xl border border-slate-200 bg-white p-5">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <input
                type="text"
                placeholder="Nombre del paquete"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                className={inputClass}
              />
              <input
                type="text"
                placeholder="Descripción (opcional)"
                value={descripcion}
                onChange={(e) => setDescripcion(e.target.value)}
                className={inputClass}
              />
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-700">Servicios incluidos</h3>
                <Button variant="secondary" size="sm" onClick={addItem}>
                  + Servicio
                </Button>
              </div>
              {items.length === 0 ? (
                <p className="rounded-lg border border-dashed border-slate-200 py-4 text-center text-xs text-slate-400">
                  Agregá al menos un servicio.
                </p>
              ) : (
                <div className="space-y-2">
                  {items.map((it, idx) => (
                    <div key={idx} className="grid grid-cols-12 gap-2">
                      <select
                        value={it.servicio_id}
                        onChange={(e) => {
                          const sv = servicios.find((s) => s.id === e.target.value);
                          setItems((prev) =>
                            prev.map((x, i) =>
                              i === idx
                                ? {
                                    ...x,
                                    servicio_id: e.target.value,
                                    precio_unitario: sv?.precio_base ?? x.precio_unitario,
                                  }
                                : x
                            )
                          );
                        }}
                        className={inputClass + " col-span-6"}
                      >
                        <option value="">Servicio…</option>
                        {servicios.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.nombre} ({s.categoria})
                          </option>
                        ))}
                      </select>
                      <input
                        type="number"
                        min={1}
                        value={it.cantidad}
                        onChange={(e) =>
                          setItems((prev) =>
                            prev.map((x, i) =>
                              i === idx ? { ...x, cantidad: parseInt(e.target.value) || 0 } : x
                            )
                          )
                        }
                        className={inputClass + " col-span-2"}
                      />
                      <input
                        type="number"
                        step="0.01"
                        value={it.precio_unitario}
                        onChange={(e) =>
                          setItems((prev) =>
                            prev.map((x, i) =>
                              i === idx
                                ? { ...x, precio_unitario: parseFloat(e.target.value) || 0 }
                                : x
                            )
                          )
                        }
                        className={inputClass + " col-span-3"}
                      />
                      <button
                        onClick={() => setItems((prev) => prev.filter((_, i) => i !== idx))}
                        className="col-span-1 text-xs text-red-600 hover:underline"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex items-center justify-between border-t border-slate-100 pt-3">
              <span className="text-sm text-slate-500">Total estimado</span>
              <span className="text-lg font-bold text-slate-800">
                € {totalCalc.toLocaleString("es-PY")}
              </span>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setModo("lista")}>
                Cancelar
              </Button>
              <Button variant="primary" onClick={onGuardar}>
                Crear paquete
              </Button>
            </div>
          </div>
        ) : (
          <div className="mt-6 overflow-x-auto rounded-xl border border-slate-200 bg-white">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-4 py-3">Nombre</th>
                  <th className="px-4 py-3">Descripción</th>
                  <th className="px-4 py-3 text-right">Precio total</th>
                  <th className="px-4 py-3">Estado</th>
                </tr>
              </thead>
              <tbody>
                {cargando ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-6 text-center text-slate-400">
                      Cargando…
                    </td>
                  </tr>
                ) : lista.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-6 text-center text-slate-400">
                      Sin paquetes.
                    </td>
                  </tr>
                ) : (
                  lista.map((p) => (
                    <tr key={p.id} className="border-t border-slate-100">
                      <td className="px-4 py-3 font-medium text-slate-800">{p.nombre}</td>
                      <td className="px-4 py-3 text-slate-600">{p.descripcion ?? "—"}</td>
                      <td className="px-4 py-3 text-right font-semibold text-slate-800">
                        € {p.precio_total.toLocaleString("es-PY")}
                      </td>
                      <td className="px-4 py-3 text-xs">{p.activo ? "activo" : "inactivo"}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
