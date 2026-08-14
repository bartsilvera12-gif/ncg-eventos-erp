import { NextResponse } from "next/server";
import { getChatServiceClientForEmpresa } from "@/app/api/chat/_chat-service-client";
import { errorResponse, successResponse } from "@/lib/api/response";
import { requireProyectosApiAccess } from "@/lib/proyectos/proyectos-auth";

const PRIORIDADES = new Set(["baja", "normal", "alta", "urgente"]);

// GET /api/eventos — lista eventos (proyectos con fecha_evento). Filtros:
//   ?estado_id=, ?desde=YYYY-MM-DD, ?hasta=YYYY-MM-DD, ?cliente_id=, ?q=
export async function GET(request: Request) {
  const auth = await requireProyectosApiAccess(request);
  if (!auth.ok) return NextResponse.json(errorResponse(auth.message), { status: auth.status });

  const sp = new URL(request.url).searchParams;
  const sb = await getChatServiceClientForEmpresa(auth.empresaId);

  let q = sb
    .from("proyectos")
    .select(
      "id, empresa_id, cliente_id, tipo_id, estado_id, titulo, descripcion, prioridad, " +
        "responsable_comercial_id, responsable_tecnico_id, monto_vendido, " +
        "fecha_evento, hora_inicio, hora_fin, lugar_evento, cantidad_invitados, " +
        "tipo_evento, recurso_id, brief_data, archivado, bloqueado, created_at, updated_at"
    )
    .eq("empresa_id", auth.empresaId)
    .eq("archivado", false)
    .order("fecha_evento", { ascending: true, nullsFirst: false });

  const estadoId = sp.get("estado_id");
  if (estadoId) q = q.eq("estado_id", estadoId);
  const clienteId = sp.get("cliente_id");
  if (clienteId) q = q.eq("cliente_id", clienteId);
  const desde = sp.get("desde") ?? sp.get("fecha_desde");
  if (desde) q = q.gte("fecha_evento", desde);
  const hasta = sp.get("hasta") ?? sp.get("fecha_hasta");
  if (hasta) q = q.lte("fecha_evento", hasta);
  const term = sp.get("q");
  if (term) q = q.ilike("titulo", `%${term}%`);

  const { data, error } = await q;
  if (error) return NextResponse.json(errorResponse(error.message), { status: 500 });
  return NextResponse.json(successResponse({ eventos: data ?? [] }));
}

