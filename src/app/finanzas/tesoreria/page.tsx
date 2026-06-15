"use client";

import { useEffect, useState } from "react";
import PageHeader from "@/components/ui/PageHeader";
import { fetchWithSupabaseSession } from "@/lib/api/fetch-with-supabase-session";

export const dynamic = "force-dynamic";

type Fila = {
  tipo: "cobro" | "pago";
  id: string;
  fecha: string;
  detalle: string;
  referencia: string | null;
  monto: number;
  origen?: "compra" | "gasto";
};

type Data = {
  mes: string;
  filas: Fila[];
  totales: { entradas: number; salidas: number; neto: number; cantidadCobros: number; cantidadPagos: number };
};

function fmtGs(n: number): string {
  return `€ ${Math.round(n).toLocaleString("es-PY")}`;
}
function fmtFecha(iso: string): string {
  try { return new Date(iso).toLocaleDateString("es-PY"); } catch { return iso.slice(0, 10); }
}

export default function TesoreriaPage() {
  const [mes, setMes] = useState(new Date().toISOString().slice(0, 7));
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchWithSupabaseSession(`/api/finanzas/tesoreria?mes=${mes}`, { cache: "no-store" })
      .then(async (r) => {
        const j = (await r.json().catch(() => ({}))) as { success?: boolean; data?: Data; error?: string };
        if (cancelled) return;
        if (r.ok && j.success && j.data) { setData(j.data); setErr(null); }
        else setErr(j.error ?? "No se pudo cargar");
      })
      .catch((e) => { if (!cancelled) setErr(e instanceof Error ? e.message : "Error"); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [mes]);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="NCG · Finanzas"
        title="Tesorería"
        description="Cobros y pagos del mes ordenados por fecha. Saldo = entradas - salidas."
        backHref="/finanzas"
        backLabel="Finanzas"
        actions={
          <input type="month" value={mes} onChange={(e) => setMes(e.target.value)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm" />
        }
      />

      {err && <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">{err}</div>}

      {data && (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <Kpi label="Entradas (cobros)" value={fmtGs(data.totales.entradas)}
            hint={`${data.totales.cantidadCobros} cobro(s)`} tone="emerald" />
          <Kpi label="Salidas (pagos)" value={fmtGs(data.totales.salidas)}
            hint={`${data.totales.cantidadPagos} pago(s)`} tone="red" />
          <Kpi label={data.totales.neto >= 0 ? "Saldo neto positivo" : "Saldo neto negativo"}
            value={fmtGs(Math.abs(data.totales.neto))}
            tone={data.totales.neto >= 0 ? "emerald" : "red"} highlight />
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="px-4 py-3 font-semibold">Fecha</th>
              <th className="px-4 py-3 font-semibold">Tipo</th>
              <th className="px-4 py-3 font-semibold">Detalle</th>
              <th className="px-4 py-3 font-semibold hidden md:table-cell">Referencia</th>
              <th className="px-4 py-3 font-semibold text-right">Entrada</th>
              <th className="px-4 py-3 font-semibold text-right">Salida</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr><td colSpan={6} className="py-10 text-center text-gray-400">Cargando…</td></tr>
            ) : !data || data.filas.length === 0 ? (
              <tr><td colSpan={6} className="py-10 text-center text-gray-400">Sin movimientos en {mes}</td></tr>
            ) : (
              data.filas.map((r) => (
                <tr key={`${r.tipo}-${r.id}`} className="hover:bg-[#4FAEB2]/[0.04]">
                  <td className="px-4 py-2.5 text-gray-600 text-xs tabular-nums">{fmtFecha(r.fecha)}</td>
                  <td className="px-4 py-2.5">
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                      r.tipo === "cobro" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"
                    }`}>
                      {r.tipo}{r.origen ? ` · ${r.origen}` : ""}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 font-medium text-gray-800">{r.detalle}</td>
                  <td className="px-4 py-2.5 text-gray-500 text-xs hidden md:table-cell">{r.referencia ?? "—"}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums font-semibold text-emerald-700">
                    {r.tipo === "cobro" ? fmtGs(r.monto) : ""}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums font-semibold text-red-700">
                    {r.tipo === "pago" ? fmtGs(r.monto) : ""}
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

function Kpi({ label, value, hint, tone, highlight }: { label: string; value: string; hint?: string; tone?: "emerald" | "red"; highlight?: boolean }) {
  const toneCls = tone === "emerald" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-red-200 bg-red-50 text-red-800";
  return (
    <div className={`rounded-xl border p-4 shadow-sm ${highlight ? toneCls : "border-slate-200 bg-white"}`}>
      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">{label}</p>
      <p className={`mt-1 text-lg font-bold tabular-nums ${highlight ? "" : "text-slate-800"}`}>{value}</p>
      {hint && <p className="text-xs text-slate-500">{hint}</p>}
    </div>
  );
}
