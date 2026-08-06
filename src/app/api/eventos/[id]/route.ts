import { NextResponse } from "next/server";
import { getChatServiceClientForEmpresa } from "@/app/api/chat/_chat-service-client";
import { errorResponse, successResponse } from "@/lib/api/response";
import { requireProyectosApiAccess } from "@/lib/proyectos/proyectos-auth";

const EDITABLE_FIELDS = [
  "titulo", "descripcion", "cliente_id", "estado_id", "prioridad",
  "responsable_comercial_id", "responsable_tecnico_id", "monto_vendido",
  "fecha_evento", "hora_inicio", "hora_fin", "lugar_evento",
  "cantidad_invitados", "tipo_evento", "recurso_id",
  "observaciones_comerciales", "bloqueado", "archivado",
] as const;

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireProyectosApiAccess(request);
  if (!auth.ok) return NextResponse.json(errorResponse(auth.message), { status: auth.status });
  const { id } = await params;
  const sb = await getChatServiceClientForEmpresa(auth.empresaId);
  const { data, error } = await sb
    .from("proyectos")
    .select("*")
    .eq("empresa_id", auth.empresaId)
    .eq("id", id)
    .maybeSingle();
  if (error) return NextResponse.json(errorResponse(error.message), { status: 500 });
  if (!data) return NextResponse.json(errorResponse("Evento no encontrado."), { status: 404 });
  return NextResponse.json(successResponse({ evento: data }));
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireProyectosApiAccess(request);
  if (!auth.ok) return NextResponse.json(errorResponse(auth.message), { status: auth.status });
  const { id } = await params;
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;

  const patch: Record<string, unknown> = {};
  for (const field of EDITABLE_FIELDS) {
    if (field in body) patch[field] = body[field];
  }
  patch.updated_at = new Date().toISOString();
  patch.updated_by = auth.usuarioCatalogId;
  patch.last_activity_at = new Date().toISOString();

  const sb = await getChatServiceClientForEmpresa(auth.empresaId);
  const { data, error } = await sb
    .from("proyectos")
    .update(patch)
    .eq("empresa_id", auth.empresaId)
    .eq("id", id)
    .select("*")
    .single();
  if (error) {
    if (error.code === "23P01" || /exclusion|recurso_horario|overlap/i.test(error.message)) {
      return NextResponse.json(
        errorResponse("Cambio bloqueado: otro evento ya usa ese recurso/horario."),
        { status: 409 }
      );
    }
    return NextResponse.json(errorResponse(error.message), { status: 500 });
  }
  return NextResponse.json(successResponse({ evento: data }));
}
