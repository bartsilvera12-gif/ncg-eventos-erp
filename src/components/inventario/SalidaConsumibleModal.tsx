"use client";

/**
 * Modal "Dar salida de consumible".
 *
 * Maneja: cantidad, motivo, obra (si motivo=uso_obra), responsable, ubicación
 * origen, fecha y observación. Envía a POST /api/inventario/movimientos/salida
 * y avisa al padre cuando termina (refresh de listado).
 */

import { useEffect, useState } from "react";
import { fetchWithSupabaseSession } from "@/lib/api/fetch-with-supabase-session";
import { parseImporte } from "@/lib/utils/money";

export interface SalidaConsumibleProducto {
  id: string;
  nombre: string;
  sku: string;
  stock_actual: number;
  costo_promedio: number;
  unidad_medida: string;
}

interface Props {
  producto: SalidaConsumibleProducto;
  onClose: () => void;
  onSaved: () => void | Promise<void>;
}

type Motivo = "uso_obra" | "consumo_interno" | "rotura" | "ajuste" | "entrega_cuadrilla" | "transferencia_vehiculo";

const MOTIVO_OPTS: { value: Motivo; label: string }[] = [
  { value: "uso_obra", label: "Uso en obra" },
  { value: "consumo_interno", label: "Consumo interno" },
  { value: "rotura", label: "Rotura / pérdida" },
  { value: "ajuste", label: "Ajuste de inventario" },
  { value: "entrega_cuadrilla", label: "Entrega a cuadrilla" },
  { value: "transferencia_vehiculo", label: "Transferencia a vehículo" },
];

const inputCls =
  "w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#4FAEB2]/30 focus:border-[#4FAEB2]/50";
const labelCls = "block text-sm font-medium text-slate-700 mb-1.5";

function todayIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function fmtEur(n: number): string {
  return `€ ${n.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function SalidaConsumibleModal({ producto, onClose, onSaved }: Props) {
  const [cantidad, setCantidad] = useState("");
  const [motivo, setMotivo] = useState<Motivo>("uso_obra");
  const [proyectoId, setProyectoId] = useState("");
  const [responsable, setResponsable] = useState("");
  const [ubicacion, setUbicacion] = useState("Depósito principal");
  const [fecha, setFecha] = useState(todayIso());
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
      .catch(() => { /* sin proyectos: el select queda vacío y se valida abajo */ });
  }, []);

  const cantNum = parseImporte(cantidad);
  const costoTotal = cantNum * (producto.costo_promedio || 0);
  const valida =
    cantNum > 0 &&
    cantNum <= producto.stock_actual &&
    !!motivo &&
    (motivo !== "uso_obra" || !!proyectoId);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    if (!(cantNum > 0)) return setErr("La cantidad debe ser mayor a 0.");
    if (cantNum > producto.stock_actual) return setErr("No hay stock suficiente para realizar la salida.");
    if (motivo === "uso_obra" && !proyectoId) return setErr("Seleccioná una obra para registrar el consumo.");

    setSaving(true);
    try {
      const r = await fetchWithSupabaseSession("/api/inventario/movimientos/salida", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          producto_id: producto.id,
          cantidad: cantNum,
          motivo,
          proyecto_id: motivo === "uso_obra" ? proyectoId : (proyectoId || null),
          responsable: responsable.trim() || null,
          ubicacion_origen: ubicacion.trim() || null,
          observacion: observacion.trim() || null,
          fecha,
        }),
      });
      const j = (await r.json().catch(() => ({}))) as { success?: boolean; error?: string; data?: { warning?: string } };
      if (!r.ok || !j.success) {
        setErr(j.error ?? "No se pudo registrar la salida");
        return;
      }
      if (j.data?.warning) alert(j.data.warning);
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
          <h2 className="text-base font-semibold text-slate-900">Dar salida de consumible</h2>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-700">✕</button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5 p-5">
          {err && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{err}</div>}

          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
            <div className="text-sm font-semibold text-slate-800">{producto.nombre}</div>
            <div className="mt-1 grid grid-cols-3 gap-3 text-xs text-slate-600">
              <div><span className="text-slate-400">SKU:</span> {producto.sku || "—"}</div>
              <div><span className="text-slate-400">Stock disponible:</span> <strong className="text-slate-800">{producto.stock_actual}</strong> {producto.unidad_medida}</div>
              <div><span className="text-slate-400">Costo prom.:</span> {fmtEur(producto.costo_promedio)}</div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className={labelCls}>Cantidad a retirar <span className="text-red-500">*</span></label>
              <input
                type="text" inputMode="decimal" autoComplete="off"
                value={cantidad}
                onChange={(e) => setCantidad(e.target.value.replace(/[^\d.,-]/g, ""))}
                placeholder={`Ej: 3 (${producto.unidad_medida})`}
                className={inputCls}
              />
              {cantNum > 0 && (
                <p className="mt-1 text-xs text-slate-500">
                  Costo total: <strong>{fmtEur(costoTotal)}</strong>
                </p>
              )}
            </div>
            <div>
              <label className={labelCls}>Motivo <span className="text-red-500">*</span></label>
              <select className={inputCls} value={motivo} onChange={(e) => setMotivo(e.target.value as Motivo)}>
                {MOTIVO_OPTS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>

            <div className={motivo === "uso_obra" ? "md:col-span-2" : ""}>
              <label className={labelCls}>
                Obra / proyecto {motivo === "uso_obra" && <span className="text-red-500">*</span>}
              </label>
              <select className={inputCls} value={proyectoId} onChange={(e) => setProyectoId(e.target.value)}>
                <option value="">— Sin obra —</option>
                {proyectos.map((p) => <option key={p.id} value={p.id}>{p.titulo}</option>)}
              </select>
              {motivo === "uso_obra" && !proyectoId && (
                <p className="mt-1 text-[11px] text-amber-700">Obligatorio cuando el motivo es uso en obra.</p>
              )}
            </div>

            <div>
              <label className={labelCls}>Responsable</label>
              <input className={inputCls} value={responsable}
                onChange={(e) => setResponsable(e.target.value)}
                placeholder="Empleado o usuario (opcional)" />
              <p className="mt-1 text-[11px] text-slate-400">Si lo dejás vacío, queda el usuario actual.</p>
            </div>
            <div>
              <label className={labelCls}>Ubicación origen</label>
              <input className={inputCls} value={ubicacion}
                onChange={(e) => setUbicacion(e.target.value)} />
            </div>

            <div>
              <label className={labelCls}>Fecha</label>
              <input type="date" className={inputCls} value={fecha}
                onChange={(e) => setFecha(e.target.value)} />
            </div>
            <div className="md:col-span-2">
              <label className={labelCls}>Observación</label>
              <textarea className={inputCls} rows={2} value={observacion}
                onChange={(e) => setObservacion(e.target.value)} placeholder="Notas opcionales" />
            </div>
          </div>

          <div className="flex justify-end gap-2 border-t border-slate-200 pt-4">
            <button type="button" onClick={onClose}
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm">Cancelar</button>
            <button type="submit" disabled={!valida || saving}
              className="rounded-lg bg-[#4FAEB2] px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-[#3F8E91] disabled:opacity-40">
              {saving ? "Guardando…" : "Registrar salida"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
