import type { ReactNode } from "react";

/**
 * Superficie de contenido estandar del ERP.
 *
 * Rediseño 2026: gradiente sutil white→slate-50/30, ring turquesa y
 * transicion de sombra al hover para dar profundidad sin ser chillon.
 */
export default function Card({
  children,
  className,
  padded = true,
  hover = false,
}: {
  children: ReactNode;
  className?: string;
  /** Aplica padding interno comodo (p-6). Desactivar para tablas a sangre. */
  padded?: boolean;
  /** Habilita elevacion suave en hover (para cards clickeables). */
  hover?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border border-slate-200 bg-gradient-to-b from-white to-slate-50/40 shadow-sm ring-1 ring-[#4FAEB2]/10 ${
        hover ? "transition-all hover:-translate-y-0.5 hover:shadow-md hover:ring-[#4FAEB2]/20" : ""
      } ${padded ? "p-5 sm:p-6" : ""} ${className ?? ""}`}
    >
      {children}
    </div>
  );
}

/**
 * Encabezado de seccion dentro de una Card (titulo + descripcion + accion).
 */
export function CardHeader({
  title,
  description,
  action,
}: {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="mb-4 flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 pb-3">
      <div className="min-w-0">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-700">{title}</h3>
        {description ? <p className="mt-0.5 text-xs text-slate-400">{description}</p> : null}
      </div>
      {action ? <div className="flex items-center gap-2">{action}</div> : null}
    </div>
  );
}
