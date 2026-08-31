/**
 * Motor contable minimo para Libro Diario / Libro Mayor.
 *
 * Genera asientos a partir de:
 *   - ventas      → DEBE 430 Clientes                CR 700 Ventas + CR 477 IVA repercutido
 *   - compras     → DEBE 600 Compras + DEBE 472 IVA  CR 400 Proveedores
 *   - gastos      → DEBE 629 Otros gastos            CR 570 Caja
 *
 * No cubre pagos ni cobranzas (esos asientos requieren tracking de asignacion
 * a facturas concretas, fuera de scope). Suficiente para dar visibilidad a la
 * actividad economica del mes.
 *
 * Plan de cuentas usado (PGC pymes español, simplificado):
 */

export type Cuenta = { codigo: string; nombre: string; tipo: "activo" | "pasivo" | "ingreso" | "gasto" };

export const CUENTAS: Record<string, Cuenta> = {
  "400": { codigo: "400", nombre: "Proveedores",              tipo: "pasivo"  },
  "430": { codigo: "430", nombre: "Clientes",                 tipo: "activo"  },
  "472": { codigo: "472", nombre: "HP IVA soportado",         tipo: "activo"  },
  "477": { codigo: "477", nombre: "HP IVA repercutido",       tipo: "pasivo"  },
  "570": { codigo: "570", nombre: "Caja",                     tipo: "activo"  },
  "600": { codigo: "600", nombre: "Compras de mercaderías",   tipo: "gasto"   },
  "629": { codigo: "629", nombre: "Otros gastos",             tipo: "gasto"   },
  "700": { codigo: "700", nombre: "Ventas",                   tipo: "ingreso" },
};

export interface LineaAsiento {
  cuenta_codigo: string;
  cuenta_nombre: string;
  descripcion: string | null;
  debe: number;
  haber: number;
}

export interface Asiento {
  id: string;
  numero: string;
  fecha: string;
  concepto: string;
  origen_tipo: string | null;
  origen_id: string | null;
  lineas: LineaAsiento[];
  total_debe: number;
  total_haber: number;
}

type Sb = {
  from: (t: string) => {
    select: (s: string) => {
      eq: (col: string, val: unknown) => {
        gte: (col: string, val: string) => {
          lte: (col: string, val: string) => {
            order: (col: string, opts?: { ascending?: boolean }) => Promise<{ data: Record<string, unknown>[] | null; error: { message: string } | null }>;
          };
        };
      };
    };
  };
};

function nz(n: unknown): number {
  const x = typeof n === "number" ? n : parseFloat(String(n ?? 0));
  return Number.isFinite(x) ? x : 0;
}

function isoDate(d: unknown): string {
  const s = String(d ?? "").slice(0, 10);
  return s || new Date().toISOString().slice(0, 10);
}

function makeAsiento(params: {
  id: string;
  fecha: string;
  concepto: string;
  origen_tipo: string;
  origen_id: string | null;
  lineas: LineaAsiento[];
}): Asiento {
  const total_debe = params.lineas.reduce((s, l) => s + l.debe, 0);
  const total_haber = params.lineas.reduce((s, l) => s + l.haber, 0);
  return {
    id: params.id,
    numero: "",
    fecha: params.fecha,
    concepto: params.concepto,
    origen_tipo: params.origen_tipo,
    origen_id: params.origen_id,
    lineas: params.lineas,
    total_debe,
    total_haber,
  };
}

