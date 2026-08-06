"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import PageHeader from "@/components/ui/PageHeader";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import {
  borrarFoto,
  getEvento,
  getGaleria,
  getPagosEvento,
  getPresupuestos,
  getRentabilidadEvento,
  getReservasStock,
  getServiciosEvento,
  registrarFoto,
  updatePresupuestoEstado,
  type FotoEvento,
} from "@/lib/eventos/storage";
import { supabase } from "@/lib/supabase";
import type {
  Evento,
  EventoPresupuesto,
  EventoServicio,
  RentabilidadEvento,
  StockReserva,
} from "@/lib/eventos/types";
import type { PagosResumen } from "@/lib/eventos/storage";

type TabKey = "resumen" | "presupuestos" | "servicios" | "reservas" | "pagos" | "rentabilidad" | "galeria";

const TABS: { key: TabKey; label: string }[] = [
  { key: "resumen", label: "Resumen" },
  { key: "presupuestos", label: "Presupuestos" },
  { key: "servicios", label: "Servicios" },
  { key: "reservas", label: "Insumos reservados" },
  { key: "pagos", label: "Pagos" },
  { key: "rentabilidad", label: "Rentabilidad" },
  { key: "galeria", label: "Galería" },
];

function fmtMoney(n?: number) {
  return `€ ${(n ?? 0).toLocaleString("es-PY")}`;
}
function fmtFecha(iso?: string | null) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("es-PY");
  } catch {
    return iso;
  }
}

