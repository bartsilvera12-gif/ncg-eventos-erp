import type {
  Evento,
  EventoPresupuesto,
  EventoServicio,
  Paquete,
  PaqueteItem,
  Recurso,
  RentabilidadEvento,
  ServicioCatalogo,
  StockReserva,
  NuevoEventoInput,
  NuevoPresupuestoInput,
  NuevoServicioEventoInput,
  NuevaStockReservaInput,
} from "./types";

// ── Helper genérico ──────────────────────────────────────────────────────────

async function apiJson<T = unknown>(url: string, init?: RequestInit): Promise<T | null> {
  try {
    const r = await fetch(url, {
      credentials: "include",
      cache: "no-store",
      ...(init ?? {}),
      headers: {
        ...(init?.body ? { "Content-Type": "application/json" } : {}),
        ...(init?.headers ?? {}),
      },
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || !j?.success) {
      const err = (j as { error?: string })?.error ?? `Error ${r.status}`;
      console.error(`[eventos] ${url}:`, err);
      return null;
    }
    return j.data as T;
  } catch (e) {
    console.error(`[eventos] ${url}:`, e);
    return null;
  }
}

// ── Recursos ─────────────────────────────────────────────────────────────────

export async function getRecursos(): Promise<Recurso[]> {
  const data = await apiJson<{ recursos?: Recurso[] }>("/api/eventos/recursos");
  return data?.recursos ?? [];
}

export async function saveRecurso(input: Partial<Recurso>): Promise<Recurso | null> {
  const data = await apiJson<{ recurso?: Recurso }>("/api/eventos/recursos", {
    method: "POST",
    body: JSON.stringify(input),
  });
  return data?.recurso ?? null;
}

export async function updateRecurso(id: string, patch: Partial<Recurso>): Promise<Recurso | null> {
  const data = await apiJson<{ recurso?: Recurso }>(`/api/eventos/recursos/${id}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
  return data?.recurso ?? null;
}

export async function deleteRecurso(id: string): Promise<boolean> {
  const data = await apiJson<{ ok?: boolean }>(`/api/eventos/recursos/${id}`, { method: "DELETE" });
  return Boolean(data?.ok);
}

// ── Servicios ────────────────────────────────────────────────────────────────

export async function getServicios(categoria?: string): Promise<ServicioCatalogo[]> {
  const url = categoria ? `/api/eventos/servicios?categoria=${categoria}` : "/api/eventos/servicios";
  const data = await apiJson<{ servicios?: ServicioCatalogo[] }>(url);
  return data?.servicios ?? [];
}

export async function saveServicio(input: Partial<ServicioCatalogo>): Promise<ServicioCatalogo | null> {
  const data = await apiJson<{ servicio?: ServicioCatalogo }>("/api/eventos/servicios", {
    method: "POST",
    body: JSON.stringify(input),
  });
  return data?.servicio ?? null;
}

export async function updateServicio(id: string, patch: Partial<ServicioCatalogo>): Promise<ServicioCatalogo | null> {
  const data = await apiJson<{ servicio?: ServicioCatalogo }>(`/api/eventos/servicios/${id}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
  return data?.servicio ?? null;
}

export async function deleteServicio(id: string): Promise<boolean> {
  const data = await apiJson<{ ok?: boolean }>(`/api/eventos/servicios/${id}`, { method: "DELETE" });
  return Boolean(data?.ok);
}

// ── Paquetes ─────────────────────────────────────────────────────────────────

export async function getPaquetes(): Promise<Paquete[]> {
  const data = await apiJson<{ paquetes?: Paquete[] }>("/api/eventos/paquetes");
  return data?.paquetes ?? [];
}

export async function getPaqueteDetalle(
  id: string
): Promise<{ paquete: Paquete; items: PaqueteItem[] } | null> {
  const data = await apiJson<{ paquete?: Paquete; items?: PaqueteItem[] }>(
    `/api/eventos/paquetes/${id}`
  );
  if (!data?.paquete) return null;
  return { paquete: data.paquete, items: data.items ?? [] };
}

export async function savePaquete(input: {
  nombre: string;
  descripcion?: string | null;
  precio_total?: number;
  items?: Array<{ servicio_id: string; cantidad?: number; precio_unitario?: number }>;
}): Promise<Paquete | null> {
  const data = await apiJson<{ paquete?: Paquete }>("/api/eventos/paquetes", {
    method: "POST",
    body: JSON.stringify(input),
  });
  return data?.paquete ?? null;
}

// ── Eventos (proxy sobre /api/proyectos con filtros evento) ──────────────────

export async function getEventos(opts?: { desde?: string; hasta?: string }): Promise<Evento[]> {
  const qs = new URLSearchParams();
  if (opts?.desde) qs.set("fecha_desde", opts.desde);
  if (opts?.hasta) qs.set("fecha_hasta", opts.hasta);
  const url = `/api/eventos${qs.toString() ? `?${qs}` : ""}`;
  const data = await apiJson<{ eventos?: Evento[] }>(url);
  return data?.eventos ?? [];
}

export async function getEvento(id: string): Promise<Evento | null> {
  const data = await apiJson<{ evento?: Evento }>(`/api/eventos/${id}`);
  return data?.evento ?? null;
}

export async function saveEvento(input: NuevoEventoInput): Promise<Evento | null> {
  const data = await apiJson<{ evento?: Evento }>("/api/eventos", {
    method: "POST",
    body: JSON.stringify(input),
  });
  return data?.evento ?? null;
}

/** Variante que devuelve el mensaje de error para mostrar al usuario en vez
 *  de tragarlo. Útil en forms donde el error preciso importa. */
export async function saveEventoConError(
  input: NuevoEventoInput
): Promise<{ ok: true; evento: Evento } | { ok: false; error: string }> {
  try {
    const r = await fetch("/api/eventos", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    const j = (await r.json().catch(() => ({}))) as {
      success?: boolean;
      error?: string;
      data?: { evento?: Evento };
    };
    if (!r.ok || !j.success) {
      return { ok: false, error: j.error ?? `Error ${r.status}` };
    }
    if (!j.data?.evento) return { ok: false, error: "Respuesta inválida del servidor." };
    return { ok: true, evento: j.data.evento };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error de red" };
  }
}

export async function updateEvento(id: string, patch: Partial<Evento>): Promise<Evento | null> {
  const data = await apiJson<{ evento?: Evento }>(`/api/eventos/${id}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
  return data?.evento ?? null;
}

export async function getEventosCalendario(desde: string, hasta: string): Promise<Evento[]> {
  const data = await apiJson<{ eventos?: Evento[] }>(
    `/api/eventos/calendario?desde=${desde}&hasta=${hasta}`
  );
  return data?.eventos ?? [];
}

// ── Presupuestos, servicios contratados, reservas ────────────────────────────

export async function getPresupuestos(eventoId: string): Promise<EventoPresupuesto[]> {
  const data = await apiJson<{ presupuestos?: EventoPresupuesto[] }>(
    `/api/eventos/${eventoId}/presupuestos`
  );
  return data?.presupuestos ?? [];
}

export async function savePresupuesto(input: NuevoPresupuestoInput): Promise<EventoPresupuesto | null> {
  const data = await apiJson<{ presupuesto?: EventoPresupuesto }>(
    `/api/eventos/${input.proyecto_id}/presupuestos`,
    { method: "POST", body: JSON.stringify(input) }
  );
  return data?.presupuesto ?? null;
}

export async function updatePresupuestoEstado(
  eventoId: string,
  presupuestoId: string,
  estado: string
): Promise<boolean> {
  const data = await apiJson<{ ok?: boolean }>(
    `/api/eventos/${eventoId}/presupuestos/${presupuestoId}`,
    { method: "PATCH", body: JSON.stringify({ estado }) }
  );
  return Boolean(data?.ok);
}

export async function getServiciosEvento(eventoId: string): Promise<EventoServicio[]> {
  const data = await apiJson<{ servicios?: EventoServicio[] }>(
    `/api/eventos/${eventoId}/servicios`
  );
  return data?.servicios ?? [];
}

export async function saveServicioEvento(
  input: NuevoServicioEventoInput
): Promise<EventoServicio | null> {
  const data = await apiJson<{ servicio?: EventoServicio }>(
    `/api/eventos/${input.proyecto_id}/servicios`,
    { method: "POST", body: JSON.stringify(input) }
  );
  return data?.servicio ?? null;
}

export async function getReservasStock(eventoId: string): Promise<StockReserva[]> {
  const data = await apiJson<{ reservas?: StockReserva[] }>(
    `/api/eventos/${eventoId}/reservas`
  );
  return data?.reservas ?? [];
}

export async function saveReservaStock(
  input: NuevaStockReservaInput
): Promise<StockReserva | null> {
  const data = await apiJson<{ reserva?: StockReserva }>(
    `/api/eventos/${input.proyecto_id}/reservas`,
    { method: "POST", body: JSON.stringify(input) }
  );
  return data?.reserva ?? null;
}

export async function updateReservaStock(
  eventoId: string,
  reservaId: string,
  input: {
    estado: "reservado" | "entregado" | "devuelto" | "anulado";
    cantidad_danada?: number;
    observaciones?: string;
  }
): Promise<boolean> {
  const data = await apiJson<{ ok?: boolean }>(
    `/api/eventos/${eventoId}/reservas/${reservaId}`,
    { method: "PATCH", body: JSON.stringify(input) }
  );
  return Boolean(data?.ok);
}

export async function borrarReservaStock(
  eventoId: string,
  reservaId: string
): Promise<boolean> {
  const data = await apiJson<{ ok?: boolean }>(
    `/api/eventos/${eventoId}/reservas/${reservaId}`,
    { method: "DELETE" }
  );
  return Boolean(data?.ok);
}

// ── Pagos + rentabilidad ─────────────────────────────────────────────────────

export interface PagosResumen {
  total_cobrado: number;
  saldo_pendiente: number;
  esta_pagado: boolean;
  pagos: Array<{ id: string; fecha: string; monto: number; medio?: string | null }>;
}

export async function getPagosEvento(eventoId: string): Promise<PagosResumen | null> {
  return apiJson<PagosResumen>(`/api/eventos/${eventoId}/pagos`);
}

export async function getRentabilidadEvento(eventoId: string): Promise<RentabilidadEvento | null> {
  const data = await apiJson<{ rentabilidad?: RentabilidadEvento }>(
    `/api/eventos/${eventoId}/rentabilidad`
  );
  return data?.rentabilidad ?? null;
}

// ── Galería (fotos del evento) ───────────────────────────────────────────────

export interface FotoEvento {
  id: string;
  nombre: string;
  descripcion?: string | null;
  storage_bucket?: string;
  storage_path?: string;
  mime_type?: string;
  size_bytes?: number | null;
  orden?: number;
  created_at?: string;
  url: string | null;
}

export async function getGaleria(eventoId: string): Promise<FotoEvento[]> {
  const d = await apiJson<{ fotos?: FotoEvento[] }>(`/api/eventos/${eventoId}/galeria`);
  return d?.fotos ?? [];
}

export async function registrarFoto(
  eventoId: string,
  input: {
    nombre: string;
    storage_path: string;
    storage_bucket?: string;
    mime_type?: string;
    size_bytes?: number;
    descripcion?: string | null;
    orden?: number;
  }
): Promise<FotoEvento | null> {
  const d = await apiJson<{ foto?: FotoEvento }>(`/api/eventos/${eventoId}/galeria`, {
    method: "POST",
    body: JSON.stringify(input),
  });
  return d?.foto ?? null;
}

export async function borrarFoto(eventoId: string, fotoId: string): Promise<boolean> {
  const d = await apiJson<{ ok?: boolean }>(
    `/api/eventos/${eventoId}/galeria?fotoId=${fotoId}`,
    { method: "DELETE" }
  );
  return Boolean(d?.ok);
}
