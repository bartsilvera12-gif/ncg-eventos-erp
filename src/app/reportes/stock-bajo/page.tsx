"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import PageHeader from "@/components/ui/PageHeader";
import { fetchWithSupabaseSession } from "@/lib/api/fetch-with-supabase-session";

export const dynamic = "force-dynamic";

type Fila = {
  id: string;
  nombre: string;
  sku: string;
  stock_actual: number;
  stock_minimo: number;
  deficit: number;
  unidad_medida: string;
  costo_reposicion_estimado: number;
  critico: boolean;
};

type Data = {
  filas: Fila[];
  cantidad: number;
  totales: { criticos: number; costo_reposicion: number };
};

function fmtGs(n: number): string {
  return `€ ${n.toLocaleString("es-PY", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

export default function StockBajoPage() {
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchWithSupabaseSession("/api/reportes/stock-bajo", { cache: "no-store" })
      .then(async (r) => {
        const j = (await r.json().catch(() => ({}))) as { success?: boolean; data?: Data; error?: string };
        if (cancelled) return;
        if (r.ok && j.success && j.data) { setData(j.data); setErr(null); }
        else setErr(j.error ?? "No se pudo cargar");
      })
      .catch((e) => { if (!cancelled) setErr(e instanceof Error ? e.message : "Error"); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="NCG · Reportes"
        title="Stock bajo"
        description="Productos con stock por debajo del mínimo configurado, ordenados por mayor déficit."
        backHref="/reportes"
        backLabel="Reportes"
      />

      {err && <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">{err}</div>}

      {data && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          <Kpi label="Productos a reponer" value={String(data.cantidad)} />
          <Kpi label="Críticos (stock 0)" value={String(data.totales.criticos)} tone="red" highlight={data.totales.criticos > 0} />
          <Kpi label="Reposición estimada" value={fmtGs(data.totales.costo_reposicion)} hint="déficit × costo promedio" />
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full min-w-[820px] text-left text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="px-4 py-3 font-semibold">Producto</th>
              <th className="px-4 py-3 font-semibold hidden md:table-cell">SKU</th>
              <th className="px-4 py-3 font-semibold text-right">Stock actual</th>
              <th className="px-4 py-3 font-semibold text-right">Mínimo</th>
              <th className="px-4 py-3 font-semibold text-right">Déficit</th>
              <th className="px-4 py-3 font-semibold text-right hidden lg:table-cell">Reposición €</th>
              <th className="px-4 py-3 font-semibold text-center">Estado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr><td colSpan={7} className="py-10 text-center text-gray-400">Cargando…</td></tr>
            ) : !data || data.filas.length === 0 ? (
              <tr><td colSpan={7} className="py-10 text-center text-emerald-700">✓ Sin productos bajo el mínimo</td></tr>
            ) : (
              data.filas.map((f) => (
                <tr key={f.id} className={`hover:bg-[#4FAEB2]/[0.04] ${f.critico ? "bg-red-50/30" : ""}`}>
                  <td className="px-4 py-2.5 font-medium text-gray-800">
                    <Link href={`/inventario/${f.id}/editar`} className="hover:text-[#3F8E91] hover:underline">
                      {f.nombre}
                    </Link>
                  </td>
                  <td className="px-4 py-2.5 font-mono text-xs text-gray-500 hidden md:table-cell">{f.sku}</td>
                  <td className={`px-4 py-2.5 text-right tabular-nums font-semibold ${f.critico ? "text-red-700" : "text-amber-700"}`}>
                    {f.stock_actual} {f.unidad_medida}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-gray-600">{f.stock_minimo} {f.unidad_medida}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums font-bold text-red-700">−{f.deficit} {f.unidad_medida}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-gray-700 hidden lg:table-cell">{fmtGs(f.costo_reposicion_estimado)}</td>
                  <td className="px-4 py-2.5 text-center">
                    {f.critico ? (
                      <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold uppercase text-red-800">Crítico</span>
                    ) : (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase text-amber-800">Bajo</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-slate-500">
        Click en el nombre del producto para editarlo (cambiar stock mínimo, etc.). Los productos con stock 0 se marcan como críticos.
      </p>
    </div>
  );
}

function Kpi({ label, value, hint, tone, highlight }: { label: string; value: string; hint?: string; tone?: "red"; highlight?: boolean }) {
  const toneCls = tone === "red" ? "border-red-200 bg-red-50 text-red-800" : "";
  return (
    <div className={`rounded-xl border p-4 shadow-sm ${highlight ? toneCls : "border-slate-200 bg-white"}`}>
      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">{label}</p>
      <p className={`mt-1 text-lg font-bold tabular-nums ${highlight ? "" : "text-slate-800"}`}>{value}</p>
      {hint && <p className="text-xs text-slate-500">{hint}</p>}
    </div>
  );
}
