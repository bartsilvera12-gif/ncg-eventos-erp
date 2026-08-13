"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import PageHeader from "@/components/ui/PageHeader";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import { getEventos, saveEventoConError } from "@/lib/eventos/storage";
import { getClientes } from "@/lib/clientes/storage";
import type { Cliente } from "@/lib/clientes/types";
import type { Evento, EstadoPresupuesto } from "@/lib/eventos/types";

const TIPOS_EVENTO = [
  "Boda",
  "Cumpleaños",
  "Corporativo",
  "15 años",
  "Aniversario",
  "Comunión",
  "Bautismo",
  "Otro",
];

function nombreCliente(c: Cliente): string {
  return c.tipo_cliente === "empresa" && c.empresa ? c.empresa : c.nombre_contacto;
}

interface PresupuestoGlobal {
  id: string;
  version: number;
  estado: EstadoPresupuesto;
  fecha: string;
  total: number | string;
  observaciones: string | null;
  aprobado_at: string | null;
  created_at: string;
  proyecto_id: string;
  evento_titulo: string | null;
  evento_fecha: string | null;
  cliente_nombre: string | null;
}

const ESTADO_TONE: Record<EstadoPresupuesto, "neutral" | "info" | "success" | "danger"> = {
  borrador: "neutral",
  enviado: "info",
  aprobado: "success",
  rechazado: "danger",
};

function fmtMoney(n: number | string) {
  const v = typeof n === "string" ? Number(n) || 0 : n;
  return `Gs. ${Math.round(v).toLocaleString("es-PY")}`;
}
function fmtFecha(iso?: string | null) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("es-PY");
  } catch {
    return iso;
  }
}

