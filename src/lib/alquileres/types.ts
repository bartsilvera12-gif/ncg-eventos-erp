export type UnidadAlquiler = "hora" | "dia";

export type EstadoAlquiler = "reservado" | "activo" | "finalizado" | "anulado";

export interface AlquilerItem {
  id: string;
  alquiler_id: string;
  producto_id: string;
  producto_nombre: string;
  cantidad: number;
  unidad: UnidadAlquiler;
  /** Cantidad de horas o días según `unidad`. */
  cantidad_unidades: number;
  /** Tarifa por unidad (hora o día) congelada al momento de cargar el item. */
  tarifa_unitaria: number;
  /** cantidad × cantidad_unidades × tarifa_unitaria */
  subtotal: number;
  created_at?: string;
}

export interface Alquiler {
  id: string;
  empresa_id: string;
  cliente_id: string;
  /** Denormalizado al leer (join) para listados. */
  cliente_nombre?: string;
  fecha_inicio: string; // ISO
  fecha_fin: string;    // ISO
  estado: EstadoAlquiler;
  total: number;
  observaciones?: string | null;
  items?: AlquilerItem[];
  created_at?: string;
  updated_at?: string;
}

export interface RecuperoProducto {
  producto_id: string;
  costo_total_invertido: number;
  ingreso_real_alquiler: number;
  /** 0-100. */
  porcentaje_recuperado: number;
  monto_faltante: number;
}

export interface NuevoAlquilerItemInput {
  producto_id: string;
  producto_nombre: string;
  cantidad: number;
  unidad: UnidadAlquiler;
  cantidad_unidades: number;
  tarifa_unitaria: number;
}

export interface NuevoAlquilerInput {
  cliente_id: string;
  fecha_inicio: string;
  fecha_fin: string;
  estado?: EstadoAlquiler;
  observaciones?: string | null;
  items: NuevoAlquilerItemInput[];
}
