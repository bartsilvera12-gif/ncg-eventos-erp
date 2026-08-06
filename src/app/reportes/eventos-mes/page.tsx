"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import PageHeader from "@/components/ui/PageHeader";
import Badge from "@/components/ui/Badge";
import { getEventos } from "@/lib/eventos/storage";
import type { Evento } from "@/lib/eventos/types";

function firstDayOfMonth(y: number, m: number): string {
  return `${y}-${String(m + 1).padStart(2, "0")}-01`;
}
function lastDayOfMonth(y: number, m: number): string {
  const d = new Date(y, m + 1, 0);
  return `${y}-${String(m + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function ReporteEventosMesPage() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    setCargando(true);
    getEventos({
      desde: firstDayOfMonth(year, month),
      hasta: lastDayOfMonth(year, month),
    })
      .then(setEventos)
      .finally(() => setCargando(false));
  }, [year, month]);

  const porEstado = useMemo(() => {
    const m = new Map<string, number>();
    for (const e of eventos) {
      const k = e.estado_codigo ?? e.estado_nombre ?? "desconocido";
      m.set(k, (m.get(k) ?? 0) + 1);
    }
    return Array.from(m.entries());
  }, [eventos]);

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-8 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <PageHeader
          eyebrow="NCG · Reportes"
          title="Eventos por mes"
          description="Lista de eventos con fecha dentro del mes seleccionado."
          backHref="/reportes"
        />

        <div className="mt-6 flex gap-2">
          <select
            value={month}
            onChange={(e) => setMonth(Number(e.target.value))}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
          >
            {[
              "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
              "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
            ].map((n, i) => (
              <option key={n} value={i}>
                {n}
              </option>
            ))}
          </select>
          <input
            type="number"
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="w-24 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
          />
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs">
            Total: <strong>{eventos.length}</strong>
          </span>
          {porEstado.map(([k, v]) => (
            <span key={k} className="rounded-full bg-slate-100 px-3 py-1 text-xs">
              {k}: <strong>{v}</strong>
            </span>
          ))}
        </div>

        <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-4 py-3">Evento</th>
                <th className="px-4 py-3">Fecha</th>
                <th className="px-4 py-3">Lugar</th>
                <th className="px-4 py-3 text-right">Invitados</th>
                <th className="px-4 py-3">Estado</th>
              </tr>
            </thead>
            <tbody>
              {cargando ? (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-slate-400">
                    Cargando…
                  </td>
                </tr>
              ) : eventos.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-slate-400">
                    Sin eventos.
                  </td>
                </tr>
              ) : (
                eventos.map((e) => (
                  <tr key={e.id} className="border-t border-slate-100">
                    <td className="px-4 py-3">
                      <Link href={`/eventos/${e.id}`} className="font-medium text-slate-800 hover:underline">
                        {e.titulo}
                      </Link>
                      <div className="text-xs text-slate-500">{e.cliente_nombre ?? "—"}</div>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{e.fecha_evento ?? "—"}</td>
                    <td className="px-4 py-3 text-slate-600">
                      {e.recurso_nombre ?? e.lugar_evento ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-right text-slate-600">
                      {e.cantidad_invitados ?? "—"}
                    </td>
                    <td className="px-4 py-3">
                      <Badge>{e.estado_nombre ?? e.estado_codigo ?? "—"}</Badge>
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
