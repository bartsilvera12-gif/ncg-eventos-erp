"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import PageHeader from "@/components/ui/PageHeader";
import { fetchWithSupabaseSession } from "@/lib/api/fetch-with-supabase-session";

export const dynamic = "force-dynamic";

type Empleado = { empleado_nombre: string; empleado_cargo: string | null; horas: number; costo: number };
type Obra = {
  proyecto_id: string;
  titulo: string;
  total_horas: number;
  total_costo: number;
  empleados: Empleado[];
};
type Data = { obras: Obra[]; totales: { horas: number; costo: number }; cantidad: number };

function fmtGs(n: number): string {
  return `€ ${n.toLocaleString("es-PY", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

export default function PersonalPorObraPage() {
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [expandido, setExpandido] = useState<Record<string, boolean>>({});

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchWithSupabaseSession("/api/reportes/personal-por-obra", { cache: "no-store" })
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
        title="Personal por obra"
        description="Mano de obra consolidada: horas y costo por obra, con desglose por empleado."
        backHref="/reportes"
        backLabel="Reportes"
      />

      {err && <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">{err}</div>}

      {data && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          <Kpi label="Obras con personal" value={String(data.cantidad)} />
          <Kpi label="Horas totales" value={data.totales.horas.toFixed(1)} />
          <Kpi label="Costo MO total" value={fmtGs(data.totales.costo)} highlight />
        </div>
      )}

      {loading ? (
        <div className="rounded-xl border border-slate-200 bg-white p-10 text-center text-gray-400">Cargando…</div>
      ) : !data || data.obras.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-10 text-center text-gray-400">Sin asignaciones registradas</div>
      ) : (
        <div className="space-y-3">
          {data.obras.map((o) => {
            const abierto = expandido[o.proyecto_id] ?? false;
            return (
              <div key={o.proyecto_id} className="rounded-xl border border-slate-200 bg-white">
                <button
                  type="button"
                  onClick={() => setExpandido((s) => ({ ...s, [o.proyecto_id]: !abierto }))}
                  className="flex w-full items-center justify-between gap-3 px-5 py-3 text-left hover:bg-slate-50"
                >
                  <div className="min-w-0">
                    <Link href={`/dashboard/proyectos/${o.proyecto_id}`}
                      onClick={(e) => e.stopPropagation()}
                      className="text-sm font-semibold text-slate-800 hover:text-[#3F8E91] hover:underline">
                      {o.titulo}
                    </Link>
                    <p className="text-xs text-slate-500">{o.empleados.length} empleado(s)</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-4 text-sm tabular-nums">
                    <span className="text-slate-600">{o.total_horas.toFixed(1)} h</span>
                    <span className="font-semibold text-slate-800">{fmtGs(o.total_costo)}</span>
                    <span className="text-slate-400">{abierto ? "▾" : "▸"}</span>
                  </div>
                </button>
                {abierto && (
                  <div className="border-t border-slate-100 px-5 py-3">
                    <table className="w-full text-left text-sm">
                      <thead className="text-slate-500">
                        <tr>
                          <th className="py-2 font-medium">Empleado</th>
                          <th className="py-2 font-medium hidden md:table-cell">Cargo</th>
                          <th className="py-2 font-medium text-right">Horas</th>
                          <th className="py-2 font-medium text-right">Costo</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {o.empleados.map((e, i) => (
                          <tr key={`${e.empleado_nombre}-${i}`}>
                            <td className="py-2 font-medium text-gray-800">{e.empleado_nombre}</td>
                            <td className="py-2 text-gray-500 hidden md:table-cell">{e.empleado_cargo ?? "—"}</td>
                            <td className="py-2 text-right tabular-nums text-gray-700">{e.horas.toFixed(1)}</td>
                            <td className="py-2 text-right tabular-nums text-gray-700">{fmtGs(e.costo)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
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
