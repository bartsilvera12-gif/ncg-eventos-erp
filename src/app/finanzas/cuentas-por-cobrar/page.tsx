"use client";

import { useCallback, useEffect, useState } from "react";
import PageHeader from "@/components/ui/PageHeader";
import { fetchWithSupabaseSession } from "@/lib/api/fetch-with-supabase-session";
import SaldarButton from "@/components/finanzas/SaldarButton";

export const dynamic = "force-dynamic";

type Fila = {
  id: string;
  numero_control: string;
  fecha: string;
  cliente_nombre: string;
  tipo_venta: string;
  total: number;
  cobrado: number;
  saldo: number;
  vencimiento: string | null;
};

type Data = { filas: Fila[]; totales: { cantidad: number; saldo: number } };

function fmtGs(n: number): string {
  return `Gs. ${Math.round(n).toLocaleString("es-PY")}`;
}
function fmtFecha(iso: string | null): string {
  if (!iso) return "—";
  try { return new Date(iso).toLocaleDateString("es-PY"); } catch { return iso.slice(0, 10); }
}
function diasVencimiento(vencimiento: string | null): number | null {
  if (!vencimiento) return null;
  const diff = (new Date(vencimiento).getTime() - Date.now()) / (1000 * 60 * 60 * 24);
  return Math.round(diff);
}

export default function CuentasPorCobrarPage() {
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetchWithSupabaseSession("/api/finanzas/cuentas-por-cobrar", { cache: "no-store" });
      const j = (await r.json().catch(() => ({}))) as { success?: boolean; data?: Data; error?: string };
      if (r.ok && j.success && j.data) { setData(j.data); setErr(null); }
      else setErr(j.error ?? "No se pudo cargar");
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="NCG · Finanzas"
        title="Cuentas por Cobrar"
        description="Ventas con saldo pendiente de cobro."
        backHref="/finanzas"
        backLabel="Finanzas"
      />

      {err && <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">{err}</div>}

      {data && (
        <div className="grid grid-cols-2 gap-3">
          <Kpi label="Cantidad pendiente" value={`${data.totales.cantidad}`} />
          <Kpi label="Saldo total" value={fmtGs(data.totales.saldo)} highlight />
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full min-w-[860px] text-left text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="px-4 py-3 font-semibold">Fecha</th>
              <th className="px-4 py-3 font-semibold">N° Control</th>
              <th className="px-4 py-3 font-semibold">Cliente</th>
              <th className="px-4 py-3 font-semibold hidden md:table-cell">Tipo</th>
              <th className="px-4 py-3 font-semibold hidden lg:table-cell">Vencimiento</th>
              <th className="px-4 py-3 font-semibold text-right">Total</th>
              <th className="px-4 py-3 font-semibold text-right hidden md:table-cell">Cobrado</th>
              <th className="px-4 py-3 font-semibold text-right">Saldo</th>
              <th className="px-4 py-3 font-semibold text-right">Acción</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr><td colSpan={9} className="py-10 text-center text-gray-400">Cargando…</td></tr>
            ) : !data || data.filas.length === 0 ? (
              <tr><td colSpan={9} className="py-10 text-center text-gray-400">Sin cuentas por cobrar</td></tr>
            ) : (
              data.filas.map((r) => {
                const dias = diasVencimiento(r.vencimiento);
                const vencido = dias != null && dias < 0;
                return (
                  <tr key={r.id} className="hover:bg-[#4FAEB2]/[0.04]">
                    <td className="px-4 py-2.5 text-gray-600 text-xs tabular-nums">{fmtFecha(r.fecha)}</td>
                    <td className="px-4 py-2.5 font-mono text-xs text-gray-500">{r.numero_control}</td>
                    <td className="px-4 py-2.5 font-medium text-gray-800">{r.cliente_nombre}</td>
                    <td className="px-4 py-2.5 text-gray-500 text-xs hidden md:table-cell">{r.tipo_venta}</td>
                    <td className={`px-4 py-2.5 text-xs hidden lg:table-cell ${vencido ? "text-red-700 font-semibold" : "text-gray-600"}`}>
                      {r.vencimiento ? `${fmtFecha(r.vencimiento)}${vencido ? ` (${Math.abs(dias!)} días)` : ""}` : "—"}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-gray-700">{fmtGs(r.total)}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-gray-500 text-xs hidden md:table-cell">{fmtGs(r.cobrado)}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums font-semibold text-red-700">{fmtGs(r.saldo)}</td>
                    <td className="px-4 py-2.5 text-right">
                      <SaldarButton tabla="ventas" id={r.id} label="Marcar cobrada" onDone={() => void load()} />
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Kpi({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`rounded-xl border p-4 shadow-sm ${highlight ? "border-red-200 bg-red-50" : "border-slate-200 bg-white"}`}>
      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">{label}</p>
      <p className={`mt-1 text-lg font-bold tabular-nums ${highlight ? "text-red-700" : "text-slate-800"}`}>{value}</p>
    </div>
  );
}
