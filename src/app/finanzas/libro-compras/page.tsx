"use client";

import { useEffect, useState } from "react";
import PageHeader from "@/components/ui/PageHeader";
import { fetchWithSupabaseSession } from "@/lib/api/fetch-with-supabase-session";

export const dynamic = "force-dynamic";

type Fila = {
  origen: "compra" | "gasto";
  id: string;
  fecha: string;
  detalle: string;
  referencia: string | null;
  subtotal: number;
  monto_iva: number;
  total: number;
};

type Data = {
  mes: string;
  filas: Fila[];
  totales: { cantidad: number; compras: number; gastos: number; subtotal: number; iva: number; total: number };
};

function fmtGs(n: number): string {
  return `Gs. ${Math.round(n).toLocaleString("es-PY")}`;
}

function fmtFecha(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("es-PY");
  } catch {
    return iso.slice(0, 10);
  }
}

export default function LibroComprasPage() {
  const [mes, setMes] = useState(new Date().toISOString().slice(0, 7));
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchWithSupabaseSession(`/api/finanzas/libro-compras?mes=${mes}`, { cache: "no-store" })
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
        title="Libro de Compras"
        description="Detalle unificado de compras y gastos del mes."
        backHref="/finanzas"
        backLabel="Finanzas"
        actions={
          <input type="month" value={mes} onChange={(e) => setMes(e.target.value)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm" />
        }
      />

      {err && <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">{err}</div>}

      {data && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Kpi label="Cantidad" value={`${data.totales.cantidad}`} hint={`${data.totales.compras} compras · ${data.totales.gastos} gastos`} />
          <Kpi label="Subtotal" value={fmtGs(data.totales.subtotal)} />
          <Kpi label="IVA" value={fmtGs(data.totales.iva)} />
          <Kpi label="Total" value={fmtGs(data.totales.total)} highlight />
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
              <th className="px-4 py-3 font-semibold text-right">Subtotal</th>
              <th className="px-4 py-3 font-semibold text-right hidden md:table-cell">IVA</th>
              <th className="px-4 py-3 font-semibold text-right">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr><td colSpan={7} className="py-10 text-center text-gray-400">Cargando…</td></tr>
            ) : !data || data.filas.length === 0 ? (
              <tr><td colSpan={7} className="py-10 text-center text-gray-400">Sin compras ni gastos en {mes}</td></tr>
            ) : (
              data.filas.map((r) => (
                <tr key={`${r.origen}-${r.id}`} className="hover:bg-[#4FAEB2]/[0.04]">
                  <td className="px-4 py-2.5 text-gray-600 text-xs tabular-nums">{fmtFecha(r.fecha)}</td>
                  <td className="px-4 py-2.5">
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                      r.origen === "compra" ? "bg-sky-50 text-sky-700" : "bg-orange-50 text-orange-700"
                    }`}>
                      {r.origen}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 font-medium text-gray-800">{r.detalle}</td>
                  <td className="px-4 py-2.5 text-gray-500 text-xs hidden md:table-cell">{r.referencia ?? "—"}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-gray-700">{fmtGs(r.subtotal)}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-gray-700 hidden md:table-cell">{fmtGs(r.monto_iva)}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums font-semibold text-gray-800">{fmtGs(r.total)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-slate-500">
        Nota: los gastos no tienen IVA discriminado en este modelo. Si necesitás registrar gastos con IVA crédito específico, cargalos como compras.
      </p>
    </div>
  );
}

function Kpi({ label, value, hint, highlight }: { label: string; value: string; hint?: string; highlight?: boolean }) {
  return (
    <div className={`rounded-xl border p-4 shadow-sm ${highlight ? "border-[#4FAEB2]/40 bg-[#E5F4F4]" : "border-slate-200 bg-white"}`}>
      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">{label}</p>
      <p className="mt-1 text-lg font-bold tabular-nums text-slate-800">{value}</p>
      {hint && <p className="text-xs text-slate-500">{hint}</p>}
    </div>
  );
}
