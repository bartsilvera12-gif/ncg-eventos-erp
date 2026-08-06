// ============================================================================
//  Tipos del módulo Eventos.
//  El Evento se apoya sobre la tabla `proyectos` (ver Proyecto en proyectos)
//  y extiende con los campos específicos del evento agregados en la migración
//  20260620120000_eventos_modulo.sql.
// ============================================================================

export type EstadoEvento =
  | "consulta"
  | "presupuestado"
  | "reservado"
  | "confirmado"
  | "en_preparacion"
  | "realizado"
  | "cancelado";

export type TipoRecurso = "salon" | "jardin" | "terraza" | "escenario" | "otro";

export type CategoriaServicio =
  | "catering"
  | "decoracion"
  | "musica"
  | "fotografia"
  | "animacion"
  | "mobiliario"
  | "iluminacion"
  | "seguridad"
  | "transporte"
  | "extra";

export type EstadoServicioEvento = "pendiente" | "contratado" | "entregado" | "cancelado";

export type EstadoPresupuesto = "borrador" | "enviado" | "aprobado" | "rechazado";

export type TipoItemPresupuesto = "servicio" | "paquete" | "producto" | "texto";

export type EstadoStockReserva = "reservado" | "entregado" | "devuelto" | "anulado";

// ── Evento (proyecto con campos evento) ──────────────────────────────────────

export interface Evento {
  id: string;
  empresa_id: string;
  cliente_id: string;
  cliente_nombre?: string;
  tipo_id?: string | null;
  estado_id?: string | null;
  estado_codigo?: EstadoEvento | string;
  estado_nombre?: string;
  titulo: string;
  descripcion?: string | null;
  prioridad?: "baja" | "normal" | "alta" | "urgente";
  responsable_comercial_id?: string | null;
  responsable_tecnico_id?: string | null;
  monto_vendido?: number;

  // Campos evento (agregados por la migración)
  fecha_evento?: string | null;      // ISO YYYY-MM-DD
  hora_inicio?: string | null;       // HH:MM
  hora_fin?: string | null;          // HH:MM
  lugar_evento?: string | null;
  cantidad_invitados?: number | null;
  tipo_evento?: string | null;
  recurso_id?: string | null;
  recurso_nombre?: string | null;

  observaciones?: string | null;
  brief_data?: Record<string, unknown> | null;
  archivado?: boolean;
  bloqueado?: boolean;

  created_at?: string;
  updated_at?: string;
}

// ── Recurso (salón / espacio propio) ─────────────────────────────────────────

export interface Recurso {
  id: string;
  empresa_id: string;
  nombre: string;
  tipo: TipoRecurso;
  capacidad?: number | null;
  descripcion?: string | null;
  activo: boolean;
  created_at?: string;
  updated_at?: string;
}

// ── Servicio de catálogo ─────────────────────────────────────────────────────

export interface ServicioCatalogo {
  id: string;
  empresa_id: string;
  nombre: string;
  categoria: CategoriaServicio;
  descripcion?: string | null;
  precio_base: number;
  unidad: string;
  activo: boolean;
  created_at?: string;
  updated_at?: string;
}

// ── Paquete (grupo de servicios pre-armado) ──────────────────────────────────

export interface Paquete {
  id: string;
  empresa_id: string;
  nombre: string;
  descripcion?: string | null;
  precio_total: number;
  activo: boolean;
  items?: PaqueteItem[];
  created_at?: string;
  updated_at?: string;
}

export interface PaqueteItem {
  id: string;
  paquete_id: string;
  servicio_id: string;
  servicio_nombre?: string;
  cantidad: number;
  precio_unitario: number;
}

// ── Servicio contratado por evento ───────────────────────────────────────────

export interface EventoServicio {
  id: string;
  empresa_id: string;
  proyecto_id: string;
  servicio_id?: string | null;
  paquete_id?: string | null;
  proveedor_id?: string | null;
  proveedor_nombre?: string;
  descripcion: string;
  cantidad: number;
  precio_unitario: number;
  costo_unitario: number;
  subtotal: number;
  estado: EstadoServicioEvento;
  observaciones?: string | null;
  created_at?: string;
  updated_at?: string;
}

// ── Presupuesto de evento ────────────────────────────────────────────────────

export interface EventoPresupuesto {
  id: string;
  empresa_id: string;
  proyecto_id: string;
  version: number;
  estado: EstadoPresupuesto;
  fecha: string;
  validez_dias?: number | null;
  total: number;
  observaciones?: string | null;
  aprobado_at?: string | null;
  items?: EventoPresupuestoItem[];
  created_at?: string;
  updated_at?: string;
}

export interface EventoPresupuestoItem {
  id: string;
  presupuesto_id: string;
  tipo: TipoItemPresupuesto;
  ref_id?: string | null;
  descripcion: string;
  cantidad: number;
  precio_unitario: number;
  subtotal: number;
  sort_order: number;
}

// ── Reserva de stock (productos reutilizables) ───────────────────────────────

export interface StockReserva {
  id: string;
  empresa_id: string;
  producto_id: string;
  producto_nombre?: string;
  proyecto_id: string;
  cantidad: number;
  fecha_inicio: string;
  fecha_fin: string;
  estado: EstadoStockReserva;
  observaciones?: string | null;
  created_at?: string;
  updated_at?: string;
}

// ── Rentabilidad del evento (salida de la función SQL) ───────────────────────

export interface RentabilidadEvento {
  proyecto_id: string;
  total_cobrado: number;
  total_presupuesto: number;
  saldo_pendiente: number;
  esta_pagado: boolean;
  total_costos: number;
  ganancia: number;
  /** Porcentaje 0-100. */
  margen_pct: number;
}

// ── Entradas para crear/actualizar ───────────────────────────────────────────

export interface NuevoEventoInput {
  cliente_id: string;
  titulo: string;
  descripcion?: string | null;
  tipo_evento?: string | null;
  fecha_evento?: string | null;
  hora_inicio?: string | null;
  hora_fin?: string | null;
  lugar_evento?: string | null;
  cantidad_invitados?: number | null;
  recurso_id?: string | null;
  responsable_comercial_id?: string | null;
  responsable_tecnico_id?: string | null;
  observaciones?: string | null;
  estado_id?: string | null;
  prioridad?: "baja" | "normal" | "alta" | "urgente";
}

export interface NuevoPresupuestoInput {
  proyecto_id: string;
  fecha?: string;
  validez_dias?: number | null;
  observaciones?: string | null;
  items: Array<{
    tipo: TipoItemPresupuesto;
    ref_id?: string | null;
    descripcion: string;
    cantidad: number;
    precio_unitario: number;
    sort_order?: number;
  }>;
}

export interface NuevoServicioEventoInput {
  proyecto_id: string;
  servicio_id?: string | null;
  paquete_id?: string | null;
  proveedor_id?: string | null;
  descripcion: string;
  cantidad: number;
  precio_unitario: number;
  costo_unitario?: number;
  estado?: EstadoServicioEvento;
  observaciones?: string | null;
}

export interface NuevaStockReservaInput {
  producto_id: string;
  proyecto_id: string;
  cantidad: number;
  fecha_inicio: string;
  fecha_fin: string;
  observaciones?: string | null;
}
