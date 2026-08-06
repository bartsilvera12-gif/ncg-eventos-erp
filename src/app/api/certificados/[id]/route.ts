import { NextResponse } from "next/server";
import { getChatServiceClientForEmpresa } from "@/app/api/chat/_chat-service-client";
import { errorResponse, successResponse } from "@/lib/api/response";
import { requireProyectosApiAccess } from "@/lib/proyectos/proyectos-auth";

const CATEGORIAS_OK = new Set([
  "habilitacion", "seguro", "certificado", "licencia",
  "permiso", "contrato", "otro",
]);

const EDITABLE = [
  "nombre", "categoria", "descripcion", "emitido_por", "numero",
  "fecha_emision", "fecha_vencimiento", "alerta_dias_antes",
  "storage_path", "archivo_nombre", "archivo_mime", "archivo_tamano",
  "observaciones", "activo",
] as const;

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireProyectosApiAccess(request);
  if (!auth.ok) return NextResponse.json(errorResponse(auth.message), { status: auth.status });
  const { id } = await params;
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;

  const patch: Record<string, unknown> = {};
  for (const k of EDITABLE) if (k in body) patch[k] = body[k];
  if ("categoria" in patch && !CATEGORIAS_OK.has(String(patch.categoria))) delete patch.categoria;
  patch.updated_at = new Date().toISOString();

  const sb = await getChatServiceClientForEmpresa(auth.empresaId);
  const { data, error } = await sb
    .from("certificados_empresa")
    .update(patch)
    .eq("empresa_id", auth.empresaId)
    .eq("id", id)
    .select()
    .single();
  if (error) return NextResponse.json(errorResponse(error.message), { status: 500 });
  return NextResponse.json(successResponse({ certificado: data }));
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireProyectosApiAccess(request);
  if (!auth.ok) return NextResponse.json(errorResponse(auth.message), { status: auth.status });
  const { id } = await params;
  const sb = await getChatServiceClientForEmpresa(auth.empresaId);
  const { error } = await sb
    .from("certificados_empresa")
    .delete()
    .eq("empresa_id", auth.empresaId)
    .eq("id", id);
  if (error) return NextResponse.json(errorResponse(error.message), { status: 500 });
  return NextResponse.json(successResponse({ ok: true }));
}
