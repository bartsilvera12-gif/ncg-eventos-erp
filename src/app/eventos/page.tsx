"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import PageHeader from "@/components/ui/PageHeader";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { getEventos, deleteEvento } from "@/lib/eventos/storage";
import type { Evento } from "@/lib/eventos/types";

function fmtFecha(iso?: string | null) {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
  } catch {
    return iso;
  }
}
function fmtMoney(n?: number) {
  return `€ ${(n ?? 0).toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const ESTADO_TONE: Record<string, "neutral" | "primary" | "info" | "warning" | "success" | "danger"> = {
  consulta: "neutral",
  presupuestado: "info",
  reservado: "warning",
  confirmado: "success",
  en_preparacion: "primary",
  realizado: "success",
  cancelado: "danger",
};

export default function EventosPage() {
  const [lista, setLista] = useState<Evento[]>([]);
  const [cargando, setCargando] = useState(true);
  const [busqueda, setBusqueda] = useState("");
  const [eventoAEliminar, setEventoAEliminar] = useState<Evento | null>(null);
  const [eliminando, setEliminando] = useState(false);

  useEffect(() => {
    let cancel = false;
    getEventos()
      .then((d) => {
        if (!cancel) setLista(d);
      })
      .finally(() => {
        if (!cancel) setCargando(false);
      });
    return () => {
      cancel = true;
    };
  }, []);

  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return lista;
    return lista.filter(
      (e) =>
        e.titulo.toLowerCase().includes(q) ||
        (e.cliente_nombre ?? "").toLowerCase().includes(q) ||
        (e.tipo_evento ?? "").toLowerCase().includes(q)
    );
  }, [lista, busqueda]);

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-8 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <PageHeader
          eyebrow="NCG · Eventos"
          title="Eventos"
          description="Gestión de bodas, cumpleaños, corporativos y celebraciones."
          actions={
            <div className="flex gap-2">
              <Link href="/eventos/calendario">
                <Button variant="secondary">Calendario</Button>
              </Link>
              <Link href="/eventos/nuevo">
                <Button variant="primary">+ Nuevo evento</Button>
              </Link>
            </div>
          }
        />

        <div className="mt-6 flex gap-2">
          <input
            type="search"
            placeholder="Buscar por título, cliente, tipo…"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="w-full max-w-md rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#0EA5E9]"
          />
        </div>

        <div className="mt-4 overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-gradient-to-r from-slate-50 via-teal-50/30 to-slate-50 text-left text-xs uppercase tracking-wider text-slate-600 border-b border-slate-200">
              <tr>
                <th className="px-4 py-3">Evento</th>
                <th className="px-4 py-3">Tipo</th>
                <th className="px-4 py-3">Fecha</th>
                <th className="px-4 py-3">Lugar</th>
                <th className="px-4 py-3 text-right">Invitados</th>
                <th className="px-4 py-3">Estado</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {cargando ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                    Cargando…
                  </td>
                </tr>
              ) : filtrados.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                    Sin eventos.
                  </td>
                </tr>
              ) : (
                filtrados.map((e) => (
                  <tr key={e.id} className="border-t border-slate-100 hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-800">{e.titulo}</div>
                      <div className="text-xs text-slate-500">{e.cliente_nombre ?? "—"}</div>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{e.tipo_evento ?? "—"}</td>
                    <td className="px-4 py-3 text-slate-600">
                      {fmtFecha(e.fecha_evento)}
                      {e.hora_inicio ? (
                        <span className="ml-1 text-xs text-slate-400">
                          {e.hora_inicio}
                          {e.hora_fin ? `–${e.hora_fin}` : ""}
                        </span>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {e.recurso_nombre ?? e.lugar_evento ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-right text-slate-600">
                      {e.cantidad_invitados ?? "—"}
                    </td>
                    <td className="px-4 py-3">
                      <Badge tone={ESTADO_TONE[e.estado_codigo ?? "consulta"] ?? "neutral"}>
                        {e.estado_nombre ?? e.estado_codigo ?? "—"}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1.5">
                        <Link
                          href={`/eventos/${e.id}`}
                          className="group/act inline-flex items-center gap-1 rounded-lg border border-[#4FAEB2]/30 bg-white px-2.5 py-1.5 text-xs font-semibold text-[#3F8E91] shadow-sm transition-all hover:-translate-y-0.5 hover:border-[#4FAEB2] hover:bg-[#E5F4F4] hover:shadow-md"
                          title="Ver detalle"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5 transition-transform group-hover/act:scale-110">
                            <path d="M10 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z" />
                            <path fillRule="evenodd" d="M.664 10.59a1.651 1.651 0 0 1 0-1.186A10.004 10.004 0 0 1 10 3c4.257 0 7.893 2.66 9.336 6.41.147.381.146.804 0 1.186A10.004 10.004 0 0 1 10 17c-4.257 0-7.893-2.66-9.336-6.41ZM14 10a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z" clipRule="evenodd" />
                          </svg>
                          Ver
                        </Link>
                        <Link
                          href={`/eventos/${e.id}/editar`}
                          className="group/act inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-600 shadow-sm transition-all hover:-translate-y-0.5 hover:border-slate-300 hover:bg-slate-50 hover:text-slate-800 hover:shadow-md"
                          title="Editar evento"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5 transition-transform group-hover/act:scale-110">
                            <path d="m5.433 13.917 1.262-3.155A4 4 0 0 1 7.58 9.42l6.92-6.918a2.121 2.121 0 0 1 3 3l-6.92 6.918c-.383.383-.84.685-1.343.886l-3.154 1.262a.5.5 0 0 1-.65-.65Z" />
                            <path d="M3.5 5.75c0-.69.56-1.25 1.25-1.25H10A.75.75 0 0 0 10 3H4.75A2.75 2.75 0 0 0 2 5.75v9.5A2.75 2.75 0 0 0 4.75 18h9.5A2.75 2.75 0 0 0 17 15.25V10a.75.75 0 0 0-1.5 0v5.25c0 .69-.56 1.25-1.25 1.25h-9.5c-.69 0-1.25-.56-1.25-1.25v-9.5Z" />
                          </svg>
                          Editar
                        </Link>
                        <button
                          type="button"
                          onClick={() => setEventoAEliminar(e)}
                          className="group/act inline-flex items-center gap-1 rounded-lg border border-red-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-red-600 shadow-sm transition-all hover:-translate-y-0.5 hover:border-red-300 hover:bg-red-50 hover:text-red-700 hover:shadow-md"
                          title="Eliminar evento"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5 transition-transform group-hover/act:scale-110">
                            <path fillRule="evenodd" d="M8.75 1A2.75 2.75 0 0 0 6 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 1 0 .23 1.482l.149-.022.841 10.518A2.75 2.75 0 0 0 7.596 19h4.807a2.75 2.75 0 0 0 2.742-2.53l.841-10.52.149.023a.75.75 0 0 0 .23-1.482A41.03 41.03 0 0 0 14 4.193V3.75A2.75 2.75 0 0 0 11.25 1h-2.5ZM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4Z" clipRule="evenodd" />
                          </svg>
                          Eliminar
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <ConfirmDialog
        open={eventoAEliminar !== null}
        title="Eliminar evento"
        message={
          eventoAEliminar ? (
            <>
              ¿Seguro que querés eliminar <span className="font-semibold text-slate-800">{`"${eventoAEliminar.titulo}"`}</span>? Esta acción es definitiva.
            </>
          ) : null
        }
        confirmLabel="Eliminar"
        tone="danger"
        busy={eliminando}
        onConfirm={async () => {
          if (!eventoAEliminar) return;
          setEliminando(true);
          const r = await deleteEvento(eventoAEliminar.id);
          setEliminando(false);
          if (r.ok) {
            setLista((prev) => prev.filter((x) => x.id !== eventoAEliminar.id));
            setEventoAEliminar(null);
          } else {
            window.alert(r.error);
          }
        }}
        onClose={() => { if (!eliminando) setEventoAEliminar(null); }}
      />
    </div>
  );
}