/** Levanta ventas + compras + gastos entre desde/hasta y arma asientos. */
export async function generarAsientos(
  sb: Sb,
  empresaId: string,
  desde: string, // yyyy-mm-dd inclusive
  hasta: string  // yyyy-mm-dd inclusive
): Promise<Asiento[]> {
  const [ventasQ, comprasQ, gastosQ] = await Promise.all([
    sb.from("ventas")
      .select("id, fecha, total, subtotal, monto_iva, cliente_nombre, numero_control")
      .eq("empresa_id", empresaId)
      .gte("fecha", desde)
      .lte("fecha", hasta)
      .order("fecha", { ascending: true }),
    sb.from("compras")
      .select("id, fecha, total, subtotal, monto_iva, proveedor_nombre, numero_control")
      .eq("empresa_id", empresaId)
      .gte("fecha", desde)
      .lte("fecha", hasta)
      .order("fecha", { ascending: true }),
    sb.from("gastos")
      .select("id, fecha, monto, descripcion, categoria")
      .eq("empresa_id", empresaId)
      .gte("fecha", desde)
      .lte("fecha", hasta)
      .order("fecha", { ascending: true }),
  ]);

  const asientos: Asiento[] = [];

  for (const v of (ventasQ.data ?? [])) {
    const total = nz(v.total);
    if (total === 0) continue;
    const iva = nz(v.monto_iva);
    const subtotal = nz(v.subtotal) || (total - iva);
    const desc = (v.cliente_nombre as string) || "Cliente";
    const ref = (v.numero_control as string) || "";
    asientos.push(makeAsiento({
      id: `V-${v.id}`,
      fecha: isoDate(v.fecha),
      concepto: `Venta a ${desc}${ref ? ` (${ref})` : ""}`,
      origen_tipo: "venta",
      origen_id: String(v.id),
      lineas: [
        { cuenta_codigo: "430", cuenta_nombre: CUENTAS["430"].nombre, descripcion: desc, debe: total, haber: 0 },
        { cuenta_codigo: "700", cuenta_nombre: CUENTAS["700"].nombre, descripcion: null,  debe: 0, haber: subtotal },
        ...(iva > 0 ? [{ cuenta_codigo: "477", cuenta_nombre: CUENTAS["477"].nombre, descripcion: null, debe: 0, haber: iva }] : []),
      ],
    }));
  }

  for (const c of (comprasQ.data ?? [])) {
    const total = nz(c.total);
    if (total === 0) continue;
    const iva = nz(c.monto_iva);
    const subtotal = nz(c.subtotal) || (total - iva);
    const desc = (c.proveedor_nombre as string) || "Proveedor";
    const ref = (c.numero_control as string) || "";
    asientos.push(makeAsiento({
      id: `C-${c.id}`,
      fecha: isoDate(c.fecha),
      concepto: `Compra a ${desc}${ref ? ` (${ref})` : ""}`,
      origen_tipo: "compra",
      origen_id: String(c.id),
      lineas: [
        { cuenta_codigo: "600", cuenta_nombre: CUENTAS["600"].nombre, descripcion: desc, debe: subtotal, haber: 0 },
        ...(iva > 0 ? [{ cuenta_codigo: "472", cuenta_nombre: CUENTAS["472"].nombre, descripcion: null, debe: iva, haber: 0 }] : []),
        { cuenta_codigo: "400", cuenta_nombre: CUENTAS["400"].nombre, descripcion: null, debe: 0, haber: total },
      ],
    }));
  }

  for (const g of (gastosQ.data ?? [])) {
    const monto = nz(g.monto);
    if (monto === 0) continue;
    const desc = (g.descripcion as string) || (g.categoria as string) || "Gasto";
    asientos.push(makeAsiento({
      id: `G-${g.id}`,
      fecha: isoDate(g.fecha),
      concepto: `Gasto: ${desc}`,
      origen_tipo: "gasto",
      origen_id: String(g.id),
      lineas: [
        { cuenta_codigo: "629", cuenta_nombre: CUENTAS["629"].nombre, descripcion: desc, debe: monto, haber: 0 },
        { cuenta_codigo: "570", cuenta_nombre: CUENTAS["570"].nombre, descripcion: null, debe: 0, haber: monto },
      ],
    }));
  }

  // Ordenar por fecha ASC (fallback estable por id).
  asientos.sort((a, b) => (a.fecha === b.fecha ? a.id.localeCompare(b.id) : a.fecha.localeCompare(b.fecha)));
  // Numerar sequential.
  asientos.forEach((a, i) => { a.numero = String(i + 1).padStart(4, "0"); });
  return asientos;
}

/** Agrupa los asientos por cuenta para la vista Libro Mayor. */
export function resumenPorCuenta(asientos: Asiento[]): Array<{
  cuenta_id: string;
  codigo: string;
  nombre: string;
  tipo: string;
  saldo_inicial: number;
  debe_periodo: number;
  haber_periodo: number;
  saldo_final: number;
}> {
  const acc = new Map<string, { codigo: string; nombre: string; tipo: string; debe: number; haber: number }>();
  for (const a of asientos) {
    for (const l of a.lineas) {
      const key = l.cuenta_codigo;
      const meta = CUENTAS[key] ?? { codigo: key, nombre: l.cuenta_nombre, tipo: "activo" as const };
      const cur = acc.get(key) ?? { codigo: meta.codigo, nombre: meta.nombre, tipo: meta.tipo, debe: 0, haber: 0 };
      cur.debe += l.debe;
      cur.haber += l.haber;
      acc.set(key, cur);
    }
  }
  return Array.from(acc.entries()).map(([key, v]) => {
    const signo = v.tipo === "activo" || v.tipo === "gasto" ? 1 : -1;
    const saldo_final = signo * (v.debe - v.haber);
    return {
      cuenta_id: key,
      codigo: v.codigo,
      nombre: v.nombre,
      tipo: v.tipo,
      saldo_inicial: 0,
      debe_periodo: v.debe,
      haber_periodo: v.haber,
      saldo_final,
    };
  }).sort((a, b) => a.codigo.localeCompare(b.codigo));
}
