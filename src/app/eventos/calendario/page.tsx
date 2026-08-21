"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import PageHeader from "@/components/ui/PageHeader";
import { getEventosCalendario } from "@/lib/eventos/storage";
import type { Evento } from "@/lib/eventos/types";

type Vista = "mes" | "semana" | "dia";

const NOMBRE_MES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];
const DIAS_SEMANA = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
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

/** Convierte un color hex a un fondo pastel (variante clara con la misma tonalidad). */
function pastelBg(hex: string | undefined | null): string {
  const h = (hex ?? "#0EA5E9").replace("#", "");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, 0.12)`;
}

function colorEvento(e: Evento): string {
  return (e as { estado_color?: string }).estado_color ?? "#0EA5E9";
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

  const hoyISO = toISODate(new Date());

  const { desde, hasta, dias } = useMemo(() => {
    if (vista === "dia") {
      return { desde: toISODate(ancla), hasta: toISODate(ancla), dias: [ancla] };
    }
    if (vista === "semana") {
      const start = startOfWeek(ancla);
      const arr = Array.from({ length: 7 }, (_, i) => addDays(start, i));
      return { desde: toISODate(start), hasta: toISODate(addDays(start, 6)), dias: arr };
    }
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
    for (const arr of m.values()) {
      arr.sort((a, b) => (a.hora_inicio ?? "").localeCompare(b.hora_inicio ?? ""));
    }
    return m;
  }, [eventos]);

  // Leyenda: colores únicos por estado presentes en la ventana visible.
  const leyenda = useMemo(() => {
    const seen = new Map<string, { color: string; label: string }>();
    for (const e of eventos) {
      const label = (e as { estado_nombre?: string }).estado_nombre ?? "Sin estado";
      const color = colorEvento(e);
      const k = `${label}::${color}`;
      if (!seen.has(k)) seen.set(k, { color, label });
    }
    return Array.from(seen.values());
  }, [eventos]);

  const label = useMemo(() => {
    if (vista === "dia") {
      return ancla.toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
    }
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

  const totalEventos = eventos.length;
  const eventosHoy = (eventosPorDia.get(hoyISO) ?? []).length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-teal-50/40 px-4 py-8 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <PageHeader
          eyebrow="NCG · Eventos"
          title="Calendario"
          description="Todos los eventos organizados por día, semana o mes."
          backHref="/eventos"
          actions={
            <div className="flex items-center gap-2">
              <div className="inline-flex overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                {(["dia", "semana", "mes"] as Vista[]).map((v) => (
                  <button
                    key={v}
                    onClick={() => setVista(v)}
                    className={`px-4 py-2 text-xs font-semibold uppercase tracking-wide transition-all ${
                      vista === v
                        ? "bg-gradient-to-r from-[#4FAEB2] to-[#3F8E91] text-white shadow-inner"
                        : "text-slate-500 hover:bg-slate-50 hover:text-slate-700"
                    }`}
                  >
                    {v}
                  </button>
                ))}
              </div>
            </div>
          }
        />

        {/* Barra de navegación mejorada */}
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
          <div className="flex items-center gap-2">
            <button
              onClick={() => nav(-1)}
              className="grid h-9 w-9 place-items-center rounded-lg border border-slate-200 bg-white text-slate-600 shadow-sm transition-all hover:-translate-y-0.5 hover:border-[#4FAEB2] hover:text-[#3F8E91] hover:shadow-md active:translate-y-0"
              title="Anterior"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                <path fillRule="evenodd" d="M12.79 5.23a.75.75 0 0 1-.02 1.06L8.832 10l3.938 3.71a.75.75 0 1 1-1.04 1.08l-4.5-4.25a.75.75 0 0 1 0-1.08l4.5-4.25a.75.75 0 0 1 1.06.02Z" clipRule="evenodd" />
              </svg>
            </button>
            <button
              onClick={hoy}
              className="rounded-lg bg-gradient-to-r from-[#4FAEB2] to-[#3F8E91] px-4 py-2 text-xs font-semibold text-white shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md active:translate-y-0"
            >
              Hoy
            </button>
            <button
              onClick={() => nav(1)}
              className="grid h-9 w-9 place-items-center rounded-lg border border-slate-200 bg-white text-slate-600 shadow-sm transition-all hover:-translate-y-0.5 hover:border-[#4FAEB2] hover:text-[#3F8E91] hover:shadow-md active:translate-y-0"
              title="Siguiente"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                <path fillRule="evenodd" d="M7.21 14.77a.75.75 0 0 1 .02-1.06L11.168 10 7.23 6.29a.75.75 0 1 1 1.04-1.08l4.5 4.25a.75.75 0 0 1 0 1.08l-4.5 4.25a.75.75 0 0 1-1.06-.02Z" clipRule="evenodd" />
              </svg>
            </button>
          </div>

          <p className="text-base font-bold capitalize text-slate-800">{label}</p>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 rounded-lg bg-teal-50 px-3 py-1.5 text-xs font-semibold text-teal-700 ring-1 ring-teal-100">
              <span className="h-2 w-2 rounded-full bg-teal-500 animate-pulse" aria-hidden />
              {cargando ? "Cargando…" : `${totalEventos} evento${totalEventos === 1 ? "" : "s"}`}
            </div>
            {eventosHoy > 0 && (
              <div className="flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-700 ring-1 ring-amber-100">
                <span className="h-2 w-2 rounded-full bg-amber-500" aria-hidden />
                {eventosHoy} hoy
              </div>
            )}
          </div>
        </div>

        {/* Leyenda de estados */}
        {leyenda.length > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white/60 px-4 py-2 backdrop-blur">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Estados:</span>
            {leyenda.map((l) => (
              <span
                key={`${l.label}-${l.color}`}
                className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium"
                style={{ backgroundColor: pastelBg(l.color), color: l.color }}
              >
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: l.color }} aria-hidden />
                {l.label}
              </span>
            ))}
          </div>
        )}

        {/* Contenedor principal */}
        <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          {vista === "mes" && (
            <>
              <div className="mb-3 grid grid-cols-7 gap-1 text-center text-[11px] font-bold uppercase tracking-widest text-slate-500">
                {DIAS_SEMANA.map((d, i) => (
                  <div
                    key={d}
                    className={`py-2 ${i >= 5 ? "text-[#4FAEB2]" : ""}`}
                  >
                    {d}
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-1.5">
                {dias.map((d) => {
                  const key = toISODate(d);
                  const isMes = d.getMonth() === ancla.getMonth();
                  const isHoy = key === hoyISO;
                  const isFinde = d.getDay() === 0 || d.getDay() === 6;
                  const evs = eventosPorDia.get(key) ?? [];
                  return (
                    <div
                      key={key}
                      className={`group relative min-h-[110px] rounded-xl border p-2 text-xs transition-all hover:z-10 hover:-translate-y-0.5 hover:shadow-lg ${
                        isHoy
                          ? "border-[#4FAEB2] bg-gradient-to-br from-teal-50 to-white ring-2 ring-[#4FAEB2]/40 shadow-md"
                          : isMes
                            ? isFinde
                              ? "border-slate-100 bg-slate-50/60 hover:border-[#4FAEB2]/40 hover:bg-white"
                              : "border-slate-100 bg-white hover:border-[#4FAEB2]/40"
                            : "border-slate-50 bg-slate-50/40 text-slate-300"
                      }`}
                    >
                      <div className="mb-1.5 flex items-center justify-between">
                        <span
                          className={`inline-grid h-6 w-6 place-items-center rounded-full text-[11px] font-bold ${
                            isHoy
                              ? "bg-gradient-to-br from-[#4FAEB2] to-[#3F8E91] text-white shadow-md"
                              : isMes
                                ? "text-slate-700"
                                : "text-slate-300"
                          }`}
                        >
                          {d.getDate()}
                        </span>
                        {evs.length > 0 && (
                          <span className="rounded-full bg-slate-100 px-1.5 text-[10px] font-semibold text-slate-600">
                            {evs.length}
                          </span>
                        )}
                      </div>
                      <div className="space-y-1">
                        {evs.slice(0, 3).map((e) => {
                          const color = colorEvento(e);
                          return (
                            <Link
                              key={e.id}
                              href={`/eventos/${e.id}`}
                              className="group/ev block truncate rounded-md px-1.5 py-1 text-[11px] font-medium shadow-sm transition-all hover:scale-[1.03] hover:shadow-md"
                              style={{ backgroundColor: pastelBg(color), color, borderLeft: `3px solid ${color}` }}
                              title={`${e.titulo}${e.hora_inicio ? " · " + e.hora_inicio : ""}`}
                            >
                              {e.hora_inicio && (
                                <span className="mr-1 font-bold tabular-nums">{e.hora_inicio.slice(0, 5)}</span>
                              )}
                              {e.titulo}
                            </Link>
                          );
                        })}
                        {evs.length > 3 && (
                          <p className="pl-1 text-[10px] font-semibold text-slate-500">
                            +{evs.length - 3} más
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {vista === "semana" && (
            <div className="grid grid-cols-1 gap-2 md:grid-cols-7">
              {dias.map((d) => {
                const key = toISODate(d);
                const isHoy = key === hoyISO;
                const evs = eventosPorDia.get(key) ?? [];
                return (
                  <div
                    key={key}
                    className={`overflow-hidden rounded-xl border transition-all hover:shadow-md ${
                      isHoy
                        ? "border-[#4FAEB2] ring-2 ring-[#4FAEB2]/30"
                        : "border-slate-100"
                    }`}
                  >
                    <div
                      className={`px-2 py-2 text-center ${
                        isHoy
                          ? "bg-gradient-to-r from-[#4FAEB2] to-[#3F8E91] text-white"
                          : "bg-slate-50 text-slate-600"
                      }`}
                    >
                      <p className="text-[10px] font-bold uppercase tracking-widest opacity-80">
                        {DIAS_SEMANA[(d.getDay() + 6) % 7]}
                      </p>
                      <p className="text-lg font-bold">{d.getDate()}</p>
                    </div>
                    <div className="min-h-[240px] space-y-1.5 p-2">
                      {evs.length === 0 ? (
                        <p className="pt-8 text-center text-[11px] text-slate-300">Sin eventos</p>
                      ) : (
                        evs.map((e) => {
                          const color = colorEvento(e);
                          return (
                            <Link
                              key={e.id}
                              href={`/eventos/${e.id}`}
                              className="block rounded-lg p-2 text-[11px] shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
                              style={{ backgroundColor: pastelBg(color), borderLeft: `4px solid ${color}` }}
                            >
                              <div className="font-semibold" style={{ color }}>
                                {e.titulo}
                              </div>
                              <div className="mt-0.5 text-[10px] text-slate-500 tabular-nums">
                                {e.hora_inicio?.slice(0, 5) ?? ""}
                                {e.hora_fin ? ` – ${e.hora_fin.slice(0, 5)}` : ""}
                              </div>
                              {e.cliente_nombre && (
                                <div className="mt-0.5 truncate text-[10px] text-slate-400">
                                  {e.cliente_nombre}
                                </div>
                              )}
                            </Link>
                          );
                        })
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
                <div className="py-16 text-center">
                  <div className="mx-auto mb-3 grid h-16 w-16 place-items-center rounded-full bg-slate-100 text-slate-400">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-8 w-8">
                      <path fillRule="evenodd" d="M6.75 2.25A.75.75 0 0 1 7.5 3v1.5h9V3A.75.75 0 0 1 18 3v1.5h.75a3 3 0 0 1 3 3v11.25a3 3 0 0 1-3 3H5.25a3 3 0 0 1-3-3V7.5a3 3 0 0 1 3-3H6V3a.75.75 0 0 1 .75-.75Zm13.5 9h-16.5v7.5a1.5 1.5 0 0 0 1.5 1.5h13.5a1.5 1.5 0 0 0 1.5-1.5v-7.5Z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <p className="text-sm font-medium text-slate-500">Sin eventos ese día</p>
                  <p className="mt-1 text-xs text-slate-400">Elegí otra fecha o cargá un evento nuevo.</p>
                </div>
              ) : (
                (eventosPorDia.get(toISODate(ancla)) ?? []).map((e) => {
                  const color = colorEvento(e);
                  return (
                    <Link
                      key={e.id}
                      href={`/eventos/${e.id}`}
                      className="flex items-center gap-4 rounded-xl border border-slate-100 bg-white p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:border-slate-200 hover:shadow-md"
                    >
                      <div className="flex flex-col items-center gap-1 rounded-lg px-3 py-2" style={{ backgroundColor: pastelBg(color) }}>
                        <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color }}>
                          {e.hora_inicio ? "Inicio" : "Todo el día"}
                        </span>
                        <span className="text-lg font-bold tabular-nums" style={{ color }}>
                          {e.hora_inicio ? e.hora_inicio.slice(0, 5) : "—"}
                        </span>
                        {e.hora_fin && (
                          <span className="text-[10px] tabular-nums text-slate-500">
                            → {e.hora_fin.slice(0, 5)}
                          </span>
                        )}
                      </div>
                      <span className="h-14 w-1 rounded" style={{ backgroundColor: color }} aria-hidden />
                      <div className="flex-1">
                        <div className="text-base font-semibold text-slate-800">{e.titulo}</div>
                        <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-slate-500">
                          {e.cliente_nombre && (
                            <span className="inline-flex items-center gap-1">
                              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5 text-slate-400">
                                <path fillRule="evenodd" d="M10 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM3 18a7 7 0 1 1 14 0H3Z" clipRule="evenodd" />
                              </svg>
                              {e.cliente_nombre}
                            </span>
                          )}
                          {(e.recurso_nombre || e.lugar_evento) && (
                            <span className="inline-flex items-center gap-1">
                              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5 text-slate-400">
                                <path fillRule="evenodd" d="m9.69 18.933.003.001C9.89 19.02 10 19 10 19s.11.02.308-.066l.002-.001.006-.003.018-.008a5.741 5.741 0 0 0 .281-.14c.186-.096.446-.24.757-.433.62-.384 1.445-.966 2.274-1.765C15.302 14.988 17 12.493 17 9A7 7 0 1 0 3 9c0 3.492 1.698 5.988 3.355 7.584a13.731 13.731 0 0 0 2.273 1.765 11.842 11.842 0 0 0 .976.544l.062.029.018.008.006.003ZM10 11.25a2.25 2.25 0 1 0 0-4.5 2.25 2.25 0 0 0 0 4.5Z" clipRule="evenodd" />
                              </svg>
                              {e.recurso_nombre ?? e.lugar_evento}
                            </span>
                          )}
                        </div>
                      </div>
                      <span
                        className="rounded-full px-3 py-1 text-[11px] font-semibold"
                        style={{ backgroundColor: pastelBg(color), color }}
                      >
                        {(e as { estado_nombre?: string }).estado_nombre ?? "—"}
                      </span>
                    </Link>
                  );
                })
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
