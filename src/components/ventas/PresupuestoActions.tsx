"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { fetchWithSupabaseSession } from "@/lib/api/fetch-with-supabase-session";

type Tipo = "venta" | "presupuesto";
type Estado = "pendiente" | "aprobado" | "rechazado" | "convertido" | null;

/**
 * Render del badge + acciones para tipo_documento / estado_presupuesto de una venta.
 *
 * - Si tipo='venta': solo badge "Venta directa". No se puede convertir a
 *   presupuesto después: una venta real ya descontó stock y generó movimientos.
 *   El presupuesto debe nacer desde "Nuevo presupuesto de obra".
 * - Si tipo='presupuesto':
 *    - badge "Presupuesto de obra" + badge de estado.
 *    - pendiente → botones [Aprobar] [Rechazar].
 *    - aprobado  → botón [Convertir en obra].
 *    - convertido → link [Ver obra].
 *    - rechazado  → solo badge.
 */
export default function PresupuestoActions({
  id,
  tipo,
  estado,
  proyectoId,
}: {
  id: string;
  tipo: Tipo;
  estado: Estado;
  /** Si está vinculado a una obra (después de convertir), se usa para el botón "Ver obra". */
  proyectoId?: string | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function patchWorkflow(body: Record<string, unknown>) {
    setBusy(true);
    setErr(null);
    try {
      const r = await fetchWithSupabaseSession(`/api/ventas/${id}/workflow`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const j = (await r.json().catch(() => ({}))) as { success?: boolean; error?: string };
      if (!r.ok || !j.success) {
        setErr(j.error ?? "No se pudo actualizar");
        return;
      }
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function convertir() {
    if (!confirm("¿Convertir este presupuesto en obra? Se creará una nueva obra y el presupuesto quedará vinculado.")) return;
    setBusy(true);
    setErr(null);
    try {
      const r = await fetchWithSupabaseSession(`/api/ventas/${id}/convertir-obra`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const j = (await r.json().catch(() => ({}))) as { success?: boolean; error?: string; data?: { proyecto?: { id: string; titulo: string } } };
      if (!r.ok || !j.success) {
        setErr(j.error ?? "No se pudo convertir");
        return;
      }
      const proy = j.data?.proyecto;
      if (proy?.id) {
        // Llevar al usuario directo a la obra creada
        window.location.href = `/dashboard/proyectos/${proy.id}`;
        return;
      }
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-wrap items-center gap-1">
        {tipo === "presupuesto" ? (
          <>
            <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-indigo-700">
              Presupuesto de obra
            </span>
            {estado && <EstadoBadge estado={estado} />}
          </>
        ) : (
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-600">
            Venta directa
          </span>
        )}
      </div>

      <div className="flex flex-wrap gap-1.5">
        {tipo === "presupuesto" && estado === "pendiente" && (
          <>
            <button type="button" disabled={busy}
              onClick={() => patchWorkflow({ estado_presupuesto: "aprobado" })}
              className="text-[11px] text-emerald-700 hover:text-emerald-900 underline disabled:opacity-50">
              aprobar
            </button>
            <button type="button" disabled={busy}
              onClick={() => patchWorkflow({ estado_presupuesto: "rechazado" })}
              className="text-[11px] text-red-700 hover:text-red-900 underline disabled:opacity-50">
              rechazar
            </button>
          </>
        )}

        {tipo === "presupuesto" && estado === "aprobado" && (
          <button type="button" disabled={busy}
            onClick={convertir}
            className="text-[11px] font-medium text-[#3F8E91] hover:text-[#2F6F72] underline disabled:opacity-50">
            convertir en obra
          </button>
        )}

        {tipo === "presupuesto" && estado === "convertido" && proyectoId && (
          <a href={`/dashboard/proyectos/${proyectoId}`}
            className="text-[11px] font-medium text-[#3F8E91] hover:text-[#2F6F72] underline">
            ver obra
          </a>
        )}
      </div>

      {err && <span className="text-[11px] text-red-600">{err}</span>}
    </div>
  );
}

function EstadoBadge({ estado }: { estado: Exclude<Estado, null> }) {
  const cfg: Record<string, { bg: string; text: string; label: string }> = {
    pendiente:  { bg: "bg-amber-50",    text: "text-amber-700",    label: "Pendiente" },
    aprobado:   { bg: "bg-emerald-50",  text: "text-emerald-700",  label: "Aprobado" },
    rechazado:  { bg: "bg-red-50",      text: "text-red-700",      label: "Rechazado" },
    convertido: { bg: "bg-[#E5F4F4]",   text: "text-[#3F8E91]",    label: "Convertido" },
  };
  const c = cfg[estado] ?? cfg.pendiente;
  return (
    <span className={`rounded-full ${c.bg} px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${c.text}`}>
      {c.label}
    </span>
  );
}
