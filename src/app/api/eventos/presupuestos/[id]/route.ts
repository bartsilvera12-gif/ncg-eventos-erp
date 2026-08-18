import { NextResponse } from "next/server";
import { getChatServiceClientForEmpresa } from "@/app/api/chat/_chat-service-client";
import { errorResponse, successResponse } from "@/lib/api/response";
import { requireProyectosApiAccess } from "@/lib/proyectos/proyectos-auth";

const ESTADOS_OK = new Set(["borrador", "enviado", "aprobado", "rechazado"]);

/* eslint-disable @typescript-eslint/no-explicit-any */
type Sb = any;

/**
 * Al aprobar una cotización standalone (proyecto_id null):
 *   - Crea un evento nuevo con los datos snapshot del presupuesto
 *     (cliente_id, titulo_evento, tipo_evento, fecha_evento_aprox,
 *      cantidad_invitados) en estado "confirmado" si existe, sino inicial.
 *   - Vincula el presupuesto al evento creado.
 *   - Devuelve el evento_id.
 * Si el presupuesto ya tiene proyecto_id, solo cambia el estado del
 * evento a "confirmado" (comportamiento previo).
 */
async function crearEventoDesdeCotizacion(
  sb: Sb,
  empresaId: string,
  presupuesto: {
    id: string;
    cliente_id: string | null;
    cliente_nombre_snapshot: string | null;
    cliente_telefono_snapshot: string | null;
    cliente_email_snapshot: string | null;
    titulo_evento: string | null;
    tipo_evento: string | null;
    fecha_evento_aprox: string | null;
    cantidad_invitados: number | null;
    total: number | string;
  }
): Promise<{ eventoId: string | null; error: string | null }> {
  if (!presupuesto.titulo_evento) {
    return { eventoId: null, error: "Falta el título del evento en la cotización." };
  }

  // Resolver cliente_id: si no hay uno vinculado pero sí snapshot, crear el
  // cliente ahora y usarlo. Es el flujo típico de la cotización que finalmente
  // se aprueba: recién ahí el "interesado" pasa a ser un cliente en la DB.
  let clienteId = presupuesto.cliente_id;
  if (!clienteId) {
    const nombre = (presupuesto.cliente_nombre_snapshot ?? "").trim();
    if (!nombre) {
      return { eventoId: null, error: "Faltan datos del cliente en la cotización." };
    }
    const { data: cli, error: eCli } = await sb
      .from("clientes")
      .insert({
        empresa_id: empresaId,
        tipo_cliente: "persona",
        nombre_contacto: nombre,
        empresa: null,
        telefono: presupuesto.cliente_telefono_snapshot ?? null,
        email: presupuesto.cliente_email_snapshot ?? null,
      })
      .select("id")
      .single();
    if (eCli || !cli) {
      return { eventoId: null, error: `No se pudo crear el cliente: ${eCli?.message ?? "unknown"}` };
    }
    clienteId = (cli as { id: string }).id;
    // Vincular al presupuesto para no perder la referencia.
    await sb
      .from("evento_presupuestos")
      .update({ cliente_id: clienteId, updated_at: new Date().toISOString() })
      .eq("empresa_id", empresaId)
      .eq("id", presupuesto.id);
  }

  // Resolver tipo_id (NOT NULL en proyectos). Igual patrón que POST /api/eventos.
  const { data: tipos } = await sb
    .from("proyecto_tipos")
    .select("id")
    .eq("empresa_id", empresaId)
    .eq("activo", true)
    .order("nombre")
    .limit(1);
  let tipoId = ((tipos ?? [])[0] as { id?: string } | undefined)?.id ?? null;
  if (!tipoId) {
    const { data: nuevo, error: errTipo } = await sb
      .from("proyecto_tipos")
      .insert({ empresa_id: empresaId, nombre: "Evento", codigo: "evento", activo: true })
      .select("id")
      .single();
    if (errTipo) return { eventoId: null, error: errTipo.message };
    tipoId = (nuevo as { id: string }).id;
  }

  // Resolver estado "confirmado" (o el marcado inicial como fallback).
  const { data: estConf } = await sb
    .from("proyecto_estados")
    .select("id")
    .eq("empresa_id", empresaId)
    .eq("codigo", "confirmado")
    .maybeSingle();
  let estadoId = (estConf as { id?: string } | null)?.id ?? null;
  if (!estadoId) {
    const { data: estIni } = await sb
      .from("proyecto_estados")
      .select("id")
      .eq("empresa_id", empresaId)
      .eq("es_estado_inicial", true)
      .maybeSingle();
    estadoId = (estIni as { id?: string } | null)?.id ?? null;
  }
  if (!estadoId) {
    return { eventoId: null, error: "La empresa no tiene estados de evento. Creá un evento primero desde /eventos/nuevo para inicializar el catálogo." };
  }

  const nowIso = new Date().toISOString();
  const { data: evento, error: eIns } = await sb
    .from("proyectos")
    .insert({
      empresa_id: empresaId,
      cliente_id: clienteId,
      tipo_id: tipoId,
      estado_id: estadoId,
      titulo: presupuesto.titulo_evento,
      tipo_evento: presupuesto.tipo_evento,
      fecha_evento: presupuesto.fecha_evento_aprox,
      cantidad_invitados: presupuesto.cantidad_invitados,
      monto_vendido: Number(presupuesto.total ?? 0) || 0,
      fecha_ingreso: nowIso,
      ultimo_movimiento_at: nowIso,
      last_activity_at: nowIso,
    })
    .select("id")
    .single();
  if (eIns || !evento) return { eventoId: null, error: eIns?.message ?? "No se pudo crear el evento." };

  const eventoId = (evento as { id: string }).id;

  // Vincular presupuesto al evento recién creado.
  await sb
    .from("evento_presupuestos")
    .update({ proyecto_id: eventoId, updated_at: nowIso })
    .eq("empresa_id", empresaId)
    .eq("id", presupuesto.id);

  return { eventoId, error: null };
}

