"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import PageHeader from "@/components/ui/PageHeader";
import Badge from "@/components/ui/Badge";
import { getEventos, getRentabilidadEvento } from "@/lib/eventos/storage";
import type { Evento, RentabilidadEvento } from "@/lib/eventos/types";

interface Row {
  evento: Evento;
  r: RentabilidadEvento;
}

export default function ReporteRentabilidadEventosPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    (async () => {
      const eventos = await getEventos();
      const enriched: Row[] = [];
      for (const e of eventos) {
        const r = await getRentabilidadEvento(e.id);
        if (r) enriched.push({ evento: e, r });
      }
      enriched.sort((a, b) => b.r.ganancia - a.r.ganancia);
      setRows(enriched);
      setCargando(false);
    })();
  }, []);

  const totCobrado = rows.reduce((s, x) => s + x.r.total_cobrado, 0);
  const totCostos = rows.reduce((s, x) => s + x.r.total_costos, 0);
  const totGanancia = totCobrado - totCostos;

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-8 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <PageHeader
          eyebrow="NCG · Reportes"
          title="Rentabilidad por evento"
          description="Cobrado, costos y ganancia por evento."
          backHref="/reportes"
        />

        <div className="mt-6 grid grid-cols-1 gap-3 md:grid-cols-3">
          <div className="rounded-lg bg-emerald-50 p-3 text-sm">
            <p className="text-xs text-emerald-700">Cobrado total</p>
            <p className="text-lg font-bold text-emerald-800">
              € {totCobrado.toLocaleString("es-PY")}
            </p>
          </div>
          <div className="rounded-lg bg-red-50 p-3 text-sm">
            <p className="text-xs text-red-700">Costos totales</p>
            <p className="text-lg font-bold text-red-800">
              € {totCostos.toLocaleString("es-PY")}
            </p>
          </div>
          <div className={`rounded-lg p-3 text-sm ${totGanancia >= 0 ? "bg-emerald-50" : "bg-red-50"}`}>
            <p className={`text-xs ${totGanancia >= 0 ? "text-emerald-700" : "text-red-700"}`}>
              Ganancia neta
            </p>
            <p className={`text-lg font-bold ${totGanancia >= 0 ? "text-emerald-800" : "text-red-800"}`}>
              € {totGanancia.toLocaleString("es-PY")}
            </p>
          </div>
        </div>

        <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-4 py-3">Evento</th>
                <th className="px-4 py-3 text-right">Cobrado</th>
                <th className="px-4 py-3 text-right">Costos</th>
                <th className="px-4 py-3 text-right">Ganancia</th>
                <th className="px-4 py-3 text-right">Margen</th>
              </tr>
            </thead>
            <tbody>
              {cargando ? (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-slate-400">
                    Cargando…
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-slate-400">
                    Sin datos.
                  </td>
                </tr>
              ) : (
                rows.map(({ evento, r }) => (
                  <tr key={evento.id} className="border-t border-slate-100">
                    <td className="px-4 py-3">
                      <Link href={`/eventos/${evento.id}`} className="font-medium text-slate-800 hover:underline">
                        {evento.titulo}
                      </Link>
                      <div className="text-xs text-slate-500">{evento.cliente_nombre ?? "—"}</div>
                    </td>
                    <td className="px-4 py-3 text-right text-emerald-700">
                      € {r.total_cobrado.toLocaleString("es-PY")}
                    </td>
                    <td className="px-4 py-3 text-right text-red-700">
                      € {r.total_costos.toLocaleString("es-PY")}
                    </td>
                    <td
                      className={`px-4 py-3 text-right font-bold ${
                        r.ganancia >= 0 ? "text-emerald-800" : "text-red-800"
                      }`}
                    >
                      € {r.ganancia.toLocaleString("es-PY")}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Badge tone={r.margen_pct >= 20 ? "success" : r.margen_pct >= 0 ? "warning" : "danger"}>
                        {r.margen_pct.toFixed(1)}%
                      </Badge>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
