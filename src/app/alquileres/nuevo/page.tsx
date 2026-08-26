"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import PageHeader from "@/components/ui/PageHeader";
import Button from "@/components/ui/Button";
import { getClientes } from "@/lib/clientes/storage";
import { getProductos } from "@/lib/inventario/storage";
import { saveAlquiler } from "@/lib/alquileres/storage";
import type { Cliente } from "@/lib/clientes/types";
import type { Producto } from "@/lib/inventario/types";
import type { UnidadAlquiler } from "@/lib/alquileres/types";

interface ItemDraft {
  producto_id: string;
  producto_nombre: string;
  cantidad: number;
  unidad: UnidadAlquiler;
  cantidad_unidades: number;
  tarifa_unitaria: number;
}

function nombreCliente(c: Cliente): string {
  return c.tipo_cliente === "empresa" && c.empresa ? c.empresa : c.nombre_contacto;
}

function fmtMoney(n: number) {
  return `€ ${n.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const inputClass =
  "rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#0EA5E9]";

export default function NuevoAlquilerPage() {
  const router = useRouter();
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [productos, setProductos] = useState<Producto[]>([]);
  const [clienteId, setClienteId] = useState("");
  const [fechaInicio, setFechaInicio] = useState("");
  const [fechaFin, setFechaFin] = useState("");
  const [observaciones, setObservaciones] = useState("");
  const [items, setItems] = useState<ItemDraft[]>([]);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancel = false;
    Promise.all([getClientes(), getProductos()]).then(([cs, ps]) => {
      if (cancel) return;
      setClientes(cs);
      setProductos(ps);
    });
    return () => {
      cancel = true;
    };
  }, []);

  const addItem = () => {
    setItems((prev) => [
      ...prev,
      {
        producto_id: "",
        producto_nombre: "",
        cantidad: 1,
        unidad: "dia",
        cantidad_unidades: 1,
        tarifa_unitaria: 0,
      },
    ]);
  };

  const removeItem = (idx: number) => {
    setItems((prev) => prev.filter((_, i) => i !== idx));
  };

  const updateItem = (idx: number, patch: Partial<ItemDraft>) => {
    setItems((prev) =>
      prev.map((it, i) => {
        if (i !== idx) return it;
        const merged = { ...it, ...patch };
        if (patch.producto_id !== undefined) {
          const p = productos.find((x) => x.id === patch.producto_id);
          if (p) {
            merged.producto_nombre = p.nombre;
            merged.tarifa_unitaria =
              merged.unidad === "hora"
                ? p.tarifa_alquiler_hora ?? 0
                : p.tarifa_alquiler_dia ?? 0;
          }
        }
        if (patch.unidad !== undefined && merged.producto_id) {
          const p = productos.find((x) => x.id === merged.producto_id);
          if (p) {
            merged.tarifa_unitaria =
              patch.unidad === "hora"
                ? p.tarifa_alquiler_hora ?? 0
                : p.tarifa_alquiler_dia ?? 0;
          }
        }
        return merged;
      })
    );
  };

  const total = useMemo(
    () =>
      items.reduce(
        (acc, it) => acc + it.cantidad * it.cantidad_unidades * it.tarifa_unitaria,
        0
      ),
    [items]
  );

  const onGuardar = async () => {
    setError(null);
    if (!clienteId) return setError("Elegí un cliente.");
    if (!fechaInicio || !fechaFin) return setError("Faltan las fechas.");
    if (items.length === 0) return setError("Agregá al menos un producto.");
    for (const it of items) {
      if (!it.producto_id) return setError("Hay líneas sin producto.");
      if (it.cantidad <= 0) return setError("La cantidad debe ser mayor a 0.");
      if (it.cantidad_unidades <= 0) return setError("La duración debe ser mayor a 0.");
    }
    setGuardando(true);
    const res = await saveAlquiler({
      cliente_id: clienteId,
      fecha_inicio: new Date(fechaInicio).toISOString(),
      fecha_fin: new Date(fechaFin).toISOString(),
      observaciones: observaciones || null,
      items,
    });
    setGuardando(false);
    if (!res.success) {
      setError(res.error);
      return;
    }
    router.push(`/alquileres/${res.alquiler.id}`);
  };

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-8 lg:px-8">
      <div className="mx-auto max-w-5xl">
        <PageHeader
          eyebrow="NCG · Eventos"
          title="Nuevo alquiler"
          description="Registrá un contrato de alquiler: cliente, fechas e insumos."
          backHref="/alquileres"
        />

        <div className="mt-6 grid grid-cols-1 gap-4 rounded-2xl border border-slate-200 bg-gradient-to-b from-white to-slate-50/40 p-5 shadow-sm md:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-slate-700">Cliente</span>
            <select
              value={clienteId}
              onChange={(e) => setClienteId(e.target.value)}
              className={inputClass}
            >
              <option value="">Seleccionar…</option>
              {clientes.map((c) => (
                <option key={c.id} value={c.id}>
                  {nombreCliente(c)}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1 text-sm md:col-span-1">
            <span className="font-medium text-slate-700">Observaciones</span>
            <input
              type="text"
              value={observaciones}
              onChange={(e) => setObservaciones(e.target.value)}
              className={inputClass}
              placeholder="(opcional)"
            />
          </label>

          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-slate-700">Fecha inicio</span>
            <input
              type="datetime-local"
              value={fechaInicio}
              onChange={(e) => setFechaInicio(e.target.value)}
              className={inputClass}
            />
          </label>

          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-slate-700">Fecha fin</span>
            <input
              type="datetime-local"
              value={fechaFin}
              onChange={(e) => setFechaFin(e.target.value)}
              className={inputClass}
            />
          </label>
        </div>

        <div className="mt-6 rounded-2xl border border-slate-200 bg-gradient-to-b from-white to-slate-50/40 p-5 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500">
              Insumos a alquilar
            </h2>
            <Button variant="secondary" size="sm" onClick={addItem}>
              + Agregar línea
            </Button>
          </div>

          {items.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-400">
              Sin líneas. Agregá al menos un producto.
            </p>
          ) : (
            <div className="space-y-3">
              {items.map((it, idx) => {
                const subtotal = it.cantidad * it.cantidad_unidades * it.tarifa_unitaria;
                return (
                  <div
                    key={idx}
                    className="grid grid-cols-1 gap-2 rounded-lg border border-slate-100 bg-slate-50 p-3 md:grid-cols-12 md:items-end"
                  >
                    <label className="md:col-span-4 flex flex-col gap-1 text-xs">
                      <span className="font-medium text-slate-600">Producto</span>
                      <select
                        value={it.producto_id}
                        onChange={(e) => updateItem(idx, { producto_id: e.target.value })}
                        className={inputClass}
                      >
                        <option value="">Seleccionar…</option>
                        {productos.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.nombre}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="md:col-span-1 flex flex-col gap-1 text-xs">
                      <span className="font-medium text-slate-600">Cantidad</span>
                      <input
                        type="number"
                        min={1}
                        value={it.cantidad}
                        onChange={(e) =>
                          updateItem(idx, { cantidad: Number(e.target.value) || 0 })
                        }
                        className={inputClass}
                      />
                    </label>
                    <label className="md:col-span-2 flex flex-col gap-1 text-xs">
                      <span className="font-medium text-slate-600">Unidad</span>
                      <select
                        value={it.unidad}
                        onChange={(e) =>
                          updateItem(idx, { unidad: e.target.value as UnidadAlquiler })
                        }
                        className={inputClass}
                      >
                        <option value="dia">Día</option>
                        <option value="hora">Hora</option>
                      </select>
                    </label>
                    <label className="md:col-span-1 flex flex-col gap-1 text-xs">
                      <span className="font-medium text-slate-600">
                        {it.unidad === "hora" ? "Horas" : "Días"}
                      </span>
                      <input
                        type="number"
                        min={1}
                        value={it.cantidad_unidades}
                        onChange={(e) =>
                          updateItem(idx, { cantidad_unidades: Number(e.target.value) || 0 })
                        }
                        className={inputClass}
                      />
                    </label>
                    <label className="md:col-span-2 flex flex-col gap-1 text-xs">
                      <span className="font-medium text-slate-600">Tarifa</span>
                      <input
                        type="number"
                        min={0}
                        value={it.tarifa_unitaria}
                        onChange={(e) =>
                          updateItem(idx, { tarifa_unitaria: Number(e.target.value) || 0 })
                        }
                        className={inputClass}
                      />
                    </label>
                    <div className="md:col-span-2 flex items-center justify-between md:flex-col md:items-end md:gap-1">
                      <span className="text-xs font-medium text-slate-600">Subtotal</span>
                      <span className="text-sm font-semibold text-slate-800">
                        {fmtMoney(subtotal)}
                      </span>
                      <button
                        type="button"
                        onClick={() => removeItem(idx)}
                        className="text-xs text-red-600 hover:underline"
                      >
                        Quitar
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="mt-4 flex items-center justify-end gap-3 border-t border-slate-100 pt-4">
            <span className="text-sm text-slate-500">Total</span>
            <span className="text-xl font-bold text-slate-800">{fmtMoney(total)}</span>
          </div>
        </div>

        {error ? (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        <div className="mt-6 flex justify-end gap-2">
          <Button variant="secondary" href="/alquileres">
            Cancelar
          </Button>
          <Button variant="primary" onClick={onGuardar} disabled={guardando}>
            {guardando ? "Guardando…" : "Guardar alquiler"}
          </Button>
        </div>
      </div>
    </div>
  );
}
