"use client";

import { useEffect, useState } from "react";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import {
  deleteServicio,
  getServicios,
  saveServicio,
  updateServicio,
} from "@/lib/eventos/storage";
import type { CategoriaServicio, ServicioCatalogo } from "@/lib/eventos/types";

const CATEGORIAS: CategoriaServicio[] = [
  "catering", "decoracion", "musica", "fotografia", "animacion",
  "mobiliario", "iluminacion", "seguridad", "transporte", "extra",
];
const inputClass =
  "rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#0EA5E9]";

interface FormState {
  nombre: string;
  categoria: CategoriaServicio;
  descripcion: string;
  precio_base: string;
  unidad: string;
}
const initial: FormState = {
  nombre: "",
  categoria: "extra",
  descripcion: "",
  precio_base: "",
  unidad: "unidad",
};

export default function ServiciosPanel() {
  const [lista, setLista] = useState<ServicioCatalogo[]>([]);
  const [cargando, setCargando] = useState(true);
  const [form, setForm] = useState<FormState>(initial);
  const [editando, setEditando] = useState<string | null>(null);
  const [filtro, setFiltro] = useState<CategoriaServicio | "">("");

  const cargar = async () => {
    setCargando(true);
    setLista(await getServicios(filtro || undefined));
    setCargando(false);
  };

  useEffect(() => {
    cargar();
  }, [filtro]);

  const onGuardar = async () => {
    if (!form.nombre.trim()) return;
    const payload = {
      nombre: form.nombre.trim(),
      categoria: form.categoria,
      descripcion: form.descripcion || null,
      precio_base: parseFloat(form.precio_base) || 0,
      unidad: form.unidad || "unidad",
    };
    if (editando) await updateServicio(editando, payload);
    else await saveServicio(payload);
    setForm(initial);
    setEditando(null);
    await cargar();
  };

  return (
    <div>
      <div className="grid grid-cols-1 gap-3 rounded-xl border border-slate-200 bg-white p-4 md:grid-cols-6">
        <input
          type="text"
          placeholder="Nombre"
          value={form.nombre}
          onChange={(e) => setForm((p) => ({ ...p, nombre: e.target.value }))}
          className={inputClass + " md:col-span-2"}
        />
        <select
          value={form.categoria}
          onChange={(e) =>
            setForm((p) => ({ ...p, categoria: e.target.value as CategoriaServicio }))
          }
          className={inputClass}
        >
          {CATEGORIAS.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <input
          type="number"
          step="0.01"
          placeholder="Precio (€)"
          value={form.precio_base}
          onChange={(e) => setForm((p) => ({ ...p, precio_base: e.target.value }))}
          className={inputClass}
        />
        <input
          type="text"
          placeholder="Unidad"
          value={form.unidad}
          onChange={(e) => setForm((p) => ({ ...p, unidad: e.target.value }))}
          className={inputClass}
        />
        <div className="flex justify-end gap-2">
          {editando && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                setEditando(null);
                setForm(initial);
              }}
            >
              Cancelar
            </Button>
          )}
          <Button variant="primary" size="sm" onClick={onGuardar}>
            {editando ? "Guardar" : "+ Agregar"}
          </Button>
        </div>
      </div>

      <div className="mt-4 flex justify-end">
        <select
          value={filtro}
          onChange={(e) => setFiltro(e.target.value as CategoriaServicio | "")}
          className={inputClass}
        >
          <option value="">Todas las categorías</option>
          {CATEGORIAS.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>

      <div className="mt-3 overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-gradient-to-r from-slate-50 via-teal-50/30 to-slate-50 text-left text-xs uppercase tracking-wider text-slate-600 border-b border-slate-200">
            <tr>
              <th className="px-4 py-3">Nombre</th>
              <th className="px-4 py-3">Categoría</th>
              <th className="px-4 py-3 text-right">Precio</th>
              <th className="px-4 py-3">Unidad</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {cargando ? (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-slate-400">
                  Cargando…
                </td>
              </tr>
            ) : lista.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-slate-400">
                  Sin servicios.
                </td>
              </tr>
            ) : (
              lista.map((s) => (
                <tr key={s.id} className="border-t border-slate-100">
                  <td className="px-4 py-3 font-medium text-slate-800">{s.nombre}</td>
                  <td className="px-4 py-3">
                    <Badge tone="primary">{s.categoria}</Badge>
                  </td>
                  <td className="px-4 py-3 text-right text-slate-600">
                    € {s.precio_base.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{s.unidad}</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => {
                        setEditando(s.id);
                        setForm({
                          nombre: s.nombre,
                          categoria: s.categoria,
                          descripcion: s.descripcion ?? "",
                          precio_base: String(s.precio_base),
                          unidad: s.unidad,
                        });
                      }}
                      className="mr-2 text-xs text-[#0EA5E9] hover:underline"
                    >
                      Editar
                    </button>
                    <button
                      onClick={async () => {
                        if (!confirm("¿Eliminar servicio?")) return;
                        await deleteServicio(s.id);
                        await cargar();
                      }}
                      className="text-xs text-red-600 hover:underline"
                    >
                      Eliminar
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
