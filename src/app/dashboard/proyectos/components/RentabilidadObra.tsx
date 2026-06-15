"use client";

import { useEffect, useState } from "react";
import { fetchWithSupabaseSession } from "@/lib/api/fetch-with-supabase-session";

type RentabilidadData = {
  proyecto: { id: string; titulo: string };
  presupuestado: number;
  facturado: number;
  costo_materiales: number;
  costo_compras: number;
  costo_gastos: number;
  costo_mano_obra: number;
  total_horas: number;
  costo_total: number;
  margen: number;
  margen_pct: number;
  cantidades: {
    ventas: number;
    movimientos: number;
    compras: number;
    gastos: number;
    asignaciones: number;
  };
};

function fmt(n: number): string {
  return `€ ${Math.round(n).toLocaleString("es-PY")}`;
}

function fmtPct(n: number): string {
  return `${n.toFixed(1)}%`;
}

export default function RentabilidadObra({ projectId }: { projectId: string }) {
  const [data, setData] = useState<RentabilidadData | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchWithSupabaseSession(`/api/proyectos/${projectId}/rentabilidad`, { cache: "no-store" })
      .then(async (r) => {
        const j = (await r.json().catch(() => ({}))) as { success?: boolean; data?: RentabilidadData; error?: string };
        if (cancelled) return;
        if (!r.ok || !j.success || !j.data) {
          setErr(j.error ?? "No se pudo cargar la rentabilidad");
          setData(null);
        } else {
          setData(j.data);
          setErr(null);
        }
      })
      .catch((e) => { if (!cancelled) setErr(e instanceof Error ? e.message : "Error"); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [projectId]);

  if (loading) return <div className="text-sm text-slate-500">Calculando rentabilidad…</div>;
  if (err) return <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">{err}</div>;
  if (!data) return null;

  const margenColor = data.margen >= 0 ? "text-emerald-700" : "text-red-700";
  const margenBg = data.margen >= 0 ? "bg-emerald-50 border-emerald-200" : "bg-red-50 border-red-200";

  return (
    <div className="space-y-4">
      <p className="text-xs text-slate-500">
        Resumen calculado automáticamente desde ventas, compras, gastos y movimientos de inventario
        imputados a esta obra.
      </p>

      {/* KPIs principales */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Presupuestado" value={fmt(data.presupuestado)} hint="monto_vendido" />
        <KpiCard label="Facturado" value={fmt(data.facturado)} hint={`${data.cantidades.ventas} venta(s)`} />
        <KpiCard label="Costo total" value={fmt(data.costo_total)} hint="materiales + compras + gastos" />
        <div className={`rounded-xl border p-4 shadow-sm ${margenBg}`}>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Margen</p>
          <p className={`mt-1 text-xl font-bold tabular-nums ${margenColor}`}>{fmt(data.margen)}</p>
          <p className={`text-xs font-medium ${margenColor}`}>{fmtPct(data.margen_pct)} de margen</p>
        </div>
      </div>

      {/* Desglose de costos */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h3 className="text-sm font-semibold text-slate-700">Desglose de costos</h3>
        <table className="mt-3 w-full text-sm">
          <tbody>
            <Row
              label="Materiales (salidas de inventario)"
              hint={`${data.cantidades.movimientos} salida(s)`}
              value={data.costo_materiales}
            />
            <Row
              label="Compras imputadas"
              hint={`${data.cantidades.compras} compra(s)`}
              value={data.costo_compras}
            />
            <Row
              label="Gastos imputados"
              hint={`${data.cantidades.gastos} gasto(s)`}
              value={data.costo_gastos}
            />
            <Row
              label="Mano de obra"
              hint={`${data.cantidades.asignaciones} asignación(es) · ${data.total_horas.toFixed(1)} h`}
              value={data.costo_mano_obra}
            />
            <tr className="border-t border-slate-200">
              <td className="py-3 text-sm font-semibold text-slate-800">Total costo</td>
              <td className="py-3 text-right tabular-nums font-semibold text-slate-800">
                {fmt(data.costo_total)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Comparativo */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h3 className="text-sm font-semibold text-slate-700">Comparativo</h3>
        <table className="mt-3 w-full text-sm">
          <tbody>
            <Row label="Presupuesto vs Costo real" value={data.presupuestado - data.costo_total}
                 hint={data.presupuestado - data.costo_total >= 0 ? "Dentro de presupuesto" : "Sobrecosto"} />
            <Row label="Facturado vs Costo real (margen)" value={data.margen}
                 hint={fmtPct(data.margen_pct)} />
          </tbody>
        </table>
      </div>
    </div>
  );
}

function KpiCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">{label}</p>
      <p className="mt-1 text-xl font-bold text-slate-800 tabular-nums">{value}</p>
      {hint && <p className="text-xs text-slate-500">{hint}</p>}
    </div>
  );
}

function Row({ label, value, hint }: { label: string; value: number; hint?: string }) {
  const color = value >= 0 ? "text-slate-700" : "text-red-700";
  return (
    <tr className="border-b border-slate-100 last:border-0">
      <td className="py-2.5">
        <div className="text-sm text-slate-700">{label}</div>
        {hint && <div className="text-xs text-slate-400">{hint}</div>}
      </td>
      <td className={`py-2.5 text-right text-sm font-semibold tabular-nums ${color}`}>
        {fmt(value)}
      </td>
    </tr>
  );
}
