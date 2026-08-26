import type { ReactNode } from "react";

/**
 * Etiqueta/badge del ERP. Tonos sobrios con ring de definicion.
 * Rediseño 2026: ring del mismo color para separacion sobre fondos claros.
 */
export type BadgeTone = "neutral" | "primary" | "success" | "warning" | "danger" | "info";

const tones: Record<BadgeTone, string> = {
  neutral: "bg-slate-100 text-slate-700 ring-slate-200",
  primary: "bg-[#E5F4F4] text-[#2F6F72] ring-[#4FAEB2]/25",
  success: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  warning: "bg-amber-50 text-amber-700 ring-amber-200",
  danger: "bg-red-50 text-red-700 ring-red-200",
  info: "bg-sky-50 text-sky-700 ring-sky-200",
};

export default function Badge({
  children,
  tone = "neutral",
  className,
}: {
  children: ReactNode;
  tone?: BadgeTone;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${tones[tone]} ${className ?? ""}`}
    >
      {children}
    </span>
  );
}
