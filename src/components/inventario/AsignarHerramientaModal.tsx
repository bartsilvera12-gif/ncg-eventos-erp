"use client";

import { useEffect, useState } from "react";
import { fetchWithSupabaseSession } from "@/lib/api/fetch-with-supabase-session";
import { parseImporte } from "@/lib/utils/money";

export interface HerramientaResumen {
  id: string;
  nombre: string;
  sku: string;
  stock_actual: number;
  cantidad_asignada: number;
  cantidad_mantenimiento: number;
  unidad_medida: string;
}

interface Props {
  herramienta: HerramientaResumen;
  onClose: () => void;
  onSaved: () => void | Promise<void>;
}

const inputCls =
  "w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#4FAEB2]/30 focus:border-[#4FAEB2]/50";
const labelCls = "block text-sm font-medium text-slate-700 mb-1.5";

function todayIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function AsignarHerramientaModal({ herramienta, onClose, onSaved }: Props) {
  const disponibles = herramienta.stock_actual - herramienta.cantidad_asignada - herramienta.cantidad_mantenimiento;

  const [cantidad, setCantidad] = useState("1");
  const [responsable, setResponsable] = useState("");
  const [proyectoId, setProyectoId] = useState("");
  const [ubicacion, setUbicacion] = useState("Depósito principal");
  const [fecha, setFecha] = useState(todayIso());
  const [fechaDevolucion, setFechaDevolucion] = useState("");
  const [observacion, setObservacion] = useState("");
  const [proyectos, setProyectos] = useState<{ id: string; titulo: string }[]>([]);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/proyectos", { credentials: "include", cache: "no-store" })
      .then((r) => r.json())
      .then((j: { success?: boolean; data?: { id: string; titulo: string }[] }) => {
        if (j.success && Array.isArray(j.data)) setProyectos(j.data.map((p) => ({ id: p.id, titulo: p.titulo })));
      })
      .catch(() => { /* tolerante */ });
  }, []);

  const cantNum = parseImporte(cantidad);
  const valida = cantNum > 0 && cantNum <= disponibles;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    if (!(cantNum > 0)) return setErr("La cantidad debe ser mayor a 0.");
    if (cantNum > disponibles) return setErr("No hay herramientas disponibles suficientes.");

    setSaving(true);
    try {
      const r = await fetchWithSupabaseSession("/api/inventario/herramientas/asignar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          producto_id: herramienta.id,
          cantidad: cantNum,
          responsable: responsable.trim() || null,
          proyecto_id: proyectoId || null,
          ubicacion_origen: ubicacion.trim() || null,
          fecha_devolucion_estimada: fechaDevolucion || null,
          observacion: observacion.trim() || null,
          fecha,
        }),
      });
      const j = (await r.json().catch(() => ({}))) as { success?: boolean; error?: string };
      if (!r.ok || !j.success) { setErr(j.error ?? "No se pudo asignar la herramienta"); return; }
      await onSaved();
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" onClick={onClose}>
      <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white px-5 py-4">
          <h2 className="text-base font-semibold text-slate-900">Asignar herramienta</h2>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-700">✕</button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5 p-5">
          {err && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{err}</div>}

          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
            <div className="text-sm font-semibold text-slate-800">{herramienta.nombre}</div>
            <div className="mt-1 grid grid-cols-3 gap-3 text-xs text-slate-600">
              <div><span className="text-slate-400">SKU:</span> {herramienta.sku || "—"}</div>
              <div><span className="text-slate-400">Disponibles:</span> <strong className="text-slate-800">{disponibles}</strong> {herramienta.unidad_medida}</div>
              <div><span className="text-slate-400">Asignadas:</span> {herramienta.cantidad_asignada}</div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className={labelCls}>Cantidad <span className="text-red-500">*</span></label>
              <input type="text" inputMode="decimal" autoComplete="off"
                value={cantidad}
                onChange={(e) => setCantidad(e.target.value.replace(/[^\d.,-]/g, ""))}
                className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Responsable</label>
              <input className={inputCls} value={responsable}
                onChange={(e) => setResponsable(e.target.value)}
                placeholder="Empleado / cuadrilla (opcional)" />
            </div>

            <div className="md:col-span-2">
              <label className={labelCls}>Obra / proyecto</label>
              <select className={inputCls} value={proyectoId} onChange={(e) => setProyectoId(e.target.value)}>
                <option value="">— Sin obra —</option>
                {proyectos.map((p) => <option key={p.id} value={p.id}>{p.titulo}</option>)}
              </select>
            </div>

            <div>
              <label className={labelCls}>Ubicación origen</label>
              <input className={inputCls} value={ubicacion} onChange={(e) => setUbicacion(e.target.value)} />
            </div>
            <div>
              <label className={labelCls}>Fecha de entrega</label>
              <input type="date" className={inputCls} value={fecha} onChange={(e) => setFecha(e.target.value)} />
            </div>

            <div>
              <label className={labelCls}>Fecha estimada de devolución</label>
              <input type="date" className={inputCls} value={fechaDevolucion}
                onChange={(e) => setFechaDevolucion(e.target.value)} />
            </div>

            <div className="md:col-span-2">
              <label className={labelCls}>Observación</label>
              <textarea className={inputCls} rows={2} value={observacion} onChange={(e) => setObservacion(e.target.value)} />
            </div>
          </div>

          <p className="text-[11px] text-slate-500">
            Esta asignación no descuenta stock ni registra gasto en la obra. Queda como movimiento <strong>ASIGNACION</strong> para historial.
          </p>

          <div className="flex justify-end gap-2 border-t border-slate-200 pt-4">
            <button type="button" onClick={onClose} className="rounded-lg border border-slate-200 px-3 py-2 text-sm">Cancelar</button>
            <button type="submit" disabled={!valida || saving}
              className="rounded-lg bg-[#4FAEB2] px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-[#3F8E91] disabled:opacity-40">
              {saving ? "Guardando…" : "Asignar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
