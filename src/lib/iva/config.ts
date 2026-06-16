/**
 * Config de IVA por país. Instancia dedicada monocliente:
 * - NCG España (ncgconstructora) → 'ES'
 * - Otros tenants (legacy PY)    → 'PY'
 *
 * Se selecciona por env (NEURA_CLIENT_COUNTRY). Default 'ES'.
 *
 * El backend usa `rateOf(pais, codigo)` para validar y calcular IVA.
 * El frontend lee `getPais()` (server) o el hook useTasasIva (cliente).
 */

export type Pais = "PY" | "ES";

export interface TasaIva {
  /** Código persistido en DB. Compras: 'exenta'|'4'|'5'|'10'|'21'. Ventas legacy PY: 'EXENTA'|'5%'|'10%'. */
  codigo: string;
  /** Etiqueta para UI. */
  etiqueta: string;
  /** Alícuota como fracción (0.21 = 21%). */
  rate: number;
}

/** Catálogo de tasas por país. El orden importa: se renderiza tal cual en selects. */
export const TASAS_POR_PAIS: Record<Pais, TasaIva[]> = {
  ES: [
    { codigo: "exenta", etiqueta: "Exento", rate: 0 },
    { codigo: "4", etiqueta: "4%", rate: 0.04 },
    { codigo: "10", etiqueta: "10%", rate: 0.1 },
    { codigo: "21", etiqueta: "21%", rate: 0.21 },
  ],
  PY: [
    { codigo: "exenta", etiqueta: "Exenta", rate: 0 },
    { codigo: "5", etiqueta: "5%", rate: 0.05 },
    { codigo: "10", etiqueta: "10%", rate: 0.1 },
  ],
};

/** Resolución del país de la instancia. Server-side. */
export function getPais(): Pais {
  const v = (typeof process !== "undefined" ? process.env.NEURA_CLIENT_COUNTRY?.trim().toUpperCase() : "") || "";
  if (v === "PY") return "PY";
  if (v === "ES") return "ES";
  return "ES";
}

/**
 * Resuelve la alícuota de un código aceptando ambas convenciones:
 * - Compras: 'exenta' | '4' | '5' | '10' | '21'
 * - Ventas legacy PY: 'EXENTA' | '5%' | '10%' (también '4%' / '21%' tras migración ES)
 */
export function rateOf(pais: Pais, codigoRaw: string): number {
  const c = (codigoRaw ?? "").toString().trim();
  const normalized = c.toLowerCase().replace("%", "");
  if (normalized === "exenta" || normalized === "" || normalized === "0") return 0;
  const tasas = TASAS_POR_PAIS[pais];
  const found = tasas.find((t) => t.codigo.toLowerCase().replace("%", "") === normalized);
  if (found) return found.rate;
  const n = Number(normalized);
  if (Number.isFinite(n) && n > 0 && n < 1) return n;
  if (Number.isFinite(n) && n >= 1 && n <= 100) return n / 100;
  return 0;
}

/** Código por defecto para nuevas líneas según país. */
export function defaultIvaCompra(pais: Pais): string {
  return pais === "ES" ? "21" : "10";
}
export function defaultIvaVenta(pais: Pais): string {
  return pais === "ES" ? "21%" : "10%";
}

/**
 * Default del flag `precio_incluye_iva` por país:
 * - ES: false (precio ingresado = base imponible; IVA se suma).
 * - PY: true  (legacy: precio ingresado = total con IVA; IVA se extrae).
 */
export function defaultPrecioIncluyeIvaVenta(pais: Pais): boolean {
  return pais === "PY";
}

/**
 * Calcula los tres montos (subtotal, iva, total) a partir de un importe
 * unitario y cantidad. Respeta `precio_incluye_iva` y `rate`.
 */
export function calcularMontos(opts: {
  cantidad: number;
  importeUnitario: number;
  rate: number;
  precioIncluyeIva: boolean;
}): { subtotal: number; iva: number; total: number } {
  const { cantidad, importeUnitario, rate, precioIncluyeIva } = opts;
  const bruto = Math.max(0, cantidad) * Math.max(0, importeUnitario);
  if (rate <= 0) return { subtotal: bruto, iva: 0, total: bruto };
  if (precioIncluyeIva) {
    const total = bruto;
    const subtotal = total / (1 + rate);
    return { subtotal, iva: total - subtotal, total };
  }
  const subtotal = bruto;
  const iva = subtotal * rate;
  return { subtotal, iva, total: subtotal + iva };
}
