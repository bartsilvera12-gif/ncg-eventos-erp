export type TipoPago = "contado" | "credito";
export type TipoIva = "exenta" | "4" | "10" | "21";
/** Códigos persistidos en DB. "PYG" se muestra como € en la UI (NCG). */
export type Moneda = "PYG" | "USD";
export type TipoDocumentoCompra =
  | "factura"
  | "albaran"
  | "ticket"
  | "presupuesto"
  | "rectificativa";
export type AlmacenDestino = "deposito" | "obra" | "vehiculo" | "taller";

/** Una línea de detalle de compra (tabla sanantonio.compras_items). */
export interface CompraItem {
  producto_id: string;
  producto_nombre: string;
  sku: string;
  cantidad: number;
  costo_unitario: number;            // PYG (impacto en inventario)
  costo_unitario_original: number;   // en la moneda elegida
  iva_tipo: TipoIva;
  subtotal: number;                  // PYG, antes de IVA
  monto_iva: number;                 // PYG
  total_linea: number;               // PYG, con IVA
}

export interface Compra {
  id: string;
  numero_control: string;        // COMP-000001, COMP-000002, ...

  proveedor_id: string;
  proveedor_nombre: string;

  producto_id: string;
  producto_nombre: string;

  cantidad: number;

  moneda: Moneda;
  tipo_cambio: number;           // 1 si PYG; cotización si USD
  costo_unitario_original: number; // en la moneda elegida
  costo_unitario: number;        // siempre en PYG (para impacto en inventario)

  iva_tipo: TipoIva;
  subtotal: number;              // PYG, antes de IVA
  monto_iva: number;             // PYG
  total: number;                 // PYG, total con IVA

  precio_venta: number;          // PYG, precio de venta sugerido
  margen_venta: number;          // % margen sobre venta

  tipo_pago: TipoPago;
  plazo_dias?: number;           // solo si tipo_pago === "credito"

  nro_timbrado: string;

  fecha: string;                 // ISO string, generado automáticamente

  /** Estado de la compra (ej. 'registrada'). Opcional para compat con altas. */
  estado?: string;

  /** Cantidad de líneas de detalle (compras_items). 0/undefined = compra
   *  mono-producto legacy que se lee por los campos inline de `compras`. */
  items_count?: number;

  /** Factura adjunta del proveedor (Storage privado). Solo metadata; la URL
   *  firmada se genera on-demand vía /api/compras/[id]/factura. */
  factura_path?: string | null;
  factura_nombre_original?: string | null;
  factura_mime_type?: string | null;

  /** Tipo de documento del proveedor (factura, albarán, ticket…). */
  tipo_documento?: TipoDocumentoCompra | null;
  /** Fecha del documento (independiente de `fecha` = alta en sistema). */
  fecha_compra?: string | null;
  /** Vencimiento explícito (sólo si crédito). Reemplaza al cálculo desde plazo_dias. */
  fecha_vencimiento?: string | null;
  /** Destino físico del material comprado. */
  almacen_destino?: AlmacenDestino | null;
  /** Obra a la que se imputa la compra. */
  proyecto_id?: string | null;
  proyecto_titulo?: string | null;
}

// ── Detalle de compra (pantalla /compras/[id]) ───────────────────────────────

/** Línea de detalle ya normalizada a number para la UI. */
export interface CompraItemDetalle {
  id: string;
  producto_id: string;
  producto_nombre: string;
  sku: string;
  cantidad: number;
  costo_unitario: number;
  iva_tipo: string;
  subtotal: number;
  monto_iva: number;
  total_linea: number;
}

/** Movimiento de inventario generado por la compra (origen='compra'). */
export interface MovimientoCompra {
  id: string;
  producto_nombre: string;
  producto_sku: string | null;
  tipo: string;
  cantidad: number;
  costo_unitario: number;
  referencia: string | null;
  fecha: string;
}

export interface CompraDetalle {
  compra: Compra;
  items: CompraItemDetalle[];
  movimientos: MovimientoCompra[];
}

// ── Resumen / mini-dashboard de compras ──────────────────────────────────────

export interface ResumenCompras {
  hoy: { cantidad: number; total: number };
  /** Métricas del rango seleccionado (default mes actual). */
  rango: { cantidad: number; total: number };
  compraMasAlta: { numero_control: string; proveedor_nombre: string; total: number } | null;
  proveedorPrincipal: { proveedor_id: string; proveedor_nombre: string; total: number } | null;
}
