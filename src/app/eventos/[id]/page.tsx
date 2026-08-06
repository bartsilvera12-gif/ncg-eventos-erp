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
  getPaquetes,
  getPresupuestos,
  getRentabilidadEvento,
  getReservasStock,
  getServicios,
  getServiciosEvento,
  registrarFoto,
  savePresupuesto,
  updatePresupuestoEstado,
  type FotoEvento,
} from "@/lib/eventos/storage";
import { supabase } from "@/lib/supabase";
import type {
  Evento,
  EventoPresupuesto,
  EventoServicio,
  Paquete,
  RentabilidadEvento,
  ServicioCatalogo,
  StockReserva,
  TipoItemPresupuesto,
} from "@/lib/eventos/types";
import type { PagosResumen } from "@/lib/eventos/storage";

interface PresupuestoLineaDraft {
  tipo: TipoItemPresupuesto;
  ref_id: string | null;
  descripcion: string;
  cantidad: number;
  precio_unitario: number;
}

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

  // Form de nuevo presupuesto (solo cuando se abre)
  const [ppFormAbierto, setPpFormAbierto] = useState(false);
  const [ppFecha, setPpFecha] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [ppValidez, setPpValidez] = useState<string>("30");
  const [ppObs, setPpObs] = useState<string>("");
  const [ppLineas, setPpLineas] = useState<PresupuestoLineaDraft[]>([]);
  const [ppGuardando, setPpGuardando] = useState(false);
  const [ppError, setPpError] = useState<string | null>(null);
  const [catServicios, setCatServicios] = useState<ServicioCatalogo[]>([]);
  const [catPaquetes, setCatPaquetes] = useState<Paquete[]>([]);
  const [catCargado, setCatCargado] = useState(false);

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

  // ── Presupuesto: form ────────────────────────────────────────────────────
  const abrirFormPresupuesto = async () => {
    setPpFormAbierto(true);
    setPpError(null);
    if (!catCargado) {
      const [ss, ps] = await Promise.all([getServicios(), getPaquetes()]);
      setCatServicios(ss);
      setCatPaquetes(ps);
      setCatCargado(true);
    }
  };
  const cerrarFormPresupuesto = () => {
    setPpFormAbierto(false);
    setPpLineas([]);
    setPpObs("");
    setPpValidez("30");
    setPpError(null);
  };
  const addLinea = (tipo: TipoItemPresupuesto = "servicio") => {
    setPpLineas((prev) => [
      ...prev,
      { tipo, ref_id: null, descripcion: "", cantidad: 1, precio_unitario: 0 },
    ]);
  };
  const updateLinea = (idx: number, patch: Partial<PresupuestoLineaDraft>) => {
    setPpLineas((prev) =>
      prev.map((l, i) => {
        if (i !== idx) return l;
        const merged = { ...l, ...patch };
        // Autofill al elegir referencia del catálogo.
        if (patch.ref_id !== undefined && patch.ref_id) {
          if (merged.tipo === "servicio") {
            const s = catServicios.find((x) => x.id === patch.ref_id);
            if (s) {
              if (!merged.descripcion) merged.descripcion = s.nombre;
              if (!merged.precio_unitario) merged.precio_unitario = s.precio_base;
            }
          } else if (merged.tipo === "paquete") {
            const p = catPaquetes.find((x) => x.id === patch.ref_id);
            if (p) {
              if (!merged.descripcion) merged.descripcion = p.nombre;
              if (!merged.precio_unitario) merged.precio_unitario = p.precio_total;
            }
          }
        }
        // Al cambiar tipo, resetear ref_id.
        if (patch.tipo !== undefined && patch.tipo !== l.tipo) {
          merged.ref_id = null;
        }
        return merged;
      })
    );
  };
  const removeLinea = (idx: number) => {
    setPpLineas((prev) => prev.filter((_, i) => i !== idx));
  };
  const ppTotal = ppLineas.reduce((s, l) => s + l.cantidad * l.precio_unitario, 0);
  const guardarPresupuesto = async () => {
    if (!id) return;
    setPpError(null);
    if (ppLineas.length === 0) {
      setPpError("Agregá al menos una línea.");
      return;
    }
    for (const l of ppLineas) {
      if (!l.descripcion.trim()) {
        setPpError("Todas las líneas necesitan descripción.");
        return;
      }
      if (l.cantidad <= 0) {
        setPpError("La cantidad debe ser mayor a 0.");
        return;
      }
    }
    setPpGuardando(true);
    const res = await savePresupuesto({
      proyecto_id: id,
      fecha: ppFecha,
      validez_dias: parseInt(ppValidez) || null,
      observaciones: ppObs.trim() || null,
      items: ppLineas.map((l, i) => ({
        tipo: l.tipo,
        ref_id: l.ref_id,
        descripcion: l.descripcion.trim(),
        cantidad: l.cantidad,
        precio_unitario: l.precio_unitario,
        sort_order: i,
      })),
    });
    setPpGuardando(false);
    if (!res) {
      setPpError("No se pudo guardar el presupuesto.");
      return;
    }
    setPresupuestos(await getPresupuestos(id));
    cerrarFormPresupuesto();
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
            <div className="space-y-4">
              <div className="flex justify-end">
                {!ppFormAbierto && (
                  <Button variant="primary" size="sm" onClick={abrirFormPresupuesto}>
                    + Nuevo presupuesto
                  </Button>
                )}
              </div>

              {ppFormAbierto && (
                <div className="rounded-xl border border-slate-200 bg-white p-5">
                  <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-500">
                    Nuevo presupuesto
                  </h3>
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                    <label className="flex flex-col gap-1 text-xs">
                      <span className="font-medium text-slate-600">Fecha</span>
                      <input
                        type="date"
                        value={ppFecha}
                        onChange={(e) => setPpFecha(e.target.value)}
                        className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                      />
                    </label>
                    <label className="flex flex-col gap-1 text-xs">
                      <span className="font-medium text-slate-600">Validez (días)</span>
                      <input
                        type="number"
                        min={1}
                        value={ppValidez}
                        onChange={(e) => setPpValidez(e.target.value)}
                        className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                      />
                    </label>
                    <label className="flex flex-col gap-1 text-xs md:col-span-1">
                      <span className="font-medium text-slate-600">Observaciones</span>
                      <input
                        type="text"
                        value={ppObs}
                        onChange={(e) => setPpObs(e.target.value)}
                        placeholder="Opcional"
                        className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                      />
                    </label>
                  </div>

                  <div className="mt-4">
                    <div className="mb-2 flex items-center justify-between">
                      <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                        Líneas
                      </h4>
                      <div className="flex gap-1">
                        <Button variant="secondary" size="sm" onClick={() => addLinea("servicio")}>
                          + Servicio
                        </Button>
                        <Button variant="secondary" size="sm" onClick={() => addLinea("paquete")}>
                          + Paquete
                        </Button>
                        <Button variant="secondary" size="sm" onClick={() => addLinea("texto")}>
                          + Texto libre
                        </Button>
                      </div>
                    </div>

                    {ppLineas.length === 0 ? (
                      <p className="rounded-lg border border-dashed border-slate-200 py-4 text-center text-xs text-slate-400">
                        Agregá al menos una línea.
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {ppLineas.map((l, idx) => (
                          <div
                            key={idx}
                            className="grid grid-cols-12 gap-2 rounded-lg border border-slate-100 bg-slate-50 p-2"
                          >
                            <span className="col-span-2 flex items-center text-[11px] font-semibold uppercase text-slate-500">
                              {l.tipo}
                            </span>
                            {l.tipo === "servicio" ? (
                              <select
                                value={l.ref_id ?? ""}
                                onChange={(e) => updateLinea(idx, { ref_id: e.target.value || null })}
                                className="col-span-4 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm"
                              >
                                <option value="">Seleccionar servicio…</option>
                                {catServicios.map((s) => (
                                  <option key={s.id} value={s.id}>
                                    {s.nombre}
                                  </option>
                                ))}
                              </select>
                            ) : l.tipo === "paquete" ? (
                              <select
                                value={l.ref_id ?? ""}
                                onChange={(e) => updateLinea(idx, { ref_id: e.target.value || null })}
                                className="col-span-4 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm"
                              >
                                <option value="">Seleccionar paquete…</option>
                                {catPaquetes.map((p) => (
                                  <option key={p.id} value={p.id}>
                                    {p.nombre}
                                  </option>
                                ))}
                              </select>
                            ) : (
                              <span className="col-span-4" />
                            )}
                            <input
                              type="text"
                              value={l.descripcion}
                              onChange={(e) => updateLinea(idx, { descripcion: e.target.value })}
                              placeholder="Descripción"
                              className="col-span-3 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm"
                            />
                            <input
                              type="number"
                              min={1}
                              value={l.cantidad}
                              onChange={(e) => updateLinea(idx, { cantidad: parseFloat(e.target.value) || 0 })}
                              className="col-span-1 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-right text-sm"
                            />
                            <input
                              type="number"
                              step="0.01"
                              min={0}
                              value={l.precio_unitario}
                              onChange={(e) => updateLinea(idx, { precio_unitario: parseFloat(e.target.value) || 0 })}
                              className="col-span-1 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-right text-sm"
                            />
                            <span className="col-span-1 flex items-center justify-end text-right text-sm font-semibold text-slate-800">
                              {fmtMoney(l.cantidad * l.precio_unitario)}
                            </span>
                            <button
                              onClick={() => removeLinea(idx)}
                              className="col-span-1 text-xs text-red-600 hover:underline"
                            >
                              Quitar
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="mt-3 flex items-center justify-end gap-3 border-t border-slate-100 pt-3">
                      <span className="text-sm text-slate-500">Total</span>
                      <span className="text-lg font-bold text-slate-800">{fmtMoney(ppTotal)}</span>
                    </div>
                  </div>

                  {ppError && (
                    <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                      {ppError}
                    </div>
                  )}

                  <div className="mt-4 flex justify-end gap-2">
                    <Button variant="secondary" onClick={cerrarFormPresupuesto}>
                      Cancelar
                    </Button>
                    <Button variant="primary" onClick={guardarPresupuesto} disabled={ppGuardando}>
                      {ppGuardando ? "Guardando…" : "Guardar presupuesto"}
                    </Button>
                  </div>
                </div>
              )}

              <div className="rounded-xl border border-slate-200 bg-white p-5">
                {presupuestos.length === 0 ? (
                  <p className="py-6 text-center text-sm text-slate-400">
                    Sin presupuestos todavía.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {presupuestos.map((p) => (
                      <details
                        key={p.id}
                        className="rounded-lg border border-slate-100 bg-slate-50 p-3 text-sm"
                      >
                        <summary className="cursor-pointer">
                          <div className="inline-flex w-[calc(100%-1rem)] items-center justify-between">
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
                        </summary>

                        {p.items && p.items.length > 0 && (
                          <div className="mt-3 border-t border-slate-200 pt-3">
                            <table className="w-full text-xs">
                              <thead className="text-left text-[10px] uppercase text-slate-500">
                                <tr>
                                  <th className="py-1">Tipo</th>
                                  <th className="py-1">Descripción</th>
                                  <th className="py-1 text-right">Cant.</th>
                                  <th className="py-1 text-right">Precio</th>
                                  <th className="py-1 text-right">Subtotal</th>
                                </tr>
                              </thead>
                              <tbody>
                                {p.items.map((it) => (
                                  <tr key={it.id} className="border-t border-slate-100">
                                    <td className="py-1 capitalize text-slate-500">{it.tipo}</td>
                                    <td className="py-1 text-slate-700">{it.descripcion}</td>
                                    <td className="py-1 text-right text-slate-600">{it.cantidad}</td>
                                    <td className="py-1 text-right text-slate-600">
                                      {fmtMoney(it.precio_unitario)}
                                    </td>
                                    <td className="py-1 text-right font-semibold text-slate-800">
                                      {fmtMoney(it.subtotal)}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}

                        {p.estado !== "aprobado" && p.estado !== "rechazado" && (
                          <div className="mt-3 flex justify-end">
                            <Button variant="secondary" size="sm" onClick={() => aprobar(p.id)}>
                              Marcar aprobado
                            </Button>
                          </div>
                        )}
                      </details>
                    ))}
                  </div>
                )}
              </div>
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
