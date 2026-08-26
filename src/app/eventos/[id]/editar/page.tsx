"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import PageHeader from "@/components/ui/PageHeader";
import Button from "@/components/ui/Button";
import { getClientes } from "@/lib/clientes/storage";
import { getEvento, getRecursos, updateEvento } from "@/lib/eventos/storage";
import type { Cliente } from "@/lib/clientes/types";
import type { Recurso } from "@/lib/eventos/types";

const inputClass =
  "rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#0EA5E9]";

function nombreCliente(c: Cliente): string {
  return c.tipo_cliente === "empresa" && c.empresa ? c.empresa : c.nombre_contacto;
}

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

export default function EditarEventoPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const eventoId = params?.id ?? "";

  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [recursos, setRecursos] = useState<Recurso[]>([]);
  const [cargando, setCargando] = useState(true);

  const [clienteId, setClienteId] = useState("");
  const [titulo, setTitulo] = useState("");
  const [tipoEvento, setTipoEvento] = useState("");
  const [fechaEvento, setFechaEvento] = useState("");
  const [horaInicio, setHoraInicio] = useState("");
  const [horaFin, setHoraFin] = useState("");
  const [lugarEvento, setLugarEvento] = useState("");
  const [cantidadInvitados, setCantidadInvitados] = useState("");
  const [recursoId, setRecursoId] = useState("");
  const [observaciones, setObservaciones] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!eventoId) return;
    Promise.all([getClientes(), getRecursos(), getEvento(eventoId)]).then(([cs, rs, ev]) => {
      setClientes(cs);
      setRecursos(rs);
      if (ev) {
        setClienteId((ev.cliente_id ?? "") as string);
        setTitulo(ev.titulo ?? "");
        setTipoEvento(ev.tipo_evento ?? "");
        setFechaEvento((ev.fecha_evento ?? "").slice(0, 10));
        setHoraInicio((ev.hora_inicio ?? "").slice(0, 5));
        setHoraFin((ev.hora_fin ?? "").slice(0, 5));
        setLugarEvento(ev.lugar_evento ?? "");
        setCantidadInvitados(ev.cantidad_invitados != null ? String(ev.cantidad_invitados) : "");
        setRecursoId((ev.recurso_id ?? "") as string);
        setObservaciones((ev as { observaciones_comerciales?: string | null }).observaciones_comerciales ?? "");
      }
      setCargando(false);
    });
  }, [eventoId]);

  const onGuardar = async () => {
    setError(null);
    if (!titulo.trim()) return setError("Cargá el nombre del evento.");
    setGuardando(true);
    const ev = await updateEvento(eventoId, {
      cliente_id: clienteId || null,
      titulo: titulo.trim(),
      tipo_evento: tipoEvento || null,
      fecha_evento: fechaEvento || null,
      hora_inicio: horaInicio || null,
      hora_fin: horaFin || null,
      lugar_evento: lugarEvento.trim() || null,
      cantidad_invitados: cantidadInvitados ? parseInt(cantidadInvitados) : null,
      recurso_id: recursoId || null,
      observaciones_comerciales: observaciones.trim() || null,
    } as Record<string, unknown>);
    setGuardando(false);
    if (!ev) {
      setError("No se pudo guardar. Si el salón/horario está ocupado, elegí otro.");
      return;
    }
    router.push(`/eventos/${eventoId}`);
  };

  if (cargando) {
    return (
      <div className="min-h-screen bg-slate-50 px-4 py-8 lg:px-8">
        <div className="mx-auto max-w-4xl text-center text-sm text-slate-400">Cargando evento…</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-8 lg:px-8">
      <div className="mx-auto max-w-4xl">
        <PageHeader
          eyebrow="NCG · Eventos"
          title="Editar evento"
          description="Modificá los datos del evento y guardá."
          backHref={`/eventos/${eventoId}`}
        />

        <div className="mt-6 grid grid-cols-1 gap-4 rounded-2xl border border-slate-200 bg-gradient-to-b from-white to-slate-50/40 p-5 shadow-sm md:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm md:col-span-2">
            <span className="font-medium text-slate-700">Nombre del evento</span>
            <input
              type="text"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder="Ej: Boda García – Ramírez"
              className={inputClass}
            />
          </label>

          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-slate-700">Cliente</span>
            <select
              value={clienteId}
              onChange={(e) => setClienteId(e.target.value)}
              className={inputClass}
            >
              <option value="">Sin cliente</option>
              {clientes.map((c) => (
                <option key={c.id} value={c.id}>
                  {nombreCliente(c)}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-slate-700">Tipo de evento</span>
            <select
              value={tipoEvento}
              onChange={(e) => setTipoEvento(e.target.value)}
              className={inputClass}
            >
              <option value="">Sin especificar</option>
              {TIPOS_EVENTO.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-slate-700">Fecha</span>
            <input
              type="date"
              value={fechaEvento}
              onChange={(e) => setFechaEvento(e.target.value)}
              className={inputClass}
            />
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-slate-700">Hora inicio</span>
              <input
                type="time"
                value={horaInicio}
                onChange={(e) => setHoraInicio(e.target.value)}
                className={inputClass}
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-slate-700">Hora fin</span>
              <input
                type="time"
                value={horaFin}
                onChange={(e) => setHoraFin(e.target.value)}
                className={inputClass}
              />
            </label>
          </div>

          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-slate-700">Cantidad de invitados</span>
            <input
              type="number"
              min={0}
              value={cantidadInvitados}
              onChange={(e) => setCantidadInvitados(e.target.value)}
              className={inputClass}
            />
          </label>

          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-slate-700">Salón/recurso propio (opcional)</span>
            <select
              value={recursoId}
              onChange={(e) => setRecursoId(e.target.value)}
              className={inputClass}
            >
              <option value="">Sin recurso propio</option>
              {recursos.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.nombre} {r.capacidad ? `· ${r.capacidad} pax` : ""}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1 text-sm md:col-span-2">
            <span className="font-medium text-slate-700">Lugar del evento (dirección o descripción)</span>
            <input
              type="text"
              value={lugarEvento}
              onChange={(e) => setLugarEvento(e.target.value)}
              placeholder="Dirección, salón externo, etc."
              className={inputClass}
            />
          </label>

          <label className="flex flex-col gap-1 text-sm md:col-span-2">
            <span className="font-medium text-slate-700">Observaciones</span>
            <textarea
              value={observaciones}
              onChange={(e) => setObservaciones(e.target.value)}
              rows={3}
              className={inputClass}
            />
          </label>
        </div>

        {error ? (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        <div className="mt-6 flex justify-end gap-2">
          <Button variant="secondary" href={`/eventos/${eventoId}`}>
            Cancelar
          </Button>
          <Button variant="primary" onClick={onGuardar} disabled={guardando}>
            {guardando ? "Guardando…" : "Guardar cambios"}
          </Button>
        </div>
      </div>
    </div>
  );
}
