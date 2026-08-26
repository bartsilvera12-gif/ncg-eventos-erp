import type { ReactNode } from "react";

/**
 * Estado vacio estandar del ERP.
 * Rediseño 2026: icono con anillo pastel doble para dar profundidad.
 */
export default function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`flex flex-col items-center justify-center px-6 py-12 text-center ${className ?? ""}`}
    >
      {icon ? (
        <div className="relative mb-4 grid h-16 w-16 place-items-center rounded-full bg-gradient-to-br from-[#E5F4F4] to-white text-3xl text-[#3F8E91] shadow-inner ring-1 ring-[#4FAEB2]/20">
          <span aria-hidden className="absolute -inset-1 rounded-full ring-1 ring-[#4FAEB2]/10" />
          {icon}
        </div>
      ) : null}
      <p className="text-base font-semibold text-slate-700">{title}</p>
      {description ? (
        <p className="mt-1 max-w-sm text-sm text-slate-500">{description}</p>
      ) : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}
