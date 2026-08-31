"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import MontoInput from "@/components/ui/MontoInput";
import PageHeader from "@/components/ui/PageHeader";
import { getProductos } from "@/lib/inventario/storage";
import { fetchWithSupabaseSession } from "@/lib/api/fetch-with-supabase-session";
import type { Producto, TipoMovimiento, OrigenMovimiento } from "@/lib/inventario/types";

type EventoLite = { id: string; titulo: string };

export default function EditarMovimientoPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const movId = params?.id ?? "";

  const [productos, setProductos] = useState<Producto[]>([]);
  const [eventos, setEventos] = useState<EventoLite[]>([]);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    producto_id: "",
    tipo: "ENTRADA" as TipoMovimiento,
    cantidad: "",
    costo_unitario: "",
    origen: "ajuste_manual" as OrigenMovimiento,
    proyecto_id: "",
  });

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      getProductos(),
      fetch("/api/eventos", { credentials: "include", cache: "no-store" }).then((r) => r.json()).catch(() => ({})),
      fetchWithSupabaseSession(`/api/inventario/movimientos/${movId}`).then((r) => r.json()).catch(() => ({})),
    ]).then(([prods, evJ, movJ]) => {
      if (cancelled) return;
      setProductos(prods);
      const arr = (evJ as { data?: { eventos?: { id: string; titulo: string }[] } })?.data?.eventos ?? [];
      setEventos(arr.map((e) => ({ id: e.id, titulo: e.titulo })));
      const mov = (movJ as { data?: { movimiento?: Record<string, unknown> } })?.data?.movimiento;
      if (mov) {
        setForm({
          producto_id: String(mov.producto_id ?? ""),
          tipo: (mov.tipo as TipoMovimiento) ?? "ENTRADA",
          cantidad: String(mov.cantidad ?? ""),
          costo_unitario: String(mov.costo_unitario ?? ""),
          origen: (mov.origen as OrigenMovimiento) ?? "ajuste_manual",
          proyecto_id: String(mov.proyecto_id ?? ""),
        });
      } else {
        setError("Movimiento no encontrado.");
      }
      setCargando(false);
    });
    return () => { cancelled = true; };
  }, [movId]);

  const productoSel = productos.find((p) => p.id === form.producto_id);

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }
  function handleTipoChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const tipo = e.target.value as TipoMovimiento;
    setForm((prev) => ({ ...prev, tipo }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const rawCant = parseFloat(form.cantidad);
    if (!Number.isFinite(rawCant) || rawCant === 0) {
      setError("La cantidad no puede quedar vacía ni ser 0.");
      return;
    }
    setGuardando(true);
    try {
      const r = await fetchWithSupabaseSession(`/api/inventario/movimientos/${movId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tipo: form.tipo,
          cantidad: rawCant,
          costo_unitario: parseFloat(form.costo_unitario) || 0,
          origen: form.origen,
          proyecto_id: form.proyecto_id || null,
        }),
      });
      const j = (await r.json().catch(() => ({}))) as { success?: boolean; error?: string };
      if (r.ok && j.success) {
        router.push("/inventario/movimientos");
      } else {
        setError(j.error ?? `Error ${r.status}: no se pudo guardar.`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado.");
    } finally {
      setGuardando(false);
    }
  }

  const inputClass = "w-full border border-gray-300 rounded-lg px-4 py-3 outline-none focus:border-gray-500 transition-colors text-sm";
  const labelClass = "block text-sm font-medium text-gray-700 mb-2";

  if (cargando) {
    return (
      <div className="space-y-8">
        <PageHeader eyebrow="NCG · Stock" title="Editar movimiento" backHref="/inventario/movimientos" backLabel="Movimientos" />
        <p className="text-sm text-slate-400">Cargando…</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <PageHeader eyebrow="NCG · Stock" title="Editar movimiento" description="Modificá los datos del movimiento. Al guardar se recalcula el stock automáticamente." backHref="/inventario/movimientos" backLabel="Movimientos" />

      <div className="bg-white rounded-xl shadow-sm ring-1 ring-[#4FAEB2]/10 border border-slate-200 p-6 max-w-2xl">
        <form className="space-y-6" onSubmit={handleSubmit}>
          <div>
            <label className={labelClass}>Producto</label>
            <input value={productoSel ? `${productoSel.nombre} — ${productoSel.sku}` : "—"} readOnly className={`${inputClass} bg-slate-50 text-slate-500`} />
            <p className="mt-1 text-xs text-slate-400">El producto no se puede cambiar. Si te equivocaste de producto, eliminá y creá un movimiento nuevo.</p>
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div>
              <label className={labelClass}>Tipo de movimiento</label>
              <select name="tipo" value={form.tipo} onChange={handleTipoChange} className={inputClass}>
                <option value="ENTRADA">ENTRADA — aumenta stock</option>
                <option value="SALIDA">SALIDA — disminuye stock</option>
                <option value="AJUSTE">AJUSTE — corrección manual</option>
              </select>
            </div>
            <div>
              <label className={labelClass}>Origen</label>
              <select name="origen" value={form.origen} onChange={handleChange} className={inputClass}>
                <option value="compra">Compra</option>
                <option value="venta">Venta</option>
                <option value="ajuste_manual">Ajuste manual</option>
              </select>
            </div>
          </div>

          <div>
            <label className={labelClass}>Evento</label>
            <select name="proyecto_id" value={form.proyecto_id} onChange={handleChange} className={inputClass}>
              <option value="">Sin evento asociado</option>
              {eventos.map((p) => (<option key={p.id} value={p.id}>{p.titulo}</option>))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div>
              <label className={labelClass}>Cantidad {form.tipo === "AJUSTE" && (<span className="ml-2 text-xs text-gray-400 font-normal">(negativo para disminuir)</span>)}</label>
              <input type="number" name="cantidad" value={form.cantidad} onChange={handleChange} placeholder={form.tipo === "AJUSTE" ? "Ej: -3 o +5" : "Ej: 10"} className={inputClass} step="1" required />
            </div>
            <div>
              <label className={labelClass}>Costo unitario (€)</label>
              <MontoInput value={form.costo_unitario} onChange={(n) => setForm((prev) => ({ ...prev, costo_unitario: String(n) }))} className={inputClass} decimals required />
            </div>
          </div>

          {error && (<div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>)}

          <div className="flex gap-4 pt-2">
            <button type="submit" disabled={guardando} className="bg-gray-900 text-white px-5 py-3 rounded-lg text-sm hover:bg-gray-700 transition-colors disabled:opacity-60 disabled:cursor-not-allowed">
              {guardando ? "Guardando…" : "Guardar cambios"}
            </button>
            <button type="button" onClick={() => router.push("/inventario/movimientos")} disabled={guardando} className="border border-gray-300 px-5 py-3 rounded-lg text-sm hover:bg-gray-50 transition-colors disabled:opacity-60">Cancelar</button>
          </div>
        </form>
      </div>
    </div>
  );
}