export default function PresupuestosGlobalPage() {
  const router = useRouter();
  const [lista, setLista] = useState<PresupuestoGlobal[]>([]);
  const [cargando, setCargando] = useState(true);
  const [filtroEstado, setFiltroEstado] = useState<EstadoPresupuesto | "">("");
  const [busqueda, setBusqueda] = useState("");

  // Crear presupuesto: dos modos.
  //  - "existente": elegir un evento del catálogo → deep-link a su tab presupuestos.
  //  - "nuevo": crear evento mínimo (cliente + título + fecha) y saltar directo
  //    al form de presupuesto de ese evento nuevo. El form real vive en
  //    /eventos/[id]?tab=presupuestos&nuevo=1.
  const [selectorAbierto, setSelectorAbierto] = useState(false);
  const [modoCreacion, setModoCreacion] = useState<"nuevo" | "existente">("nuevo");
  const [eventosLista, setEventosLista] = useState<Evento[]>([]);
  const [clientesLista, setClientesLista] = useState<Cliente[]>([]);
  const [eventoElegido, setEventoElegido] = useState<string>("");
  const [nuevoClienteId, setNuevoClienteId] = useState<string>("");
  const [nuevoTitulo, setNuevoTitulo] = useState<string>("");
  const [nuevoTipo, setNuevoTipo] = useState<string>("");
  const [nuevoFecha, setNuevoFecha] = useState<string>("");
  const [creando, setCreando] = useState(false);
  const [errorCrear, setErrorCrear] = useState<string | null>(null);

  const abrirSelector = async () => {
    setSelectorAbierto(true);
    setErrorCrear(null);
    if (eventosLista.length === 0 || clientesLista.length === 0) {
      const [es, cs] = await Promise.all([getEventos(), getClientes()]);
      setEventosLista(es);
      setClientesLista(cs);
    }
  };
  const cerrarSelector = () => {
    setSelectorAbierto(false);
    setEventoElegido("");
    setNuevoClienteId("");
    setNuevoTitulo("");
    setNuevoTipo("");
    setNuevoFecha("");
    setErrorCrear(null);
  };
  const irAlEvento = () => {
    if (!eventoElegido) return;
    router.push(`/eventos/${eventoElegido}?tab=presupuestos&nuevo=1`);
  };
  const crearEventoYPresupuesto = async () => {
    setErrorCrear(null);
    if (!nuevoClienteId) return setErrorCrear("Elegí un cliente.");
    if (!nuevoTitulo.trim()) return setErrorCrear("Cargá el nombre del evento.");
    setCreando(true);
    const res = await saveEventoConError({
      cliente_id: nuevoClienteId,
      titulo: nuevoTitulo.trim(),
      tipo_evento: nuevoTipo || null,
      fecha_evento: nuevoFecha || null,
    });
    setCreando(false);
    if (!res.ok) {
      setErrorCrear(res.error);
      return;
    }
    router.push(`/eventos/${res.evento.id}?tab=presupuestos&nuevo=1`);
  };

  useEffect(() => {
    let cancel = false;
    setCargando(true);
    const qs = filtroEstado ? `?estado=${filtroEstado}` : "";
    fetch(`/api/eventos/presupuestos${qs}`, { credentials: "include", cache: "no-store" })
      .then((r) => r.json())
      .then((j) => {
        if (!cancel && j?.success) setLista((j.data?.presupuestos ?? []) as PresupuestoGlobal[]);
      })
      .finally(() => {
        if (!cancel) setCargando(false);
      });
    return () => {
      cancel = true;
    };
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

  const totalAprobado = lista
    .filter((p) => p.estado === "aprobado")
    .reduce((s, p) => s + (Number(p.total) || 0), 0);

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-8 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <PageHeader
          eyebrow="NCG · Eventos"
          title="Presupuestos"
          description="Presupuestos de todos los eventos. Cada uno pertenece a un evento."
          backHref="/eventos"
          actions={
            <Button variant="primary" size="sm" onClick={abrirSelector}>
              + Nuevo presupuesto
            </Button>
          }
        />

        {selectorAbierto && (
          <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4">
            <div className="mb-3 flex gap-1 rounded-lg bg-slate-100 p-1 text-xs">
              <button
                onClick={() => setModoCreacion("nuevo")}
                className={`flex-1 rounded-md px-3 py-1.5 font-medium transition-colors ${
                  modoCreacion === "nuevo" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
                }`}
              >
                Evento nuevo
              </button>
              <button
                onClick={() => setModoCreacion("existente")}
                className={`flex-1 rounded-md px-3 py-1.5 font-medium transition-colors ${
                  modoCreacion === "existente" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
                }`}
              >
                Evento existente
              </button>
            </div>

            {modoCreacion === "nuevo" ? (
              <>
                <p className="mb-2 text-sm text-slate-600">
                  Cargá los datos mínimos del evento; luego se abre el form del presupuesto.
                </p>
                <div className="grid grid-cols-1 gap-2 md:grid-cols-4">
                  <label className="flex flex-col gap-1 text-xs md:col-span-2">
                    <span className="font-medium text-slate-600">Cliente *</span>
                    <select
                      value={nuevoClienteId}
                      onChange={(e) => setNuevoClienteId(e.target.value)}
                      className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#0EA5E9]"
                    >
                      <option value="">Seleccionar cliente…</option>
                      {clientesLista.map((c) => (
                        <option key={c.id} value={c.id}>
                          {nombreCliente(c)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="flex flex-col gap-1 text-xs md:col-span-2">
                    <span className="font-medium text-slate-600">Título del evento *</span>
                    <input
                      type="text"
                      value={nuevoTitulo}
                      onChange={(e) => setNuevoTitulo(e.target.value)}
                      placeholder="Ej. Boda Pérez–Gómez"
                      className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#0EA5E9]"
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-xs">
                    <span className="font-medium text-slate-600">Tipo</span>
                    <select
                      value={nuevoTipo}
                      onChange={(e) => setNuevoTipo(e.target.value)}
                      className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#0EA5E9]"
                    >
                      <option value="">—</option>
                      {TIPOS_EVENTO.map((t) => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                  </label>
                  <label className="flex flex-col gap-1 text-xs">
                    <span className="font-medium text-slate-600">Fecha del evento</span>
                    <input
                      type="date"
                      value={nuevoFecha}
                      onChange={(e) => setNuevoFecha(e.target.value)}
                      className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#0EA5E9]"
                    />
                  </label>
                </div>
                {errorCrear && (
                  <p className="mt-2 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs text-red-700">
                    {errorCrear}
                  </p>
                )}
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button variant="primary" size="sm" onClick={crearEventoYPresupuesto} disabled={creando}>
                    {creando ? "Creando…" : "Crear evento y continuar"}
                  </Button>
                  <Button variant="secondary" size="sm" onClick={cerrarSelector}>
                    Cancelar
                  </Button>
                </div>
                <p className="mt-2 text-xs text-slate-400">
                  Podés completar el resto (horario, lugar, invitados…) más tarde desde el detalle del evento.
                </p>
              </>
            ) : (
              <>
                <p className="mb-2 text-sm text-slate-600">
                  Elegí un evento existente:
                </p>
                <div className="flex flex-wrap gap-2">
                  <select
                    value={eventoElegido}
                    onChange={(e) => setEventoElegido(e.target.value)}
                    className="min-w-[280px] rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#0EA5E9]"
                  >
                    <option value="">Seleccionar evento…</option>
                    {eventosLista.map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.titulo}
                        {e.fecha_evento ? ` — ${e.fecha_evento}` : ""}
                        {e.cliente_nombre ? ` (${e.cliente_nombre})` : ""}
                      </option>
                    ))}
                  </select>
                  <Button variant="primary" size="sm" onClick={irAlEvento} disabled={!eventoElegido}>
                    Ir al evento
                  </Button>
                  <Button variant="secondary" size="sm" onClick={cerrarSelector}>
                    Cancelar
                  </Button>
                </div>
              </>
            )}
          </div>
        )}

        <div className="mt-6 flex flex-wrap gap-2">
          <input
            type="search"
            placeholder="Buscar por evento o cliente…"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#0EA5E9]"
          />
          <select
            value={filtroEstado}
            onChange={(e) => setFiltroEstado(e.target.value as EstadoPresupuesto | "")}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#0EA5E9]"
          >
            <option value="">Todos los estados</option>
            <option value="borrador">Borrador</option>
            <option value="enviado">Enviado</option>
            <option value="aprobado">Aprobado</option>
            <option value="rechazado">Rechazado</option>
          </select>
          <div className="ml-auto rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
            Aprobado total: <strong>{fmtMoney(totalAprobado)}</strong>
          </div>
        </div>

        <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-4 py-3">Evento</th>
                <th className="px-4 py-3">Cliente</th>
                <th className="px-4 py-3">Fecha evento</th>
                <th className="px-4 py-3">Fecha ppto.</th>
                <th className="px-4 py-3 text-right">Versión</th>
                <th className="px-4 py-3 text-right">Total</th>
                <th className="px-4 py-3">Estado</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {cargando ? (
                <tr>
                  <td colSpan={8} className="px-4 py-6 text-center text-slate-400">
                    Cargando…
                  </td>
                </tr>
              ) : filtrados.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-6 text-center text-slate-400">
                    Sin presupuestos.
                  </td>
                </tr>
              ) : (
                filtrados.map((p) => (
                  <tr key={p.id} className="border-t border-slate-100 hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <Link
                        href={`/eventos/${p.proyecto_id}`}
                        className="font-medium text-slate-800 hover:underline"
                      >
                        {p.evento_titulo ?? "—"}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{p.cliente_nombre ?? "—"}</td>
                    <td className="px-4 py-3 text-slate-600">{fmtFecha(p.evento_fecha)}</td>
                    <td className="px-4 py-3 text-slate-600">{fmtFecha(p.fecha)}</td>
                    <td className="px-4 py-3 text-right text-slate-600">v{p.version}</td>
                    <td className="px-4 py-3 text-right font-semibold text-slate-800">
                      {fmtMoney(p.total)}
                    </td>
                    <td className="px-4 py-3">
                      <Badge tone={ESTADO_TONE[p.estado]}>{p.estado}</Badge>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/eventos/${p.proyecto_id}`}
                        className="text-xs text-[#0EA5E9] hover:underline"
                      >
                        Ver evento
                      </Link>
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
