"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import PageHeader from "@/components/ui/PageHeader";
import { fetchWithSupabaseSession } from "@/lib/api/fetch-with-supabase-session";

export const dynamic = "force-dynamic";

type Fila = {
  id: string;
  titulo: string;
  estado: string;
  estado_codigo: string | null;
  presupuestado: number;
  facturado: number;
  costo_materiales: number;
  costo_compras: number;
  costo_gastos: number;
  costo_mano_obra: number;
  costo_total: number;
  margen: number;
  margen_pct: number;
  horas_mo: number;
};

type Data = {
  filas: Fila[];
  totales: { presupuestado: number; facturado: number; costo_total: number; margen: number };
  cantidad: number;
};

type SortKey = "titulo" | "presupuestado" | "facturado" | "costo_total" | "margen" | "margen_pct";

function fmtGs(n: number): string {
  return `Gs. ${Math.round(n).toLocaleString("es-PY")}`;
}
function fmtPct(n: number): string {
  return `${n.toFixed(1)}%`;
}

export default function RentabilidadObrasPage() {
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("margen_pct");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchWithSupabaseSession("/api/reportes/rentabilidad-obras", { cache: "no-store" })
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

  const filas = (data?.filas ?? []).slice().sort((a, b) => {
    const va = a[sortKey];
    const vb = b[sortKey];
    if (typeof va === "string" && typeof vb === "string") {
      return sortDir === "asc" ? va.localeCompare(vb) : vb.localeCompare(va);
    }
    const dx = (Number(va) || 0) - (Number(vb) || 0);
    return sortDir === "asc" ? dx : -dx;
  });

  function toggleSort(k: SortKey) {
    if (sortKey === k) setSortDir((d) => d === "asc" ? "desc" : "asc");
    else { setSortKey(k); setSortDir(k === "titulo" ? "asc" : "desc"); }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="NCG · Reportes"
        title="Rentabilidad por obra"
        description="Comparativo de presupuesto, facturación, costo real y margen para todas las obras activas."
        backHref="/reportes"
        backLabel="Reportes"
      />

      {err && <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">{err}</div>}

      {data && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Kpi label="Obras" value={String(data.cantidad)} />
          <Kpi label="Presupuestado total" value={fmtGs(data.totales.presupuestado)} />
          <Kpi label="Facturado total" value={fmtGs(data.totales.facturado)} />
          <Kpi label="Margen consolidado" value={fmtGs(data.totales.margen)}
            tone={data.totales.margen >= 0 ? "emerald" : "red"} highlight />
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full min-w-[1000px] text-left text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <Th k="titulo" label="Obra" sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} />
              <th className="px-4 py-3 font-semibold">Estado</th>
              <Th k="presupuestado" label="Presupuestado" right sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} />
              <Th k="facturado" label="Facturado" right sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} />
              <Th k="costo_total" label="Costo real" right sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} />
              <Th k="margen" label="Margen" right sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} />
              <Th k="margen_pct" label="%" right sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr><td colSpan={7} className="py-10 text-center text-gray-400">Calculando…</td></tr>
            ) : filas.length === 0 ? (
              <tr><td colSpan={7} className="py-10 text-center text-gray-400">Sin obras activas</td></tr>
            ) : (
              filas.map((f) => (
                <tr key={f.id} className="hover:bg-[#4FAEB2]/[0.04]">
                  <td className="px-4 py-2.5 font-medium text-gray-800">
                    <Link href={`/dashboard/proyectos/${f.id}`} className="hover:text-[#3F8E91] hover:underline">
                      {f.titulo}
                    </Link>
                  </td>
                  <td className="px-4 py-2.5 text-gray-500 text-xs">{f.estado}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-gray-700">{fmtGs(f.presupuestado)}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-gray-700">{fmtGs(f.facturado)}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-gray-700">{fmtGs(f.costo_total)}</td>
                  <td className={`px-4 py-2.5 text-right tabular-nums font-semibold ${f.margen >= 0 ? "text-emerald-700" : "text-red-700"}`}>
                    {fmtGs(f.margen)}
                  </td>
                  <td className={`px-4 py-2.5 text-right tabular-nums font-bold ${f.margen >= 0 ? "text-emerald-700" : "text-red-700"}`}>
                    {fmtPct(f.margen_pct)}
                  </td>
                </tr>
              ))
            )}
            {data && filas.length > 0 && (
              <tr className="border-t-2 border-slate-200 bg-slate-50 font-bold">
                <td className="px-4 py-3 text-slate-800">Total</td>
                <td className="px-4 py-3"></td>
                <td className="px-4 py-3 text-right tabular-nums text-slate-800">{fmtGs(data.totales.presupuestado)}</td>
                <td className="px-4 py-3 text-right tabular-nums text-slate-800">{fmtGs(data.totales.facturado)}</td>
                <td className="px-4 py-3 text-right tabular-nums text-slate-800">{fmtGs(data.totales.costo_total)}</td>
                <td className={`px-4 py-3 text-right tabular-nums ${data.totales.margen >= 0 ? "text-emerald-700" : "text-red-700"}`}>{fmtGs(data.totales.margen)}</td>
                <td></td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-slate-500">
        Click en el nombre de una obra para ver el detalle. Click en los headers para reordenar.
      </p>
    </div>
  );
}

function Th({ k, label, right, sortKey, sortDir, onClick }: { k: SortKey; label: string; right?: boolean; sortKey: SortKey; sortDir: "asc" | "desc"; onClick: (k: SortKey) => void }) {
  const active = sortKey === k;
  return (
    <th className={`px-4 py-3 font-semibold cursor-pointer select-none ${right ? "text-right" : ""} ${active ? "text-slate-900" : ""}`}
      onClick={() => onClick(k)}>
      {label} {active ? (sortDir === "asc" ? "↑" : "↓") : ""}
    </th>
  );
}

function Kpi({ label, value, tone, highlight }: { label: string; value: string; tone?: "emerald" | "red"; highlight?: boolean }) {
  const toneCls = tone === "emerald" ? "border-emerald-200 bg-emerald-50 text-emerald-800" :
                  tone === "red" ? "border-red-200 bg-red-50 text-red-800" : "";
  return (
    <div className={`rounded-xl border p-4 shadow-sm ${highlight ? toneCls : "border-slate-200 bg-white"}`}>
      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">{label}</p>
      <p className={`mt-1 text-lg font-bold tabular-nums ${highlight ? "" : "text-slate-800"}`}>{value}</p>
    </div>
  );
}