// POST /api/eventos — crea evento. Body: cliente_id, titulo, fecha_evento,
// hora_inicio, hora_fin, lugar_evento, cantidad_invitados, tipo_evento,
// recurso_id, responsable_*_id, prioridad, observaciones, estado_id.
export async function POST(request: Request) {
  const auth = await requireProyectosApiAccess(request);
  if (!auth.ok) return NextResponse.json(errorResponse(auth.message), { status: auth.status });

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const titulo = String(body.titulo ?? "").trim();
  if (!titulo) return NextResponse.json(errorResponse("El título es obligatorio."), { status: 400 });

  const sb = await getChatServiceClientForEmpresa(auth.empresaId);

  // Resolver estado inicial: si viene explícito lo uso; si no, tomo el marcado
  // como es_estado_inicial=true. Fallback al primer estado por sort_order.
  // Si la empresa no tiene ningún estado cargado, seedeamos los 7 estados
  // estándar de evento (mismo set que el seed de la migración) para no dejar
  // bloqueada la creación.
  let estadoId = typeof body.estado_id === "string" ? body.estado_id : null;
  if (!estadoId) {
    const { data: estIni } = await sb
      .from("proyecto_estados")
      .select("id")
      .eq("empresa_id", auth.empresaId)
      .eq("es_estado_inicial", true)
      .maybeSingle();
    if (estIni?.id) estadoId = estIni.id as string;
    else {
      const { data: primer } = await sb
        .from("proyecto_estados")
        .select("id")
        .eq("empresa_id", auth.empresaId)
        .order("sort_order")
        .limit(1);
      estadoId = ((primer ?? [])[0]?.id as string) ?? null;
    }
  }
  if (!estadoId) {
    // Seed on-demand para empresas sin estados. Coincide con el set del
    // migration 20260620120000_eventos_modulo.sql.
    const seedEstados = [
      { codigo: "consulta",       nombre: "Consulta",       color: "#94A3B8", sort_order: 1,  tipo_sla: "interno", es_estado_inicial: true,  es_estado_final: false },
      { codigo: "presupuestado",  nombre: "Presupuestado",  color: "#0EA5E9", sort_order: 2,  tipo_sla: "cliente", es_estado_inicial: false, es_estado_final: false },
      { codigo: "reservado",      nombre: "Reservado",      color: "#F59E0B", sort_order: 3,  tipo_sla: "cliente", es_estado_inicial: false, es_estado_final: false },
      { codigo: "confirmado",     nombre: "Confirmado",     color: "#10B981", sort_order: 4,  tipo_sla: "interno", es_estado_inicial: false, es_estado_final: false },
      { codigo: "en_preparacion", nombre: "En preparación", color: "#8B5CF6", sort_order: 5,  tipo_sla: "interno", es_estado_inicial: false, es_estado_final: false },
      { codigo: "realizado",      nombre: "Realizado",      color: "#059669", sort_order: 6,  tipo_sla: "final",   es_estado_inicial: false, es_estado_final: true  },
      { codigo: "cancelado",      nombre: "Cancelado",      color: "#EF4444", sort_order: 99, tipo_sla: "final",   es_estado_inicial: false, es_estado_final: true  },
    ];
    const { data: seeded, error: errSeed } = await sb
      .from("proyecto_estados")
      .insert(seedEstados.map((e) => ({ empresa_id: auth.empresaId, activo: true, ...e })))
      .select("id, es_estado_inicial");
    if (errSeed) {
      return NextResponse.json(
        errorResponse(`No se pudo inicializar los estados de evento: ${errSeed.message}`),
        { status: 500 }
      );
    }
    const iniRow = ((seeded ?? []) as { id: string; es_estado_inicial: boolean }[]).find(
      (r) => r.es_estado_inicial
    );
    estadoId = iniRow?.id ?? ((seeded ?? [])[0] as { id?: string } | undefined)?.id ?? null;
    if (!estadoId) {
      return NextResponse.json(
        errorResponse("No se pudo resolver el estado inicial del evento."),
        { status: 500 }
      );
    }
  }

  // Resolver tipo_id: proyectos.tipo_id es NOT NULL. Si no viene en el body,
  // uso el primer tipo activo de la empresa. Si no existe ninguno, creo un
  // catch-all "Evento" para no dejar la creación bloqueada.
  let tipoId = typeof body.tipo_id === "string" ? body.tipo_id : null;
  if (!tipoId) {
    const { data: tipos } = await sb
      .from("proyecto_tipos")
      .select("id")
      .eq("empresa_id", auth.empresaId)
      .eq("activo", true)
      .order("nombre")
      .limit(1);
    tipoId = ((tipos ?? [])[0]?.id as string | undefined) ?? null;
    if (!tipoId) {
      const { data: nuevo, error: errTipo } = await sb
        .from("proyecto_tipos")
        .insert({
          empresa_id: auth.empresaId,
          nombre: "Evento",
          codigo: "evento",
          activo: true,
        })
        .select("id")
        .single();
      if (errTipo) {
        return NextResponse.json(
          errorResponse(`No se pudo resolver el tipo de evento: ${errTipo.message}`),
          { status: 500 }
        );
      }
      tipoId = (nuevo as { id: string }).id;
    }
  }

  const prioridadRaw = String(body.prioridad ?? "normal");
  const prioridad = PRIORIDADES.has(prioridadRaw) ? prioridadRaw : "normal";

  const insert: Record<string, unknown> = {
    empresa_id: auth.empresaId,
    cliente_id: typeof body.cliente_id === "string" ? body.cliente_id : null,
    estado_id: estadoId,
    tipo_id: tipoId,
    titulo,
    descripcion: typeof body.descripcion === "string" ? body.descripcion : null,
    prioridad,
    responsable_comercial_id:
      typeof body.responsable_comercial_id === "string" ? body.responsable_comercial_id : null,
    responsable_tecnico_id:
      typeof body.responsable_tecnico_id === "string" ? body.responsable_tecnico_id : null,
    // Campos específicos de evento
    fecha_evento: typeof body.fecha_evento === "string" ? body.fecha_evento : null,
    hora_inicio: typeof body.hora_inicio === "string" ? body.hora_inicio : null,
    hora_fin: typeof body.hora_fin === "string" ? body.hora_fin : null,
    lugar_evento: typeof body.lugar_evento === "string" ? body.lugar_evento : null,
    cantidad_invitados:
      typeof body.cantidad_invitados === "number" && body.cantidad_invitados > 0
        ? Math.floor(body.cantidad_invitados)
        : null,
    tipo_evento: typeof body.tipo_evento === "string" ? body.tipo_evento : null,
    recurso_id: typeof body.recurso_id === "string" ? body.recurso_id : null,
    observaciones_comerciales:
      typeof body.observaciones === "string" ? body.observaciones : null,
    fecha_ingreso: new Date().toISOString(),
    ultimo_movimiento_at: new Date().toISOString(),
    last_activity_at: new Date().toISOString(),
    created_by: auth.usuarioCatalogId,
    updated_by: auth.usuarioCatalogId,
  };

  const { data, error } = await sb.from("proyectos").insert(insert).select("*").single();

  if (error) {
    // Constraint de exclusión anti-doble-reserva (proyectos_recurso_horario_excl)
    if (error.code === "23P01" || /exclusion|recurso_horario|overlap/i.test(error.message)) {
      return NextResponse.json(
        errorResponse(
          "Ya existe otro evento en ese recurso, fecha y horario. Elegí otro salón u otro horario."
        ),
        { status: 409 }
      );
    }
    return NextResponse.json(errorResponse(error.message), { status: 500 });
  }
  return NextResponse.json(successResponse({ evento: data }));
}
