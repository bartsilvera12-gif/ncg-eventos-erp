/**
 * Helpers de importes para inputs de UI en formato español/europeo.
 *
 * Regla: el ESTADO de la app siempre es `number` con punto decimal.
 * La UI puede mostrar coma; el parseo tolera ambos.
 *
 * `parseImporte` acepta:
 *  - "4,25"      → 4.25
 *  - "4.25"      → 4.25
 *  - "1.234,56"  → 1234.56  (miles con punto, decimal con coma)
 *  - "1,234.56"  → 1234.56  (miles con coma, decimal con punto)
 *  - "1234"      → 1234
 *  - 4.25 (num)  → 4.25
 *  - null/""/NaN → 0
 *
 * Reutiliza la lógica madura de MontoInput.parseMontoInput.
 */

import { parseMontoInput, formatMontoDisplay } from "@/components/ui/MontoInput";

export { parseMontoInput, formatMontoDisplay };

/** Parseo robusto: number | string → number (siempre finito). */
export function parseImporte(v: unknown): number {
  if (v == null) return 0;
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  if (typeof v === "string") return parseMontoInput(v);
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Convierte un importe numérico al texto que va dentro de un <input>:
 * - Si tiene decimales relevantes, los conserva (hasta 2 dígitos).
 * - Si es entero, no agrega ".00" para no estorbar.
 * - Usa "." como separador decimal (los <input type="number"> y los
 *   inputs `inputMode=decimal` aceptan punto sin problemas en ES).
 */
export function importeToInputValue(n: number): string {
  if (!Number.isFinite(n) || n === 0) return "";
  const round2 = Math.round(n * 100) / 100;
  if (Number.isInteger(round2)) return String(round2);
  return round2.toFixed(2).replace(/0$/, "").replace(/\.$/, "");
}
