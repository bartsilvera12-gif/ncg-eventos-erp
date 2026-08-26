"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import PageHeader from "@/components/ui/PageHeader";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import { getAlquilerDetalle, updateAlquilerEstado } from "@/lib/alquileres/storage";
import type { Alquiler, AlquilerItem, EstadoAlquiler } from "@/lib/alquileres/types";

function fmtMoney(n: number) {
  return `€ ${n.toLocaleString("es-PY")}`;
}

function fmtFecha(iso: string) {
  try {
    const d = new Date(iso);
    return d.toLocaleString("es-PY");
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

export default function AlquilerDetallePage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;
  const [alquiler, setAlquiler] = useState<Alquiler | null>(null);
  const [items, setItems] = useState<AlquilerItem[]>([]);
  const [cargando, setCargando] = useState(true);
  const [actualizando, setActualizando] = useState(false);

  useEffect(() => {
    if (!id) return;
    let cancel = false;
    getAlquilerDetalle(id)
      .then((d) => {
        if (cancel || !d) return;
        setAlquiler(d.alquiler);
        setItems(d.items);
      })
      .finally(() => {
        if (!cancel) setCargando(false);
      });
    return () => {
      cancel = true;
    };
  }, [id]);

  const cambiarEstado = async (nuevo: EstadoAlquiler) => {
    if (!id || !alquiler) return;
    setActualizando(true);
    const ok = await updateAlquilerEstado(id, nuevo);
    if (ok) setAlquiler({ ...alquiler, estado: nuevo });
    setActualizando(false);
  };

  if (cargando) {
    return (
      <div className="min-h-screen bg-slate-50 px-4 py-8">
        <p className="text-center text-slate-400">Cargando…</p>
      </div>
    );
  }

  if (!alquiler) {
    return (
      <div className="min-h-screen bg-slate-50 px-4 py-8">
        <p className="text-center text-slate-400">Alquiler no encontrado.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-8 lg:px-8">
      <div className="mx-auto max-w-5xl">
        <PageHeader
          eyebrow="NCG · Eventos"
          title={`Alquiler · ${alquiler.cliente_nombre ?? "—"}`}
          description={`${fmtFecha(alquiler.fecha_inicio)} → ${fmtFecha(alquiler.fecha_fin)}`}
          backHref="/alquileres"
          actions={<Badge tone={ESTADO_COLOR[alquiler.estado]}>{alquiler.estado}</Badge>}
        />

        <div className="mt-6 rounded-2xl border border-slate-200 bg-gradient-to-b from-white to-slate-50/40 p-5 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-500">
            Items
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-2 py-2">Producto</th>
                  <th className="px-2 py-2 text-right">Cantidad</th>
                  <th className="px-2 py-2">Unidad</th>
                  <th className="px-2 py-2 text-right">Duración</th>
                  <th className="px-2 py-2 text-right">Tarifa</th>
                  <th className="px-2 py-2 text-right">Subtotal</th>
                </tr>
              </thead>
              <tbody>
                {items.map((it) => (
                  <tr key={it.id} className="border-t border-slate-100">
                    <td className="px-2 py-2 font-medium text-slate-800">
                      {it.producto_nombre}
                    </td>
                    <td className="px-2 py-2 text-right text-slate-600">{it.cantidad}</td>
                    <td className="px-2 py-2 text-slate-600">{it.unidad}</td>
                    <td className="px-2 py-2 text-right text-slate-600">
                      {it.cantidad_unidades}
                    </td>
                    <td className="px-2 py-2 text-right text-slate-600">
                      {fmtMoney(it.tarifa_unitaria)}
                    </td>
                    <td className="px-2 py-2 text-right font-semibold text-slate-800">
                      {fmtMoney(it.subtotal)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-slate-200">
                  <td colSpan={5} className="px-2 py-3 text-right text-sm text-slate-500">
                    Total
                  </td>
                  <td className="px-2 py-3 text-right text-lg font-bold text-slate-800">
                    {fmtMoney(alquiler.total)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {alquiler.observaciones ? (
            <p className="mt-4 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">
              <strong className="font-medium text-slate-700">Observaciones:</strong>{" "}
              {alquiler.observaciones}
            </p>
          ) : null}
        </div>

        <div className="mt-6 flex flex-wrap justify-end gap-2">
          {alquiler.estado === "reservado" && (
            <Button variant="primary" onClick={() => cambiarEstado("activo")} disabled={actualizando}>
              Marcar activo
            </Button>
          )}
          {alquiler.estado === "activo" && (
            <Button variant="primary" onClick={() => cambiarEstado("finalizado")} disabled={actualizando}>
              Finalizar
            </Button>
          )}
          {alquiler.estado !== "anulado" && alquiler.estado !== "finalizado" && (
            <Button variant="danger" onClick={() => cambiarEstado("anulado")} disabled={actualizando}>
              Anular
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
