"use client";

import { useEffect, useState } from "react";
import PageHeader from "@/components/ui/PageHeader";
import { fetchWithSupabaseSession } from "@/lib/api/fetch-with-supabase-session";

export const dynamic = "force-dynamic";

type Fila = {
  id: string;
  numero_control: string;
  fecha: string;
  total: number;
  subtotal: number;
  monto_iva: number;
  tipo_venta: string;
  cliente_nombre: string;
  cliente_ruc: string | null;
};

type Data = {
  mes: string;
  desde: string;
  hasta: string;
  filas: Fila[];
  totales: { cantidad: number; subtotal: number; iva: number; total: number };
};

function fmtGs(n: number): string {
  return `€ ${n.toLocaleString("es-PY", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

function fmtFecha(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("es-PY");
  } catch {
    return iso.slice(0, 10);
  }
}

function mesActual(): string {
  return new Date().toISOString().slice(0, 7);
}

export default function LibroVentasPage() {
  const [mes, setMes] = useState(mesActual());
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchWithSupabaseSession(`/api/finanzas/libro-ventas?mes=${mes}`, { cache: "no-store" })
      .then(async (r) => {
        const j = (await r.json().catch(() => ({}))) as { success?: boolean; data?: Data; error?: string };
        if (cancelled) return;
        if (r.ok && j.success && j.data) {
          setData(j.data);
          setErr(null);
        } else {
          setErr(j.error ?? "No se pudo cargar");
        }
      })
      .catch((e) => { if (!cancelled) setErr(e instanceof Error ? e.message : "Error"); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [mes]);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="NCG · Finanzas"
        title="Libro de Ventas"
        description="Detalle de ventas reales del mes con subtotal, IVA y total."
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
          <Kpi label="Cantidad" value={String(data.totales.cantidad)} />
          <Kpi label="Subtotal" value={fmtGs(data.totales.subtotal)} />
          <Kpi label="IVA" value={fmtGs(data.totales.iva)} />
          <Kpi label="Total" value={fmtGs(data.totales.total)} highlight />
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full min-w-[800px] text-left text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="px-4 py-3 font-semibold">Fecha</th>
              <th className="px-4 py-3 font-semibold">N° Control</th>
              <th className="px-4 py-3 font-semibold">Cliente</th>
              <th className="px-4 py-3 font-semibold hidden md:table-cell">NIF</th>
              <th className="px-4 py-3 font-semibold hidden lg:table-cell">Tipo</th>
              <th className="px-4 py-3 font-semibold text-right">Subtotal</th>
              <th className="px-4 py-3 font-semibold text-right hidden md:table-cell">IVA</th>
              <th className="px-4 py-3 font-semibold text-right">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr><td colSpan={8} className="py-10 text-center text-gray-400">Cargando…</td></tr>
            ) : !data || data.filas.length === 0 ? (
              <tr><td colSpan={8} className="py-10 text-center text-gray-400">Sin ventas en {mes}</td></tr>
            ) : (
              data.filas.map((r) => (
                <tr key={r.id} className="hover:bg-[#4FAEB2]/[0.04]">
                  <td className="px-4 py-2.5 text-gray-600 text-xs tabular-nums">{fmtFecha(r.fecha)}</td>
                  <td className="px-4 py-2.5 font-mono text-xs text-gray-500">{r.numero_control}</td>
                  <td className="px-4 py-2.5 font-medium text-gray-800">{r.cliente_nombre}</td>
                  <td className="px-4 py-2.5 text-gray-500 text-xs hidden md:table-cell">{r.cliente_ruc ?? "—"}</td>
                  <td className="px-4 py-2.5 text-gray-500 text-xs hidden lg:table-cell">{r.tipo_venta}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-gray-700">{fmtGs(r.subtotal)}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-gray-700 hidden md:table-cell">{fmtGs(r.monto_iva)}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums font-semibold text-gray-800">{fmtGs(r.total)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Kpi({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`rounded-xl border p-4 shadow-sm ${highlight ? "border-[#4FAEB2]/40 bg-[#E5F4F4]" : "border-slate-200 bg-white"}`}>
      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">{label}</p>
      <p className="mt-1 text-lg font-bold tabular-nums text-slate-800">{value}</p>
    </div>
  );
}
