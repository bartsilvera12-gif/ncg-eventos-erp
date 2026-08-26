import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";

/**
 * Boton estandar del ERP. Base blanca + acento turquesa (#4FAEB2).
 *
 * Rediseño 2026: gradiente sutil en primary/danger, sombra con color de marca,
 * elevacion en hover (-translate-y-0.5) y active reset. Look consistente con
 * ConfirmDialog y ExportExcelButton.
 *
 * Variantes:
 *  - primary:   gradiente turquesa 4FAEB2 -> 3F8E91.
 *  - secondary: blanca con borde slate + hover shadow.
 *  - ghost:     sin fondo, hover teal muy sutil.
 *  - danger:    gradiente rojo (red-500 -> red-600).
 *
 * Si se pasa `href`, renderiza un <Link> con la misma apariencia.
 */
export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md";

const base =
  "group inline-flex items-center justify-center gap-1.5 rounded-lg font-semibold transition-all " +
  "focus:outline-none focus-visible:ring-2 focus-visible:ring-[#4FAEB2]/40 " +
  "disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0 disabled:hover:shadow-none " +
  "active:translate-y-0";

const sizes: Record<ButtonSize, string> = {
  sm: "px-3 py-1.5 text-xs min-h-[34px]",
  md: "px-4 py-2 text-sm min-h-[40px]",
};

const variants: Record<ButtonVariant, string> = {
  primary:
    "bg-gradient-to-r from-[#4FAEB2] to-[#3F8E91] text-white shadow-sm shadow-[#4FAEB2]/25 " +
    "hover:-translate-y-0.5 hover:from-[#3F8E91] hover:to-[#2F6F72] hover:shadow-md hover:shadow-[#4FAEB2]/30",
  secondary:
    "border border-slate-200 bg-white text-slate-700 shadow-sm " +
    "hover:-translate-y-0.5 hover:border-[#4FAEB2]/40 hover:bg-slate-50 hover:shadow-md hover:text-[#3F8E91]",
  ghost:
    "text-slate-600 hover:bg-[#E5F4F4] hover:text-[#3F8E91]",
  danger:
    "bg-gradient-to-r from-red-500 to-red-600 text-white shadow-sm shadow-red-500/25 " +
    "hover:-translate-y-0.5 hover:from-red-600 hover:to-red-700 hover:shadow-md",
};

function classes(variant: ButtonVariant, size: ButtonSize, extra?: string) {
  return `${base} ${sizes[size]} ${variants[variant]} ${extra ?? ""}`.trim();
}

type CommonProps = {
  variant?: ButtonVariant;
  size?: ButtonSize;
  children: ReactNode;
  className?: string;
};

type ButtonAsButton = CommonProps &
  Omit<ButtonHTMLAttributes<HTMLButtonElement>, "className" | "children"> & {
    href?: undefined;
  };

type ButtonAsLink = CommonProps & {
  href: string;
};

export default function Button(props: ButtonAsButton | ButtonAsLink) {
  const { variant = "primary", size = "md", className, children } = props;
  const cls = classes(variant, size, className);

  if ("href" in props && props.href) {
    return (
      <Link href={props.href} className={cls}>
        {children}
      </Link>
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { variant: _v, size: _s, className: _c, children: _ch, ...rest } =
    props as ButtonAsButton;
  return (
    <button className={cls} {...rest}>
      {children}
    </button>
  );
}
