"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import PageHeader from "@/components/ui/PageHeader";
import Badge from "@/components/ui/Badge";
import { getEventos, getPagosEvento } from "@/lib/eventos/storage";
import type { Evento } from "@/lib/eventos/types";

interface Row {
  evento: Evento;
  cobrado: number;
  presupuesto: number;
  saldo: number;
}

export default function ReportePendientesPagoPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    (async () => {
      const eventos = await getEventos();
      const enriched: Row[] = [];
      for (const e of eventos) {
        const p = await getPagosEvento(e.id);
        if (!p) continue;
        if (p.saldo_pendiente > 0) {
          enriched.push({
            evento: e,
            cobrado: p.total_cobrado,
            presupuesto: p.total_presupuesto,
            saldo: p.saldo_pendiente,
          });
        }
      }
      enriched.sort((a, b) => b.saldo - a.saldo);
      setRows(enriched);
      setCargando(false);
    })();
  }, []);

  const totalSaldo = rows.reduce((s, r) => s + r.saldo, 0);

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-8 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <PageHeader
          eyebrow="NCG · Reportes"
          title="Eventos pendientes de pago"
          description="Eventos con saldo pendiente contra el último presupuesto aprobado."
          backHref="/reportes"
        />

        <div className="mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          Saldo total pendiente: <strong>€ {totalSaldo.toLocaleString("es-PY")}</strong>
        </div>

        <div className="mt-4 overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-gradient-to-r from-slate-50 via-teal-50/30 to-slate-50 text-left text-xs uppercase tracking-wider text-slate-600 border-b border-slate-200">
              <tr>
                <th className="px-4 py-3">Evento</th>
                <th className="px-4 py-3">Fecha</th>
                <th className="px-4 py-3 text-right">Presupuesto</th>
                <th className="px-4 py-3 text-right">Cobrado</th>
                <th className="px-4 py-3 text-right">Saldo</th>
                <th className="px-4 py-3">Estado</th>
              </tr>
            </thead>
            <tbody>
              {cargando ? (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-slate-400">
                    Cargando…
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-slate-400">
                    No hay eventos con saldo pendiente.
                  </td>
                </tr>
              ) : (
                rows.map(({ evento, cobrado, presupuesto, saldo }) => (
                  <tr key={evento.id} className="border-t border-slate-100">
                    <td className="px-4 py-3">
                      <Link href={`/eventos/${evento.id}`} className="font-medium text-slate-800 hover:underline">
                        {evento.titulo}
                      </Link>
                      <div className="text-xs text-slate-500">{evento.cliente_nombre ?? "—"}</div>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{evento.fecha_evento ?? "—"}</td>
                    <td className="px-4 py-3 text-right text-slate-600">
                      € {presupuesto.toLocaleString("es-PY")}
                    </td>
                    <td className="px-4 py-3 text-right text-emerald-700">
                      € {cobrado.toLocaleString("es-PY")}
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-red-700">
                      € {saldo.toLocaleString("es-PY")}
                    </td>
                    <td className="px-4 py-3">
                      <Badge tone="warning">{evento.estado_codigo ?? "—"}</Badge>
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
