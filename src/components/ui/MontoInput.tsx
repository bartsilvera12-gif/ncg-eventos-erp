"use client";

import { useEffect, useRef, useState } from "react";

/** Formatea número con separador de miles (es: 1.200.000 / 1.234,50). */
export function formatMontoDisplay(value: number | string, decimals = true): string {
  const n = typeof value === "string" ? parseMontoInput(value) : value;
  if (isNaN(n) || (typeof value === "number" && isNaN(value))) return "";
  return n.toLocaleString("es-PY", {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimals ? 2 : 0,
  });
}

/** Parsea string con formato a número (acepta "1.200.000", "1.234,50", "1234.56"). */
export function parseMontoInput(value: string): number {
  if (!value || !value.trim()) return 0;
  const v = value.replace(/\s/g, "");
  if (v.includes(",")) {
    const [intPart, decPart] = v.split(",");
    const n = parseFloat((intPart || "").replace(/\./g, "") + "." + (decPart || "0"));
    return isNaN(n) ? 0 : n;
  }
  const parts = v.split(".");
  if (parts.length === 1) return parseFloat(parts[0]) || 0;
  const last = parts[parts.length - 1] || "";
  if (last.length <= 2 && /^\d+$/.test(last)) {
    return parseFloat(parts.slice(0, -1).join("") + "." + last) || 0;
  }
  return parseFloat(parts.join("")) || 0;
}

type MontoInputProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, "type" | "value" | "onChange"> & {
  value: number | string;
  onChange: (value: number) => void;
  /** Si true, permite decimales (coma o punto). Default: true. */
  decimals?: boolean;
};

/**
 * Input de monto con separador de miles.
 *
 * Estado interno como string para que el usuario pueda tipear sin que el
 * parser le coma una coma a medias (ej. "3," → 3 → "3" no permitía seguir).
 * Mientras esté enfocado mostramos lo que el usuario está tipeando; al
 * perder el foco reformateamos el display. Cada cambio sigue emitiendo
 * el `onChange(number)` al padre.
 */
export default function MontoInput({
  value,
  onChange,
  decimals = true,
  className = "",
  onFocus,
  onBlur,
  ...rest
}: MontoInputProps) {
  const numValue = typeof value === "string"
    ? (value === "" ? 0 : parseMontoInput(value))
    : Number(value) || 0;
  const formatted = (typeof value === "string" && value === "") ? "" : formatMontoDisplay(numValue, decimals);

  const [draft, setDraft] = useState<string>(formatted);
  const focusedRef = useRef(false);

  // Sincronizar el draft con el value que viene de afuera, salvo que el usuario esté tipeando.
  useEffect(() => {
    if (!focusedRef.current) setDraft(formatted);
  }, [formatted]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let raw = e.target.value;
    // Filtrar caracteres no aceptados según modo (con/sin decimales).
    raw = decimals
      ? raw.replace(/[^\d.,-]/g, "")
      : raw.replace(/[^\d-]/g, "");
    setDraft(raw);
    const n = parseMontoInput(raw);
    onChange(n);
  };

  return (
    <input
      type="text"
      inputMode={decimals ? "decimal" : "numeric"}
      value={draft}
      onChange={handleChange}
      onFocus={(e) => { focusedRef.current = true; onFocus?.(e); }}
      onBlur={(e) => {
        focusedRef.current = false;
        // Al perder foco normalizamos al formato canónico.
        setDraft(formatMontoDisplay(parseMontoInput(draft), decimals));
        onBlur?.(e);
      }}
      className={className}
      {...rest}
    />
  );
}
