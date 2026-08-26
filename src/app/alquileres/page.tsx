"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import PageHeader from "@/components/ui/PageHeader";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import { getAlquileres } from "@/lib/alquileres/storage";
import type { Alquiler, EstadoAlquiler } from "@/lib/alquileres/types";

function formatMoney(n: number) {
  return `€ ${n.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatFecha(iso: string) {
  try {
    const d = new Date(iso);
    return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
  } catch {
    return iso;
  }
}

const ESTADO_COLOR: Record<EstadoAlquiler, "neutral" | "success" | "warning" | "danger"> = {
  reservado: "warning",
  activo: "success",
  finalizado: "neutral",
  anulado: "danger",
};

export default function AlquileresPage() {
  const [lista, setLista] = useState<Alquiler[]>([]);
  const [busqueda, setBusqueda] = useState("");
  const [filtroEstado, setFiltroEstado] = useState<EstadoAlquiler | "">("");
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    let cancel = false;
    getAlquileres()
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
    return lista.filter((a) => {
      if (filtroEstado && a.estado !== filtroEstado) return false;
      if (q && !(a.cliente_nombre ?? "").toLowerCase().includes(q)) return false;
      return true;
    });
  }, [lista, busqueda, filtroEstado]);

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-8 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <PageHeader
          eyebrow="NCG · Eventos"
          title="Alquileres"
          description="Reservas y contratos de alquiler de insumos para eventos."
          actions={
            <Link href="/alquileres/nuevo">
              <Button variant="primary">+ Nuevo alquiler</Button>
            </Link>
          }
        />

        <div className="mt-6 flex flex-wrap gap-2">
          <input
            type="search"
            placeholder="Buscar por cliente…"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#0EA5E9]"
          />
          <select
            value={filtroEstado}
            onChange={(e) => setFiltroEstado(e.target.value as EstadoAlquiler | "")}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#0EA5E9]"
          >
            <option value="">Todos los estados</option>
            <option value="reservado">Reservado</option>
            <option value="activo">Activo</option>
            <option value="finalizado">Finalizado</option>
            <option value="anulado">Anulado</option>
          </select>
        </div>

        <div className="mt-4 overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-gradient-to-r from-slate-50 via-teal-50/30 to-slate-50 text-left text-xs uppercase tracking-wider text-slate-600 border-b border-slate-200">
              <tr>
                <th className="px-4 py-3">Cliente</th>
                <th className="px-4 py-3">Inicio</th>
                <th className="px-4 py-3">Fin</th>
                <th className="px-4 py-3">Estado</th>
                <th className="px-4 py-3 text-right">Total</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {cargando ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                    Cargando…
                  </td>
                </tr>
              ) : filtrados.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                    Sin alquileres todavía.
                  </td>
                </tr>
              ) : (
                filtrados.map((a) => (
                  <tr key={a.id} className="border-t border-slate-100 hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium text-slate-800">
                      {a.cliente_nombre ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{formatFecha(a.fecha_inicio)}</td>
                    <td className="px-4 py-3 text-slate-600">{formatFecha(a.fecha_fin)}</td>
                    <td className="px-4 py-3">
                      <Badge tone={ESTADO_COLOR[a.estado]}>{a.estado}</Badge>
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-slate-800">
                      {formatMoney(a.total)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/alquileres/${a.id}`}
                        className="text-sm font-medium text-[#0EA5E9] hover:underline"
                      >
                        Ver
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
