"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import PageHeader from "@/components/ui/PageHeader";
import Button from "@/components/ui/Button";
import { getEventosCalendario } from "@/lib/eventos/storage";
import type { Evento } from "@/lib/eventos/types";

type Vista = "mes" | "semana" | "dia";

const NOMBRE_MES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];
const DIAS_SEMANA = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

function toISODate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function startOfWeek(d: Date): Date {
  const dt = new Date(d);
  const dow = (dt.getDay() + 6) % 7; // lunes=0
  dt.setDate(dt.getDate() - dow);
  dt.setHours(0, 0, 0, 0);
  return dt;
}

function addDays(d: Date, n: number): Date {
  const dt = new Date(d);
  dt.setDate(dt.getDate() + n);
  return dt;
}

export default function CalendarioEventosPage() {
  const [vista, setVista] = useState<Vista>("mes");
  const [ancla, setAncla] = useState<Date>(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  });
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [cargando, setCargando] = useState(true);

  const { desde, hasta, dias } = useMemo(() => {
    if (vista === "dia") {
      return { desde: toISODate(ancla), hasta: toISODate(ancla), dias: [ancla] };
    }
    if (vista === "semana") {
      const start = startOfWeek(ancla);
      const arr = Array.from({ length: 7 }, (_, i) => addDays(start, i));
      return { desde: toISODate(start), hasta: toISODate(addDays(start, 6)), dias: arr };
    }
    // Mes: primera semana (empieza lunes) hasta última semana del mes.
    const inicioMes = new Date(ancla.getFullYear(), ancla.getMonth(), 1);
    const finMes = new Date(ancla.getFullYear(), ancla.getMonth() + 1, 0);
    const inicio = startOfWeek(inicioMes);
    const fin = addDays(startOfWeek(finMes), 6);
    const arr: Date[] = [];
    for (let d = new Date(inicio); d <= fin; d = addDays(d, 1)) arr.push(new Date(d));
    return { desde: toISODate(inicio), hasta: toISODate(fin), dias: arr };
  }, [vista, ancla]);

  useEffect(() => {
    let cancel = false;
    setCargando(true);
    getEventosCalendario(desde, hasta)
      .then((d) => {
        if (!cancel) setEventos(d);
      })
      .finally(() => {
        if (!cancel) setCargando(false);
      });
    return () => {
      cancel = true;
    };
  }, [desde, hasta]);

  const eventosPorDia = useMemo(() => {
    const m = new Map<string, Evento[]>();
    for (const e of eventos) {
      if (!e.fecha_evento) continue;
      const key = String(e.fecha_evento).slice(0, 10);
      if (!m.has(key)) m.set(key, []);
      m.get(key)!.push(e);
    }
    return m;
  }, [eventos]);

  const label = useMemo(() => {
    if (vista === "dia") return ancla.toLocaleDateString("es-PY", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
    if (vista === "semana") {
      const s = startOfWeek(ancla);
      const f = addDays(s, 6);
      return `${s.getDate()}/${s.getMonth() + 1} – ${f.getDate()}/${f.getMonth() + 1}/${f.getFullYear()}`;
    }
    return `${NOMBRE_MES[ancla.getMonth()]} ${ancla.getFullYear()}`;
  }, [vista, ancla]);

  const nav = (delta: number) => {
    if (vista === "dia") setAncla(addDays(ancla, delta));
    else if (vista === "semana") setAncla(addDays(ancla, delta * 7));
    else setAncla(new Date(ancla.getFullYear(), ancla.getMonth() + delta, 1));
  };
  const hoy = () => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    setAncla(d);
  };

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-8 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <PageHeader
          eyebrow="NCG · Eventos"
          title="Calendario"
          description="Vista de eventos por día, semana o mes."
          backHref="/eventos"
          actions={
            <div className="flex items-center gap-2">
              <div className="flex overflow-hidden rounded-lg border border-slate-200 bg-white">
                {(["dia", "semana", "mes"] as Vista[]).map((v) => (
                  <button
                    key={v}
                    onClick={() => setVista(v)}
                    className={`px-3 py-1.5 text-xs font-medium capitalize ${
                      vista === v ? "bg-[#4FAEB2] text-white" : "text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    {v}
                  </button>
                ))}
              </div>
            </div>
          }
        />

        <div className="mt-6 flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3">
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" onClick={() => nav(-1)}>
              ‹
            </Button>
            <Button variant="secondary" size="sm" onClick={hoy}>
              Hoy
            </Button>
            <Button variant="secondary" size="sm" onClick={() => nav(1)}>
              ›
            </Button>
          </div>
          <p className="text-sm font-semibold capitalize text-slate-700">{label}</p>
          <span className="text-xs text-slate-400">{cargando ? "Cargando…" : `${eventos.length} eventos`}</span>
        </div>

        <div className="mt-4 rounded-xl border border-slate-200 bg-white p-3">
          {vista === "mes" && (
            <>
              <div className="mb-2 grid grid-cols-7 text-center text-xs font-semibold uppercase tracking-wider text-slate-500">
                {DIAS_SEMANA.map((d) => (
                  <div key={d} className="py-1">
                    {d}
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-1">
                {dias.map((d) => {
                  const key = toISODate(d);
                  const isMes = d.getMonth() === ancla.getMonth();
                  const evs = eventosPorDia.get(key) ?? [];
                  return (
                    <div
                      key={key}
                      className={`min-h-[92px] rounded-lg border p-1.5 text-xs ${
                        isMes ? "border-slate-100 bg-white" : "border-slate-50 bg-slate-50 text-slate-400"
                      }`}
                    >
                      <div className="mb-1 flex justify-between">
                        <span className={isMes ? "font-medium text-slate-700" : ""}>{d.getDate()}</span>
                        {evs.length > 0 && (
                          <span className="rounded-full bg-slate-100 px-1.5 text-[10px]">{evs.length}</span>
                        )}
                      </div>
                      <div className="space-y-0.5">
                        {evs.slice(0, 3).map((e) => (
                          <Link
                            key={e.id}
                            href={`/eventos/${e.id}`}
                            className="block truncate rounded px-1 py-0.5 text-[11px] text-white"
                            style={{ backgroundColor: (e as { estado_color?: string }).estado_color ?? "#0EA5E9" }}
                            title={e.titulo}
                          >
                            {e.hora_inicio ? `${e.hora_inicio} ` : ""}
                            {e.titulo}
                          </Link>
                        ))}
                        {evs.length > 3 && (
                          <p className="text-[10px] text-slate-400">+{evs.length - 3} más</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {vista === "semana" && (
            <div className="grid grid-cols-7 gap-2">
              {dias.map((d) => {
                const key = toISODate(d);
                const evs = eventosPorDia.get(key) ?? [];
                return (
                  <div key={key} className="rounded-lg border border-slate-100 p-2">
                    <p className="mb-2 text-center text-xs font-semibold text-slate-500">
                      {DIAS_SEMANA[(d.getDay() + 6) % 7]} {d.getDate()}
                    </p>
                    <div className="space-y-1">
                      {evs.length === 0 ? (
                        <p className="text-center text-[11px] text-slate-300">—</p>
                      ) : (
                        evs.map((e) => (
                          <Link
                            key={e.id}
                            href={`/eventos/${e.id}`}
                            className="block rounded p-1.5 text-[11px] text-white"
                            style={{ backgroundColor: (e as { estado_color?: string }).estado_color ?? "#0EA5E9" }}
                          >
                            <div className="font-medium">{e.titulo}</div>
                            <div className="opacity-80">
                              {e.hora_inicio ?? ""}{e.hora_fin ? `–${e.hora_fin}` : ""}
                            </div>
                          </Link>
                        ))
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {vista === "dia" && (
            <div className="space-y-2 p-2">
              {(eventosPorDia.get(toISODate(ancla)) ?? []).length === 0 ? (
                <p className="py-10 text-center text-sm text-slate-400">Sin eventos ese día.</p>
              ) : (
                (eventosPorDia.get(toISODate(ancla)) ?? []).map((e) => (
                  <Link
                    key={e.id}
                    href={`/eventos/${e.id}`}
                    className="flex items-center gap-3 rounded-lg border border-slate-100 p-3 hover:bg-slate-50"
                  >
                    <span
                      className="h-10 w-1 rounded"
                      style={{ backgroundColor: (e as { estado_color?: string }).estado_color ?? "#0EA5E9" }}
                    />
                    <div className="flex-1">
                      <div className="font-medium text-slate-800">{e.titulo}</div>
                      <div className="text-xs text-slate-500">
                        {e.cliente_nombre ?? "—"} · {e.recurso_nombre ?? e.lugar_evento ?? "—"}
                      </div>
                    </div>
                    <div className="text-sm text-slate-600">
                      {e.hora_inicio ?? ""}{e.hora_fin ? `–${e.hora_fin}` : ""}
                    </div>
                  </Link>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
