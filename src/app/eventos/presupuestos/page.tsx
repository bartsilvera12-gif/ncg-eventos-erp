"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import PageHeader from "@/components/ui/PageHeader";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import NuevaCotizacionModal from "./_components/NuevaCotizacionModal";
import type { EstadoPresupuesto } from "@/lib/eventos/types";

interface PresupuestoGlobal {
  id: string;
  version: number;
  estado: EstadoPresupuesto;
  fecha: string;
  total: number | string;
  observaciones: string | null;
  aprobado_at: string | null;
  created_at: string;
  proyecto_id: string | null;
  es_cotizacion: boolean;
  evento_titulo: string | null;
  evento_fecha: string | null;
  cliente_nombre: string | null;
  tipo_evento?: string | null;
  cantidad_invitados?: number | null;
}

const ESTADO_TONE: Record<EstadoPresupuesto, "neutral" | "info" | "success" | "danger"> = {
  borrador: "neutral",
  enviado: "info",
  aprobado: "success",
  rechazado: "danger",
};
const ESTADO_LABEL: Record<EstadoPresupuesto, string> = {
  borrador: "Borrador",
  enviado: "Enviado",
  aprobado: "Aprobado",
  rechazado: "Rechazado",
};

function fmtMoney(n: number | string) {
  const v = typeof n === "string" ? Number(n) || 0 : n;
  return `€ ${v.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function fmtFecha(iso?: string | null) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("es-ES");
  } catch {
    return iso;
  }
}

export default function PresupuestosGlobalPage() {
  const [lista, setLista] = useState<PresupuestoGlobal[]>([]);
  const [cargando, setCargando] = useState(true);
  const [filtroEstado, setFiltroEstado] = useState<EstadoPresupuesto | "">("");
  const [busqueda, setBusqueda] = useState("");
  const [modalOpen, setModalOpen] = useState(false);

  const recargar = async () => {
    setCargando(true);
    const qs = filtroEstado ? `?estado=${filtroEstado}` : "";
    try {
      const r = await fetch(`/api/eventos/presupuestos${qs}`, {
        credentials: "include",
        cache: "no-store",
      });
      const j = await r.json().catch(() => ({}));
      if ((j as { success?: boolean }).success) {
        setLista(((j as { data?: { presupuestos?: PresupuestoGlobal[] } }).data?.presupuestos ?? []));
      }
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    void recargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtroEstado]);

  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return lista;
    return lista.filter(
      (p) =>
        (p.evento_titulo ?? "").toLowerCase().includes(q) ||
        (p.cliente_nombre ?? "").toLowerCase().includes(q)
    );
  }, [lista, busqueda]);

  const stats = useMemo(() => {
    const cotizaciones = lista.filter((p) => p.es_cotizacion && p.estado === "borrador").length;
    const pendientes = lista.filter((p) => p.estado === "borrador" || p.estado === "enviado").length;
    const aprobados = lista.filter((p) => p.estado === "aprobado");
    const totalAprobado = aprobados.reduce((s, p) => s + (Number(p.total) || 0), 0);
    return { cotizaciones, pendientes, aprobados: aprobados.length, totalAprobado };
  }, [lista]);

  const cambiarEstado = async (id: string, estado: EstadoPresupuesto) => {
    const r = await fetch(`/api/eventos/presupuestos/${id}`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ estado }),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || !(j as { success?: boolean }).success) {
      alert((j as { error?: string }).error ?? `Error ${r.status}`);
      return;
    }
    await recargar();
  };

  const eliminar = async (id: string) => {
    if (!confirm("¿Eliminar esta cotización? No se puede deshacer.")) return;
    const r = await fetch(`/api/eventos/presupuestos/${id}`, {
      method: "DELETE",
      credentials: "include",
    });
    if (!r.ok) {
      const j = await r.json().catch(() => ({}));
      alert((j as { error?: string }).error ?? `Error ${r.status}`);
      return;
    }
    setLista((prev) => prev.filter((p) => p.id !== id));
  };

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-8 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <PageHeader
          eyebrow="NCG · Eventos"
          title="Presupuestos"
          description="Cotizaciones y presupuestos de todos los eventos."
          backHref="/eventos"
          actions={
            <Button variant="primary" size="sm" onClick={() => setModalOpen(true)}>
              + Nueva cotización
            </Button>
          }
        />

        {/* Stats */}
        <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
          <StatCard label="Cotizaciones pendientes" value={String(stats.cotizaciones)} tone="warning" />
          <StatCard label="Presupuestos pendientes" value={String(stats.pendientes)} tone="info" />
          <StatCard label="Aprobados" value={String(stats.aprobados)} tone="success" />
          <StatCard label="Total aprobado" value={fmtMoney(stats.totalAprobado)} tone="success" />
        </div>

        {/* Filtros */}
        <div className="mt-6 flex flex-wrap items-center gap-2">
          <input
            type="search"
            placeholder="Buscar por evento o cliente…"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="min-w-[240px] flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#4FAEB2]/40"
          />
          <select
            value={filtroEstado}
            onChange={(e) => setFiltroEstado(e.target.value as EstadoPresupuesto | "")}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#4FAEB2]/40"
          >
            <option value="">Todos los estados</option>
            <option value="borrador">Borrador</option>
            <option value="enviado">Enviado</option>
            <option value="aprobado">Aprobado</option>
            <option value="rechazado">Rechazado</option>
          </select>
        </div>

        {/* Lista tipo cards */}
        <div className="mt-4 space-y-3">
          {cargando ? (
            <div className="rounded-xl border border-slate-200 bg-white px-4 py-8 text-center text-sm text-slate-400">
              Cargando…
            </div>
          ) : filtrados.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 bg-white px-4 py-12 text-center text-sm text-slate-400">
              Sin presupuestos. Creá el primero con &quot;+ Nueva cotización&quot;.
            </div>
          ) : (
            filtrados.map((p) => (
              <div
                key={p.id}
                className="group rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      {p.proyecto_id ? (
                        <Link
                          href={`/eventos/${p.proyecto_id}`}
                          className="text-base font-semibold text-slate-800 hover:text-[#4FAEB2] hover:underline"
                        >
                          {p.evento_titulo ?? "—"}
                        </Link>
                      ) : (
                        <span className="text-base font-semibold text-slate-800">
                          {p.evento_titulo ?? "—"}
                        </span>
                      )}
                      <Badge tone={ESTADO_TONE[p.estado]}>{ESTADO_LABEL[p.estado]}</Badge>
                      {p.es_cotizacion && p.estado !== "aprobado" && (
                        <Badge tone="warning">Cotización</Badge>
                      )}
                      {p.tipo_evento && (
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600">
                          {p.tipo_evento}
                        </span>
                      )}
                    </div>
                    <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                      <span>👤 {p.cliente_nombre ?? "—"}</span>
                      <span>📅 Evento: {fmtFecha(p.evento_fecha)}</span>
                      <span>📝 Ppto.: {fmtFecha(p.fecha)}</span>
                      {p.cantidad_invitados != null && p.cantidad_invitados > 0 && (
                        <span>👥 {p.cantidad_invitados} invitados</span>
                      )}
                      <span className="text-slate-400">v{p.version}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-bold text-slate-900">{fmtMoney(p.total)}</div>
                    <div className="mt-2 flex flex-wrap justify-end gap-1">
                      {p.es_cotizacion && p.estado !== "aprobado" && p.estado !== "rechazado" && (
                        <>
                          <button
                            onClick={() => cambiarEstado(p.id, "aprobado")}
                            className="rounded-md bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 transition-colors hover:bg-emerald-100"
                          >
                            Aprobar
                          </button>
                          <button
                            onClick={() => cambiarEstado(p.id, "rechazado")}
                            className="rounded-md bg-red-50 px-2.5 py-1 text-xs font-medium text-red-700 transition-colors hover:bg-red-100"
                          >
                            Rechazar
                          </button>
                        </>
                      )}
                      {p.estado === "rechazado" && (
                        <button
                          onClick={() => eliminar(p.id)}
                          className="rounded-md bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-200"
                        >
                          Eliminar
                        </button>
                      )}
                      {p.proyecto_id && (
                        <Link
                          href={`/eventos/${p.proyecto_id}`}
                          className="rounded-md bg-[#4FAEB2]/10 px-2.5 py-1 text-xs font-medium text-[#3F8E91] transition-colors hover:bg-[#4FAEB2]/20"
                        >
                          Ver evento
                        </Link>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <NuevaCotizacionModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSaved={() => {
          void recargar();
        }}
      />
    </div>
  );
}

function StatCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "warning" | "info" | "success";
}) {
  const cls =
    tone === "warning"
      ? "bg-amber-50 text-amber-800 border-amber-200"
      : tone === "success"
      ? "bg-emerald-50 text-emerald-800 border-emerald-200"
      : "bg-sky-50 text-sky-800 border-sky-200";
  return (
    <div className={`rounded-xl border ${cls} px-4 py-3`}>
      <div className="text-[11px] font-medium uppercase tracking-wider opacity-80">{label}</div>
      <div className="mt-1 text-xl font-bold tabular-nums">{value}</div>
    </div>
  );
}