// PATCH /api/eventos/presupuestos/:id — aprobar / rechazar / cambiar estado.
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireProyectosApiAccess(request);
  if (!auth.ok) return NextResponse.json(errorResponse(auth.message), { status: auth.status });
  const { id: presupuestoId } = await params;

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const estadoRaw = typeof body.estado === "string" ? body.estado : "";
  if (!ESTADOS_OK.has(estadoRaw)) {
    return NextResponse.json(errorResponse("Estado inválido."), { status: 400 });
  }

  const sb = await getChatServiceClientForEmpresa(auth.empresaId);

  const { data: pres, error: eGet } = await sb
    .from("evento_presupuestos")
    .select(
      "id, proyecto_id, cliente_id, titulo_evento, tipo_evento, fecha_evento_aprox, cantidad_invitados, total, cliente_nombre_snapshot, cliente_telefono_snapshot, cliente_email_snapshot"
    )
    .eq("empresa_id", auth.empresaId)
    .eq("id", presupuestoId)
    .maybeSingle();
  if (eGet) return NextResponse.json(errorResponse(eGet.message), { status: 500 });
  if (!pres) return NextResponse.json(errorResponse("Cotización no encontrada."), { status: 404 });

  const patch: Record<string, unknown> = {
    estado: estadoRaw,
    updated_at: new Date().toISOString(),
  };
  if (estadoRaw === "aprobado") patch.aprobado_at = new Date().toISOString();

  const { error: eUp } = await sb
    .from("evento_presupuestos")
    .update(patch)
    .eq("empresa_id", auth.empresaId)
    .eq("id", presupuestoId);
  if (eUp) return NextResponse.json(errorResponse(eUp.message), { status: 500 });

  // Si es aprobación y es cotización standalone (sin evento aún), creamos el evento.
  let eventoCreadoId: string | null = null;
  if (estadoRaw === "aprobado" && !pres.proyecto_id) {
    const res = await crearEventoDesdeCotizacion(sb, auth.empresaId, pres);
    if (res.error) {
      return NextResponse.json(
        errorResponse(`Cotización aprobada, pero falló crear el evento: ${res.error}`),
        { status: 500 }
      );
    }
    eventoCreadoId = res.eventoId;
  }

  return NextResponse.json(successResponse({ ok: true, evento_id: eventoCreadoId }));
}

// DELETE /api/eventos/presupuestos/:id — borra la cotización (uso típico:
// eliminar cotizaciones rechazadas para limpiar historial).
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireProyectosApiAccess(request);
  if (!auth.ok) return NextResponse.json(errorResponse(auth.message), { status: auth.status });
  const { id: presupuestoId } = await params;

  const sb = await getChatServiceClientForEmpresa(auth.empresaId);
  // Borrar items primero (por si la FK no tiene ON DELETE CASCADE en tu schema).
  await sb
    .from("evento_presupuesto_items")
    .delete()
    .eq("empresa_id", auth.empresaId)
    .eq("presupuesto_id", presupuestoId);
  const { error } = await sb
    .from("evento_presupuestos")
    .delete()
    .eq("empresa_id", auth.empresaId)
    .eq("id", presupuestoId);
  if (error) return NextResponse.json(errorResponse(error.message), { status: 500 });
  return NextResponse.json(successResponse({ ok: true }));
}
