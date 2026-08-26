import type { ReactNode } from "react";

/**
 * KPI card del ERP.
 *
 * Rediseño 2026: barra de acento superior en color teal, gradiente sutil,
 * icono en circulito pastel, elevacion en hover para dar depth. Sigue
 * respondiendo a `accent` (metrica principal) y `compact` (versiones densas).
 */
export default function StatCard({
  label,
  value,
  icon,
  hint,
  accent = false,
  compact = false,
  className,
}: {
  label: string;
  value: ReactNode;
  icon?: ReactNode;
  /** Texto secundario debajo del valor. */
  hint?: ReactNode;
  /** Resalta el valor + barra superior mas gruesa (para la metrica principal). */
  accent?: boolean;
  /** Version sobria: menos padding, valor mas chico y truncado (1 linea). */
  compact?: boolean;
  className?: string;
}) {
  return (
    <div
      className={`group relative overflow-hidden rounded-2xl border border-slate-200 bg-gradient-to-b from-white to-slate-50/40 shadow-sm ring-1 ring-[#4FAEB2]/10 transition-all hover:-translate-y-0.5 hover:shadow-md hover:ring-[#4FAEB2]/20 ${
        compact ? "p-3.5" : "p-5"
      } ${className ?? ""}`}
    >
      {/* Barra superior de acento */}
      <span
        aria-hidden
        className={`absolute inset-x-0 top-0 h-[3px] ${
          accent
            ? "bg-gradient-to-r from-[#4FAEB2] via-[#3F8E91] to-[#4FAEB2]"
            : "bg-gradient-to-r from-transparent via-[#4FAEB2]/40 to-transparent"
        }`}
      />
      <div className="flex items-start justify-between gap-3">
        <p className="truncate text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
          {label}
        </p>
        {icon ? (
          <span
            className={`inline-grid shrink-0 place-items-center rounded-full bg-[#E5F4F4] text-base leading-none text-[#3F8E91] transition-transform group-hover:scale-110 ${
              compact ? "h-6 w-6 text-xs" : "h-8 w-8"
            }`}
          >
            {icon}
          </span>
        ) : null}
      </div>
      <p
        className={`mt-1 font-bold tracking-tight ${
          compact ? "truncate text-base" : "mt-2 text-2xl"
        } ${accent ? "bg-gradient-to-r from-[#3F8E91] to-[#2F6F72] bg-clip-text text-transparent" : "text-slate-900"}`}
        title={compact && typeof value === "string" ? value : undefined}
      >
        {value}
      </p>
      {hint ? (
        <p
          className={`mt-1 text-xs text-slate-400 ${compact ? "truncate" : ""}`}
          title={compact && typeof hint === "string" ? hint : undefined}
        >
          {hint}
        </p>
      ) : null}
    </div>
  );
}
