export type CategoriaCertificado =
  | "habilitacion"
  | "seguro"
  | "certificado"
  | "licencia"
  | "permiso"
  | "contrato"
  | "otro";

export interface Certificado {
  id: string;
  empresa_id: string;
  nombre: string;
  categoria: CategoriaCertificado;
  descripcion?: string | null;
  emitido_por?: string | null;
  numero?: string | null;
  fecha_emision?: string | null;
  fecha_vencimiento?: string | null;
  alerta_dias_antes: number;
  storage_bucket?: string | null;
  storage_path?: string | null;
  archivo_nombre?: string | null;
  archivo_mime?: string | null;
  archivo_tamano?: number | null;
  activo: boolean;
  observaciones?: string | null;
  created_at?: string;
  updated_at?: string;
}

/** Estado calculado en cliente según fecha_vencimiento vs. hoy. */
export type EstadoVencimiento = "sin_fecha" | "vigente" | "por_vencer" | "vencido";

export function estadoVencimiento(c: Certificado): EstadoVencimiento {
  if (!c.fecha_vencimiento) return "sin_fecha";
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const venc = new Date(c.fecha_vencimiento);
  const dias = Math.floor((venc.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24));
  if (dias < 0) return "vencido";
  if (dias <= (c.alerta_dias_antes ?? 30)) return "por_vencer";
  return "vigente";
}
