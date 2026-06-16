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

const inputCls =
  "w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#4FAEB2]/30 focus:border-[#4FAEB2]/50";
const labelCls = "block text-sm font-medium text-slate-700 mb-1.5";

function todayIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function FinalizarMantenimientoModal({ herramienta, onClose, onSaved }: Props) {
  const enMant = herramienta.cantidad_mantenimiento || 0;
  const [cantidad, setCantidad] = useState(String(Math.min(1, enMant || 0)));
  const [observacion, setObservacion] = useState("");
  const [fecha, setFecha] = useState(todayIso());
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const cantNum = parseImporte(cantidad);
  const valida = cantNum > 0 && cantNum <= enMant;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    if (!(cantNum > 0)) return setErr("La cantidad debe ser mayor a 0.");
    if (cantNum > enMant) return setErr("No hay tantas unidades en mantenimiento.");

    setSaving(true);
    try {
      const r = await fetchWithSupabaseSession("/api/inventario/herramientas/finalizar-mantenimiento", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          producto_id: herramienta.id,
          cantidad: cantNum,
          observacion: observacion.trim() || null,
          fecha,
        }),
      });
      const j = (await r.json().catch(() => ({}))) as { success?: boolean; error?: string };
      if (!r.ok || !j.success) { setErr(j.error ?? "No se pudo finalizar el mantenimiento"); return; }
      await onSaved();
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="border-b border-slate-200 px-5 py-4">
          <h2 className="text-base font-semibold text-slate-900">Finalizar mantenimiento</h2>
          <p className="mt-1 text-xs text-slate-500">Pasa unidades de Mantenimiento a Disponible. No afecta el stock total.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 p-5">
          {err && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{err}</div>}

          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs">
            <div className="text-sm font-semibold text-slate-800">{herramienta.nombre}</div>
            <div className="mt-1 text-slate-600">En mantenimiento: <strong className="text-slate-800">{enMant}</strong> {herramienta.unidad_medida}</div>
          </div>

          <div>
            <label className={labelCls}>Cantidad a liberar <span className="text-red-500">*</span></label>
            <input type="text" inputMode="decimal" autoComplete="off"
              value={cantidad}
              onChange={(e) => setCantidad(e.target.value.replace(/[^\d.,-]/g, ""))}
              className={inputCls} />
          </div>

          <div>
            <label className={labelCls}>Fecha</label>
            <input type="date" className={inputCls} value={fecha} onChange={(e) => setFecha(e.target.value)} />
          </div>

          <div>
            <label className={labelCls}>Observación</label>
            <textarea className={inputCls} rows={2} value={observacion}
              onChange={(e) => setObservacion(e.target.value)}
              placeholder="Ej: cambio de batería, recalibrado…" />
          </div>

          <div className="flex justify-end gap-2 border-t border-slate-200 pt-4">
            <button type="button" onClick={onClose} className="rounded-lg border border-slate-200 px-3 py-2 text-sm">Cancelar</button>
            <button type="submit" disabled={!valida || saving}
              className="rounded-lg bg-[#4FAEB2] px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-[#3F8E91] disabled:opacity-40">
              {saving ? "Guardando…" : "Marcar como disponible"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
