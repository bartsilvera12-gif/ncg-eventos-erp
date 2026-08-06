import { NextResponse } from "next/server";
import { getChatServiceClientForEmpresa } from "@/app/api/chat/_chat-service-client";
import { errorResponse, successResponse } from "@/lib/api/response";
import { requireProyectosApiAccess } from "@/lib/proyectos/proyectos-auth";

// GET /api/eventos/calendario?desde=YYYY-MM-DD&hasta=YYYY-MM-DD
// Devuelve eventos con fecha_evento en el rango, incluyendo nombre del cliente,
// nombre del recurso y color del estado para render de calendar view.
export async function GET(request: Request) {
  const auth = await requireProyectosApiAccess(request);
  if (!auth.ok) return NextResponse.json(errorResponse(auth.message), { status: auth.status });

  const sp = new URL(request.url).searchParams;
  const desde = sp.get("desde");
  const hasta = sp.get("hasta");
  if (!desde || !hasta) {
    return NextResponse.json(errorResponse("Faltan parámetros desde/hasta."), { status: 400 });
  }

  const sb = await getChatServiceClientForEmpresa(auth.empresaId);
  const { data, error } = await sb
    .from("proyectos")
    .select(
      `id, titulo, cliente_id, estado_id, fecha_evento, hora_inicio, hora_fin,
       lugar_evento, cantidad_invitados, tipo_evento, recurso_id,
       clientes:cliente_id(empresa, nombre_contacto),
       recursos:recurso_id(nombre),
       proyecto_estados:estado_id(codigo, nombre, color)`
    )
    .eq("empresa_id", auth.empresaId)
    .eq("archivado", false)
    .not("fecha_evento", "is", null)
    .gte("fecha_evento", desde)
    .lte("fecha_evento", hasta)
    .order("fecha_evento");

  if (error) return NextResponse.json(errorResponse(error.message), { status: 500 });

  // Aplanar joins para consumo directo en el calendar.
  const eventos = (data ?? []).map((r) => {
    const raw = r as Record<string, unknown>;
    const cliente = raw.clientes as { empresa?: string; nombre_contacto?: string } | null;
    const recurso = raw.recursos as { nombre?: string } | null;
    const estado = raw.proyecto_estados as { codigo?: string; nombre?: string; color?: string } | null;
    return {
      id: raw.id,
      titulo: raw.titulo,
      cliente_nombre: cliente?.empresa || cliente?.nombre_contacto || null,
      fecha_evento: raw.fecha_evento,
      hora_inicio: raw.hora_inicio,
      hora_fin: raw.hora_fin,
      lugar_evento: raw.lugar_evento,
      cantidad_invitados: raw.cantidad_invitados,
      tipo_evento: raw.tipo_evento,
      recurso_id: raw.recurso_id,
      recurso_nombre: recurso?.nombre ?? null,
      estado_codigo: estado?.codigo ?? null,
      estado_nombre: estado?.nombre ?? null,
      estado_color: estado?.color ?? null,
    };
  });

  return NextResponse.json(successResponse({ eventos }));
}
