"use client";

import { useState } from "react";
import { fetchWithSupabaseSession } from "@/lib/api/fetch-with-supabase-session";
import { parseImporte } from "@/lib/utils/money";
import type { HerramientaResumen } from "./AsignarHerramientaModal";

interface Props {
  herramienta: HerramientaResumen;
  onClose: () => void;
  onSaved: () => void | Promise<void>;
}

type Motivo = "rotura" | "perdida" | "robo" | "obsolescencia" | "venta_activo";
type Origen = "disponible" | "mantenimiento";

const inputCls =
  "w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#4FAEB2]/30 focus:border-[#4FAEB2]/50";
const labelCls = "block text-sm font-medium text-slate-700 mb-1.5";

const MOTIVO_OPTS: { value: Motivo; label: string }[] = [
  { value: "rotura", label: "Rotura definitiva" },
  { value: "perdida", label: "Pérdida" },
  { value: "robo", label: "Robo" },
  { value: "obsolescencia", label: "Obsolescencia" },
  { value: "venta_activo", label: "Venta de activo" },
];

function todayIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function BajaHerramientaModal({ herramienta, onClose, onSaved }: Props) {
  const disponibles = herramienta.stock_actual - herramienta.cantidad_asignada - herramienta.cantidad_mantenimiento;
  const enMant = herramienta.cantidad_mantenimiento || 0;

  const [origen, setOrigen] = useState<Origen>(enMant > 0 && disponibles <= 0 ? "mantenimiento" : "disponible");
  const [cantidad, setCantidad] = useState("1");
  const [motivo, setMotivo] = useState<Motivo>("perdida");
  const [responsable, setResponsable] = useState("");
  const [fecha, setFecha] = useState(todayIso());
  const [observacion, setObservacion] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const cantNum = parseImporte(cantidad);
  const maxOrigen = origen === "disponible" ? disponibles : enMant;
  const valida = cantNum > 0 && cantNum <= maxOrigen;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    if (!(cantNum > 0)) return setErr("La cantidad debe ser mayor a 0.");
    if (cantNum > maxOrigen) {
      return setErr(origen === "disponible"
        ? `No hay disponibles suficientes (max ${disponibles}).`
        : `No hay unidades en mantenimiento (max ${enMant}).`);
    }

    setSaving(true);
    try {
      const r = await fetchWithSupabaseSession("/api/inventario/herramientas/baja", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          producto_id: herramienta.id,
          cantidad: cantNum,
          motivo_baja: motivo,
          origen,
          responsable: responsable.trim() || null,
          observacion: observacion.trim() || null,
          fecha,
        }),
      });
      const j = (await r.json().catch(() => ({}))) as { success?: boolean; error?: string };
      if (!r.ok || !j.success) { setErr(j.error ?? "No se pudo registrar la baja"); return; }
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
          <h2 className="text-base font-semibold text-slate-900">Dar de baja herramienta</h2>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-700">✕</button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5 p-5">
          {err && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{err}</div>}

          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs">
            <div className="text-sm font-semibold text-slate-800">{herramienta.nombre}</div>
            <div className="mt-1 grid grid-cols-4 gap-3 text-slate-600">
              <div><span className="text-slate-400">Stock:</span> {herramienta.stock_actual}</div>
              <div><span className="text-slate-400">Disponibles:</span> {disponibles}</div>
              <div><span className="text-slate-400">Asignadas:</span> {herramienta.cantidad_asignada}</div>
              <div><span className="text-slate-400">En mant.:</span> {enMant}</div>
            </div>
            {herramienta.cantidad_asignada > 0 && (
              <p className="mt-2 text-[11px] text-amber-700">
                Las unidades asignadas no pueden darse de baja directamente. Primero devolvelas (o marcalas como rotas en la devolución).
              </p>
            )}
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className={labelCls}>Origen de la baja <span className="text-red-500">*</span></label>
              <select className={inputCls} value={origen} onChange={(e) => setOrigen(e.target.value as Origen)}>
                <option value="disponible">Disponible (max {disponibles})</option>
                <option value="mantenimiento" disabled={enMant <= 0}>Mantenimiento (max {enMant})</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Cantidad <span className="text-red-500">*</span></label>
              <input type="text" inputMode="decimal" autoComplete="off"
                value={cantidad}
                onChange={(e) => setCantidad(e.target.value.replace(/[^\d.,-]/g, ""))}
                className={inputCls} />
            </div>

            <div>
              <label className={labelCls}>Motivo <span className="text-red-500">*</span></label>
              <select className={inputCls} value={motivo} onChange={(e) => setMotivo(e.target.value as Motivo)}>
                {MOTIVO_OPTS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Fecha</label>
              <input type="date" className={inputCls} value={fecha} onChange={(e) => setFecha(e.target.value)} />
            </div>

            <div className="md:col-span-2">
              <label className={labelCls}>Responsable</label>
              <input className={inputCls} value={responsable} onChange={(e) => setResponsable(e.target.value)} />
            </div>
            <div className="md:col-span-2">
              <label className={labelCls}>Observación</label>
              <textarea className={inputCls} rows={2} value={observacion} onChange={(e) => setObservacion(e.target.value)} />
            </div>
          </div>

          <p className="text-[11px] text-slate-500">
            La baja descuenta del stock total. Queda como movimiento <strong>BAJA</strong> con el motivo elegido.
          </p>

          <div className="flex justify-end gap-2 border-t border-slate-200 pt-4">
            <button type="button" onClick={onClose} className="rounded-lg border border-slate-200 px-3 py-2 text-sm">Cancelar</button>
            <button type="submit" disabled={!valida || saving}
              className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-red-700 disabled:opacity-40">
              {saving ? "Guardando…" : "Dar de baja"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