export default function EventoDetallePage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;
  const [evento, setEvento] = useState<Evento | null>(null);
  const [tab, setTab] = useState<TabKey>("resumen");
  const [presupuestos, setPresupuestos] = useState<EventoPresupuesto[]>([]);
  const [servicios, setServicios] = useState<EventoServicio[]>([]);
  const [reservas, setReservas] = useState<StockReserva[]>([]);
  const [pagos, setPagos] = useState<PagosResumen | null>(null);
  const [rent, setRent] = useState<RentabilidadEvento | null>(null);
  const [fotos, setFotos] = useState<FotoEvento[]>([]);
  const [subiendo, setSubiendo] = useState(false);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    if (!id) return;
    Promise.all([
      getEvento(id),
      getPresupuestos(id),
      getServiciosEvento(id),
      getReservasStock(id),
      getPagosEvento(id),
      getRentabilidadEvento(id),
      getGaleria(id),
    ])
      .then(([e, ps, ss, rs, pg, rt, fg]) => {
        setEvento(e);
        setPresupuestos(ps);
        setServicios(ss);
        setReservas(rs);
        setPagos(pg);
        setRent(rt);
        setFotos(fg);
      })
      .finally(() => setCargando(false));
  }, [id]);

  const subirFotos = async (files: FileList | null) => {
    if (!id || !files || files.length === 0) return;
    setSubiendo(true);
    try {
      for (const file of Array.from(files)) {
        const ext = file.name.split(".").pop() ?? "jpg";
        const path = `${id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from("proyectos")
          .upload(path, file, { cacheControl: "3600", upsert: false });
        if (upErr) {
          console.error("[galeria] upload:", upErr.message);
          continue;
        }
        await registrarFoto(id, {
          nombre: file.name,
          storage_path: path,
          storage_bucket: "proyectos",
          mime_type: file.type,
          size_bytes: file.size,
        });
      }
      setFotos(await getGaleria(id));
    } finally {
      setSubiendo(false);
    }
  };

  const eliminarFoto = async (fotoId: string) => {
    if (!id || !confirm("¿Eliminar esta foto?")) return;
    await borrarFoto(id, fotoId);
    setFotos((prev) => prev.filter((f) => f.id !== fotoId));
  };

  if (cargando) {
    return (
      <div className="min-h-screen bg-slate-50 px-4 py-8">
        <p className="text-center text-slate-400">Cargando…</p>
      </div>
    );
  }
  if (!evento) {
    return (
      <div className="min-h-screen bg-slate-50 px-4 py-8">
        <p className="text-center text-slate-400">Evento no encontrado.</p>
      </div>
    );
  }

  const aprobar = async (presupuestoId: string) => {
    if (!id) return;
    const ok = await updatePresupuestoEstado(id, presupuestoId, "aprobado");
    if (ok) setPresupuestos((prev) => prev.map((p) => (p.id === presupuestoId ? { ...p, estado: "aprobado" } : p)));
  };

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-8 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <PageHeader
          eyebrow="NCG · Eventos"
          title={evento.titulo}
          description={`${evento.cliente_nombre ?? "Cliente"} · ${fmtFecha(evento.fecha_evento)}${evento.hora_inicio ? ` · ${evento.hora_inicio}` : ""}${evento.hora_fin ? `–${evento.hora_fin}` : ""}`}
          backHref="/eventos"
          actions={
            <Badge tone="info">
              {evento.estado_nombre ?? evento.estado_codigo ?? "—"}
            </Badge>
          }
        />

        <div className="mt-6 border-b border-slate-200">
          <nav className="-mb-px flex gap-1 overflow-x-auto">
            {TABS.map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`whitespace-nowrap border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
                  tab === t.key
                    ? "border-[#0EA5E9] text-[#0EA5E9]"
                    : "border-transparent text-slate-500 hover:text-slate-700"
                }`}
              >
                {t.label}
              </button>
            ))}
          </nav>
        </div>

        <div className="mt-5">
          {tab === "resumen" && (
            <div className="grid grid-cols-1 gap-4 rounded-xl border border-slate-200 bg-white p-5 md:grid-cols-2">
              <Field label="Tipo de evento" value={evento.tipo_evento} />
              <Field label="Cantidad de invitados" value={evento.cantidad_invitados?.toString()} />
              <Field label="Salón / recurso" value={evento.recurso_nombre} />
              <Field label="Lugar del evento" value={evento.lugar_evento} />
              <Field label="Fecha" value={fmtFecha(evento.fecha_evento)} />
              <Field
                label="Horario"
                value={
                  evento.hora_inicio
                    ? `${evento.hora_inicio}${evento.hora_fin ? ` – ${evento.hora_fin}` : ""}`
                    : "—"
                }
              />
              {evento.observaciones && (
                <div className="md:col-span-2">
                  <p className="text-xs font-medium uppercase tracking-wider text-slate-500">
                    Observaciones
                  </p>
                  <p className="mt-1 text-sm text-slate-700">{evento.observaciones}</p>
                </div>
              )}
            </div>
          )}

          {tab === "presupuestos" && (
            <div className="rounded-xl border border-slate-200 bg-white p-5">
              {presupuestos.length === 0 ? (
                <p className="py-6 text-center text-sm text-slate-400">
                  Sin presupuestos. Podés armar uno desde el detalle.
                </p>
              ) : (
                <div className="space-y-3">
                  {presupuestos.map((p) => (
                    <div
                      key={p.id}
                      className="rounded-lg border border-slate-100 bg-slate-50 p-3 text-sm"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-slate-800">
                          Versión {p.version}
                        </span>
                        <Badge
                          tone={
                            p.estado === "aprobado"
                              ? "success"
                              : p.estado === "enviado"
                              ? "info"
                              : p.estado === "rechazado"
                              ? "danger"
                              : "neutral"
                          }
                        >
                          {p.estado}
                        </Badge>
                      </div>
                      <div className="mt-1 flex justify-between text-xs text-slate-500">
                        <span>{fmtFecha(p.fecha)}</span>
                        <span className="font-semibold text-slate-800">{fmtMoney(p.total)}</span>
                      </div>
                      {p.estado !== "aprobado" && p.estado !== "rechazado" && (
                        <div className="mt-2 flex justify-end">
                          <Button variant="secondary" size="sm" onClick={() => aprobar(p.id)}>
                            Marcar aprobado
                          </Button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {tab === "servicios" && (
            <div className="rounded-xl border border-slate-200 bg-white p-5">
              {servicios.length === 0 ? (
                <p className="py-6 text-center text-sm text-slate-400">
                  Sin servicios contratados.
                </p>
              ) : (
                <table className="w-full text-sm">
                  <thead className="text-left text-xs uppercase tracking-wider text-slate-500">
                    <tr>
                      <th className="py-2">Descripción</th>
                      <th className="py-2 text-right">Cant.</th>
                      <th className="py-2 text-right">Precio</th>
                      <th className="py-2 text-right">Subtotal</th>
                      <th className="py-2">Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {servicios.map((s) => (
                      <tr key={s.id} className="border-t border-slate-100">
                        <td className="py-2 text-slate-800">{s.descripcion}</td>
                        <td className="py-2 text-right text-slate-600">{s.cantidad}</td>
                        <td className="py-2 text-right text-slate-600">{fmtMoney(s.precio_unitario)}</td>
                        <td className="py-2 text-right font-semibold text-slate-800">
                          {fmtMoney(s.subtotal)}
                        </td>
                        <td className="py-2">
                          <Badge tone={s.estado === "cancelado" ? "danger" : s.estado === "entregado" ? "success" : "neutral"}>
                            {s.estado}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {tab === "reservas" && (
            <div className="rounded-xl border border-slate-200 bg-white p-5">
              {reservas.length === 0 ? (
                <p className="py-6 text-center text-sm text-slate-400">
                  Sin insumos reservados.
                </p>
              ) : (
                <table className="w-full text-sm">
                  <thead className="text-left text-xs uppercase tracking-wider text-slate-500">
                    <tr>
                      <th className="py-2">Producto</th>
                      <th className="py-2 text-right">Cantidad</th>
                      <th className="py-2">Desde</th>
                      <th className="py-2">Hasta</th>
                      <th className="py-2">Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reservas.map((r) => (
                      <tr key={r.id} className="border-t border-slate-100">
                        <td className="py-2 text-slate-800">{r.producto_nombre ?? "—"}</td>
                        <td className="py-2 text-right text-slate-600">{r.cantidad}</td>
                        <td className="py-2 text-slate-600">{fmtFecha(r.fecha_inicio)}</td>
                        <td className="py-2 text-slate-600">{fmtFecha(r.fecha_fin)}</td>
                        <td className="py-2">
                          <Badge tone={r.estado === "anulado" ? "danger" : r.estado === "devuelto" ? "neutral" : "info"}>
                            {r.estado}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {tab === "pagos" && pagos && (
            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                <SummaryCard label="Presupuesto" value={fmtMoney(pagos.total_presupuesto)} />
                <SummaryCard label="Cobrado" value={fmtMoney(pagos.total_cobrado)} tone="success" />
                <SummaryCard label="Saldo" value={fmtMoney(pagos.saldo_pendiente)} tone={pagos.saldo_pendiente > 0 ? "danger" : "neutral"} />
                <SummaryCard label="Estado" value={pagos.esta_pagado ? "Pagado ✓" : "Pendiente"} tone={pagos.esta_pagado ? "success" : "warning"} />
              </div>
              {pagos.pagos.length > 0 && (
                <table className="mt-4 w-full text-sm">
                  <thead className="text-left text-xs uppercase tracking-wider text-slate-500">
                    <tr>
                      <th className="py-2">Fecha</th>
                      <th className="py-2">Medio</th>
                      <th className="py-2 text-right">Monto</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pagos.pagos.map((p) => (
                      <tr key={p.id} className="border-t border-slate-100">
                        <td className="py-2 text-slate-600">{fmtFecha(p.fecha)}</td>
                        <td className="py-2 text-slate-600">{p.medio ?? "—"}</td>
                        <td className="py-2 text-right font-semibold text-slate-800">
                          {fmtMoney(p.monto)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {tab === "rentabilidad" && rent && (
            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                <SummaryCard label="Cobrado" value={fmtMoney(rent.total_cobrado)} tone="success" />
                <SummaryCard label="Costos" value={fmtMoney(rent.total_costos)} tone="danger" />
                <SummaryCard
                  label="Ganancia"
                  value={fmtMoney(rent.ganancia)}
                  tone={rent.ganancia >= 0 ? "success" : "danger"}
                />
                <SummaryCard label="Margen" value={`${rent.margen_pct.toFixed(2)}%`} />
              </div>
              <p className="mt-3 text-xs text-slate-500">
                Costos = compras + gastos + servicios contratados imputados a este evento.
              </p>
            </div>
          )}

          {tab === "galeria" && (
            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <div className="mb-4 flex items-center justify-between">
                <p className="text-sm text-slate-500">
                  {fotos.length} foto{fotos.length !== 1 ? "s" : ""}
                </p>
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-[#4FAEB2] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#3F8E91]">
                  {subiendo ? "Subiendo…" : "+ Subir fotos"}
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    disabled={subiendo}
                    onChange={(e) => subirFotos(e.target.files)}
                  />
                </label>
              </div>

              {fotos.length === 0 ? (
                <p className="py-10 text-center text-sm text-slate-400">
                  Sin fotos todavía. Subí las primeras.
                </p>
              ) : (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
                  {fotos.map((f) => (
                    <div
                      key={f.id}
                      className="group relative overflow-hidden rounded-lg border border-slate-100 bg-slate-100"
                    >
                      {f.url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={f.url}
                          alt={f.nombre}
                          className="aspect-square w-full object-cover"
                        />
                      ) : (
                        <div className="flex aspect-square items-center justify-center text-xs text-slate-400">
                          Sin vista previa
                        </div>
                      )}
                      <button
                        onClick={() => eliminarFoto(f.id)}
                        className="absolute right-1 top-1 rounded-full bg-red-600/80 px-2 py-0.5 text-[10px] text-white opacity-0 transition-opacity group-hover:opacity-100"
                      >
                        Eliminar
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wider text-slate-500">{label}</p>
      <p className="mt-1 text-sm text-slate-700">{value || "—"}</p>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: string;
  tone?: "neutral" | "success" | "warning" | "danger";
}) {
  const cls =
    tone === "success"
      ? "bg-emerald-50 text-emerald-700"
      : tone === "warning"
      ? "bg-amber-50 text-amber-700"
      : tone === "danger"
      ? "bg-red-50 text-red-700"
      : "bg-slate-50 text-slate-700";
  return (
    <div className={`rounded-lg px-3 py-2 text-sm ${cls}`}>
      <p className="text-[11px] font-medium uppercase tracking-wider opacity-80">{label}</p>
      <p className="mt-0.5 text-base font-bold">{value}</p>
    </div>
  );
}
