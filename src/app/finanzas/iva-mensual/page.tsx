"use client";

import { useEffect, useState } from "react";
import PageHeader from "@/components/ui/PageHeader";
import { fetchWithSupabaseSession } from "@/lib/api/fetch-with-supabase-session";

export const dynamic = "force-dynamic";

type MesRow = {
  mes: string;
  iva_repercutido: number;
  iva_soportado: number;
  resultado_iva: number;
};
type Data = {
  anio: number;
  meses: MesRow[];
  totales: { iva_repercutido: number; iva_soportado: number; resultado_iva: number };
};

const NOMBRES_MES = [
  "Enero","Febrero","Marzo","Abril","Mayo","Junio",
  "Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre",
];

function fmtEur(n: number): string {
  return `€ ${n.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function IvaMensualPage() {
  const [anio, setAnio] = useState(new Date().getFullYear());
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchWithSupabaseSession(`/api/finanzas/iva-mensual?anio=${anio}`, { cache: "no-store" })
      .then(async (r) => {
        const j = (await r.json().catch(() => ({}))) as { success?: boolean; data?: Data; error?: string };
        if (cancelled) return;
        if (r.ok && j.success && j.data) { setData(j.data); setErr(null); }
        else setErr(j.error ?? "No se pudo cargar");
      })
      .catch((e) => { if (!cancelled) setErr(e instanceof Error ? e.message : "Error"); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [anio]);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="NCG · Finanzas"
        title="IVA del período"
        description="IVA repercutido (ventas) menos IVA soportado (compras). Resultado positivo = IVA a pagar; negativo = crédito a favor."
        backHref="/finanzas"
        backLabel="Finanzas"
        actions={
          <input type="number" min={2000} max={9999} value={anio}
            onChange={(e) => setAnio(parseInt(e.target.value, 10) || new Date().getFullYear())}
            className="w-24 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm tabular-nums" />
        }
      />

      {err && <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">{err}</div>}

      {data && (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <Kpi label="IVA repercutido (ventas)" hint="del año" value={fmtEur(data.totales.iva_repercutido)} tone="indigo" />
          <Kpi label="IVA soportado (compras)" hint="del año" value={fmtEur(data.totales.iva_soportado)} tone="sky" />
          <Kpi label={data.totales.resultado_iva >= 0 ? "IVA a pagar" : "Crédito a favor"}
            hint="Resultado IVA"
            value={fmtEur(Math.abs(data.totales.resultado_iva))}
            tone={data.totales.resultado_iva >= 0 ? "red" : "emerald"} highlight />
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="px-4 py-3 font-semibold">Mes</th>
              <th className="px-4 py-3 font-semibold text-right">IVA repercutido</th>
              <th className="px-4 py-3 font-semibold text-right">IVA soportado</th>
              <th className="px-4 py-3 font-semibold text-right">Resultado IVA</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr><td colSpan={4} className="py-10 text-center text-gray-400">Cargando…</td></tr>
            ) : !data ? null : (
              data.meses.map((m, i) => (
                <tr key={m.mes} className="hover:bg-[#4FAEB2]/[0.04]">
                  <td className="px-4 py-2.5 font-medium text-gray-800">{NOMBRES_MES[i]}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-gray-700">{fmtEur(m.iva_repercutido)}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-gray-700">{fmtEur(m.iva_soportado)}</td>
                  <td className={`px-4 py-2.5 text-right tabular-nums font-semibold ${m.resultado_iva > 0 ? "text-red-700" : m.resultado_iva < 0 ? "text-emerald-700" : "text-gray-500"}`}>
                    {fmtEur(m.resultado_iva)}
                  </td>
                </tr>
              ))
            )}
            {data && (
              <tr className="border-t-2 border-slate-200 bg-slate-50">
                <td className="px-4 py-3 font-bold text-slate-800">Total año</td>
                <td className="px-4 py-3 text-right tabular-nums font-bold text-slate-800">{fmtEur(data.totales.iva_repercutido)}</td>
                <td className="px-4 py-3 text-right tabular-nums font-bold text-slate-800">{fmtEur(data.totales.iva_soportado)}</td>
                <td className={`px-4 py-3 text-right tabular-nums font-bold ${data.totales.resultado_iva > 0 ? "text-red-700" : data.totales.resultado_iva < 0 ? "text-emerald-700" : "text-gray-700"}`}>
                  {fmtEur(data.totales.resultado_iva)}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Kpi({ label, value, hint, tone, highlight }: { label: string; value: string; hint?: string; tone?: "indigo" | "sky" | "red" | "emerald"; highlight?: boolean }) {
  const toneCls = {
    indigo: "border-indigo-200 bg-indigo-50",
    sky: "border-sky-200 bg-sky-50",
    red: "border-red-200 bg-red-50",
    emerald: "border-emerald-200 bg-emerald-50",
  }[tone ?? "indigo"];
  return (
    <div className={`rounded-xl border p-4 shadow-sm ${highlight ? toneCls : "border-slate-200 bg-white"}`}>
      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">{label}</p>
      <p className="mt-1 text-lg font-bold tabular-nums text-slate-800">{value}</p>
      {hint && <p className="text-xs text-slate-500">{hint}</p>}
    </div>
  );
}
