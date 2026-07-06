import type {
  Alquiler,
  AlquilerItem,
  EstadoAlquiler,
  NuevoAlquilerInput,
  RecuperoProducto,
  UnidadAlquiler,
} from "./types";

interface AlquilerApiRow {
  id: string;
  empresa_id: string;
  cliente_id: string;
  cliente_nombre?: string | null;
  fecha_inicio: string;
  fecha_fin: string;
  estado: string;
  total: string | number;
  observaciones: string | null;
  created_at?: string;
  updated_at?: string;
  items_count?: number | string | null;
}

interface AlquilerItemApiRow {
  id: string;
  alquiler_id: string;
  producto_id: string;
  producto_nombre: string;
  cantidad: string | number;
  unidad: string;
  cantidad_unidades: string | number;
  tarifa_unitaria: string | number;
  subtotal: string | number;
  created_at?: string;
}

function mapAlquiler(r: AlquilerApiRow): Alquiler {
  return {
    id: r.id,
    empresa_id: r.empresa_id,
    cliente_id: r.cliente_id,
    cliente_nombre: r.cliente_nombre ?? undefined,
    fecha_inicio: r.fecha_inicio,
    fecha_fin: r.fecha_fin,
    estado: (r.estado as EstadoAlquiler) ?? "reservado",
    total: Number(r.total) || 0,
    observaciones: r.observaciones,
    created_at: r.created_at,
    updated_at: r.updated_at,
  };
}

function mapItem(r: AlquilerItemApiRow): AlquilerItem {
  return {
    id: r.id,
    alquiler_id: r.alquiler_id,
    producto_id: r.producto_id,
    producto_nombre: r.producto_nombre,
    cantidad: Number(r.cantidad) || 0,
    unidad: (r.unidad as UnidadAlquiler) ?? "dia",
    cantidad_unidades: Number(r.cantidad_unidades) || 0,
    tarifa_unitaria: Number(r.tarifa_unitaria) || 0,
    subtotal: Number(r.subtotal) || 0,
    created_at: r.created_at,
  };
}

export async function getAlquileres(): Promise<Alquiler[]> {
  try {
    const r = await fetch("/api/alquileres", { credentials: "include", cache: "no-store" });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || !j?.success) {
      console.error("[alquileres] getAlquileres:", (j as { error?: string })?.error ?? r.status);
      return [];
    }
    const list = ((j.data as { alquileres?: AlquilerApiRow[] }).alquileres ?? []) as AlquilerApiRow[];
    return list.map(mapAlquiler);
  } catch (e) {
    console.error("[alquileres] getAlquileres:", e);
    return [];
  }
}

export async function getAlquilerDetalle(
  id: string
): Promise<{ alquiler: Alquiler; items: AlquilerItem[] } | null> {
  try {
    const r = await fetch(`/api/alquileres/${id}`, {
      credentials: "include",
      cache: "no-store",
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || !j?.success) return null;
    const data = j.data as { alquiler?: AlquilerApiRow; items?: AlquilerItemApiRow[] };
    if (!data.alquiler) return null;
    return {
      alquiler: mapAlquiler(data.alquiler),
      items: (data.items ?? []).map(mapItem),
    };
  } catch (e) {
    console.error("[alquileres] getAlquilerDetalle:", e);
    return null;
  }
}

export interface SaveAlquilerOk {
  success: true;
  alquiler: Alquiler;
  items: AlquilerItem[];
}
export interface SaveAlquilerErr {
  success: false;
  error: string;
}

export async function saveAlquiler(
  input: NuevoAlquilerInput
): Promise<SaveAlquilerOk | SaveAlquilerErr> {
  try {
    const r = await fetch("/api/alquileres", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || !j?.success) {
      const err = (j as { error?: string })?.error ?? `Error ${r.status} al guardar el alquiler.`;
      return { success: false, error: err };
    }
    const data = j.data as { alquiler?: AlquilerApiRow; items?: AlquilerItemApiRow[] };
    if (!data.alquiler) return { success: false, error: "Respuesta inválida del servidor." };
    return {
      success: true,
      alquiler: mapAlquiler(data.alquiler),
      items: (data.items ?? []).map(mapItem),
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error de red";
    return { success: false, error: msg };
  }
}

export async function updateAlquilerEstado(
  id: string,
  estado: EstadoAlquiler
): Promise<boolean> {
  try {
    const r = await fetch(`/api/alquileres/${id}/estado`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ estado }),
    });
    const j = await r.json().catch(() => ({}));
    return Boolean(r.ok && j?.success);
  } catch (e) {
    console.error("[alquileres] updateAlquilerEstado:", e);
    return false;
  }
}

export async function getRecuperoProducto(
  productoId: string
): Promise<RecuperoProducto | null> {
  try {
    const r = await fetch(`/api/alquileres/recupero/${productoId}`, {
      credentials: "include",
      cache: "no-store",
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || !j?.success) return null;
    const data = (j.data as { recupero?: RecuperoProducto }).recupero ?? null;
    if (!data) return null;
    return {
      producto_id: data.producto_id,
      costo_total_invertido: Number(data.costo_total_invertido) || 0,
      ingreso_real_alquiler: Number(data.ingreso_real_alquiler) || 0,
      porcentaje_recuperado: Number(data.porcentaje_recuperado) || 0,
      monto_faltante: Number(data.monto_faltante) || 0,
    };
  } catch (e) {
    console.error("[alquileres] getRecuperoProducto:", e);
    return null;
  }
}
