"use client";

import { useCallback, useEffect, useState } from "react";
import PageHeader from "@/components/ui/PageHeader";
import { fetchWithSupabaseSession } from "@/lib/api/fetch-with-supabase-session";
import SaldarButton from "@/components/finanzas/SaldarButton";

export const dynamic = "force-dynamic";

type Fila = {
  origen: "compra" | "gasto";
  id: string;
  fecha: string;
  detalle: string;
  referencia: string | null;
  total: number;
  pagado: number;
  saldo: number;
  vencimiento: string | null;
};

type Data = { filas: Fila[]; totales: { cantidad: number; compras: number; gastos: number; saldo: number } };

function fmtGs(n: number): string {
  return `Gs. ${Math.round(n).toLocaleString("es-PY")}`;
}
function fmtFecha(iso: string | null): string {
  if (!iso) return "—";
  try { return new Date(iso).toLocaleDateString("es-PY"); } catch { return iso.slice(0, 10); }
}

export default function CuentasPorPagarPage() {
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetchWithSupabaseSession("/api/finanzas/cuentas-por-pagar", { cache: "no-store" });
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
        title="Cuentas por Pagar"
        description="Compras y gastos con saldo pendiente de pago."
        backHref="/finanzas"
        backLabel="Finanzas"
      />

      {err && <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">{err}</div>}

      {data && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          <Kpi label="Cantidad pendiente" value={`${data.totales.cantidad}`} hint={`${data.totales.compras} compras · ${data.totales.gastos} gastos`} />
          <Kpi label="Saldo total" value={fmtGs(data.totales.saldo)} highlight />
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full min-w-[820px] text-left text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="px-4 py-3 font-semibold">Fecha</th>
              <th className="px-4 py-3 font-semibold">Origen</th>
              <th className="px-4 py-3 font-semibold">Detalle</th>
              <th className="px-4 py-3 font-semibold hidden md:table-cell">Referencia</th>
              <th className="px-4 py-3 font-semibold text-right">Total</th>
              <th className="px-4 py-3 font-semibold text-right hidden md:table-cell">Pagado</th>
              <th className="px-4 py-3 font-semibold text-right">Saldo</th>
              <th className="px-4 py-3 font-semibold text-right">Acción</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr><td colSpan={8} className="py-10 text-center text-gray-400">Cargando…</td></tr>
            ) : !data || data.filas.length === 0 ? (
              <tr><td colSpan={8} className="py-10 text-center text-gray-400">Sin cuentas por pagar</td></tr>
            ) : (
              data.filas.map((r) => (
                <tr key={`${r.origen}-${r.id}`} className="hover:bg-[#4FAEB2]/[0.04]">
                  <td className="px-4 py-2.5 text-gray-600 text-xs tabular-nums">{fmtFecha(r.fecha)}</td>
                  <td className="px-4 py-2.5">
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                      r.origen === "compra" ? "bg-sky-50 text-sky-700" : "bg-orange-50 text-orange-700"
                    }`}>{r.origen}</span>
                  </td>
                  <td className="px-4 py-2.5 font-medium text-gray-800">{r.detalle}</td>
                  <td className="px-4 py-2.5 text-gray-500 text-xs hidden md:table-cell">{r.referencia ?? "—"}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-gray-700">{fmtGs(r.total)}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-gray-500 text-xs hidden md:table-cell">{fmtGs(r.pagado)}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums font-semibold text-red-700">{fmtGs(r.saldo)}</td>
                  <td className="px-4 py-2.5 text-right">
                    <SaldarButton tabla={r.origen === "compra" ? "compras" : "gastos"} id={r.id} label="Marcar pagada" onDone={() => void load()} />
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

function Kpi({ label, value, hint, highlight }: { label: string; value: string; hint?: string; highlight?: boolean }) {
  return (
    <div className={`rounded-xl border p-4 shadow-sm ${highlight ? "border-red-200 bg-red-50" : "border-slate-200 bg-white"}`}>
      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">{label}</p>
      <p className={`mt-1 text-lg font-bold tabular-nums ${highlight ? "text-red-700" : "text-slate-800"}`}>{value}</p>
      {hint && <p className="text-xs text-slate-500">{hint}</p>}
    </div>
  );
}
