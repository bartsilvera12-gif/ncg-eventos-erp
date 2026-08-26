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
  return `€ ${(n ?? 0).toLocaleString("es-PY")}`;
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

        <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wider text-slate-500">
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
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-3">
                        <Link
                          href={`/eventos/${e.id}`}
                          className="text-sm font-medium text-[#0EA5E9] hover:underline"
                        >
                          Ver
                        </Link>
                        <Link
                          href={`/eventos/${e.id}/editar`}
                          className="text-sm font-medium text-slate-500 hover:text-slate-700 hover:underline"
                        >
                          Editar
                        </Link>
                        <button
                          type="button"
                          onClick={() => setEventoAEliminar(e)}
                          className="text-sm font-medium text-red-600 hover:text-red-700 hover:underline"
                          title="Eliminar evento"
                        >
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
