import Link from "next/link";
import type { ReactNode } from "react";

/**
 * Encabezado de pagina estandar del ERP.
 *
 * Rediseño 2026: card contenedora con gradient sutil white→slate, borde inferior
 * de acento teal, eyebrow con badge pastel + dot pulsante, backHref con chevron.
 * Usar SIEMPRE este componente para los headers de modulo.
 */
export default function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  backHref,
  backLabel = "Volver",
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
  backHref?: string;
  backLabel?: string;
}) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-gradient-to-br from-white via-white to-teal-50/40 p-5 shadow-sm sm:p-6">
      {/* Franja inferior con gradiente teal */}
      <span
        aria-hidden
        className="absolute inset-x-0 bottom-0 h-[3px] bg-gradient-to-r from-transparent via-[#4FAEB2] to-transparent opacity-70"
      />

      {backHref ? (
        <Link
          href={backHref}
          className="mb-3 inline-flex items-center gap-1 text-xs font-medium text-slate-500 transition-colors hover:text-[#3F8E91]"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
            <path fillRule="evenodd" d="M12.79 5.23a.75.75 0 0 1-.02 1.06L8.832 10l3.938 3.71a.75.75 0 1 1-1.04 1.08l-4.5-4.25a.75.75 0 0 1 0-1.08l4.5-4.25a.75.75 0 0 1 1.06.02Z" clipRule="evenodd" />
          </svg>
          {backLabel}
        </Link>
      ) : null}

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between">
        <div className="min-w-0">
          {eyebrow ? (
            <div className="inline-flex items-center gap-2 rounded-full bg-[#E5F4F4] px-2.5 py-1 ring-1 ring-[#4FAEB2]/15">
              <span
                aria-hidden
                className="inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-[#4FAEB2] animate-pulse"
                style={{ boxShadow: "0 0 0 3px rgba(79, 174, 178, 0.18)" }}
              />
              <p className="truncate text-[10px] font-bold uppercase tracking-[0.16em] text-[#3F8E91]">
                {eyebrow}
              </p>
            </div>
          ) : null}
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900">{title}</h1>
          {description ? (
            <p className="mt-1 max-w-2xl text-sm text-slate-500">{description}</p>
          ) : null}
        </div>
        {actions ? (
          <div className="flex flex-wrap items-center gap-2 sm:justify-end">{actions}</div>
        ) : null}
      </div>
    </div>
  );
}
