import { NextResponse } from "next/server";
import { getChatServiceClientForEmpresa } from "@/app/api/chat/_chat-service-client";
import { errorResponse, successResponse } from "@/lib/api/response";
import { requireProyectosApiAccess } from "@/lib/proyectos/proyectos-auth";

const CATEGORIAS_OK = new Set([
  "catering", "decoracion", "musica", "fotografia", "animacion",
  "mobiliario", "iluminacion", "seguridad", "transporte", "extra",
]);

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireProyectosApiAccess(request);
  if (!auth.ok) return NextResponse.json(errorResponse(auth.message), { status: auth.status });
  const { id } = await params;
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const patch: Record<string, unknown> = {};
  if (typeof body.nombre === "string" && body.nombre.trim()) patch.nombre = body.nombre.trim();
  if (typeof body.categoria === "string" && CATEGORIAS_OK.has(body.categoria)) patch.categoria = body.categoria;
  if (typeof body.descripcion === "string") patch.descripcion = body.descripcion;
  if (typeof body.precio_base === "number" && body.precio_base >= 0) patch.precio_base = body.precio_base;
  if (typeof body.unidad === "string") patch.unidad = body.unidad;
  if (typeof body.activo === "boolean") patch.activo = body.activo;
  patch.updated_at = new Date().toISOString();

  const sb = await getChatServiceClientForEmpresa(auth.empresaId);
  const { data, error } = await sb
    .from("servicios_catalogo")
    .update(patch)
    .eq("empresa_id", auth.empresaId)
    .eq("id", id)
    .select()
    .single();
  if (error) return NextResponse.json(errorResponse(error.message), { status: 500 });
  return NextResponse.json(successResponse({ servicio: data }));
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
    .from("servicios_catalogo")
    .delete()
    .eq("empresa_id", auth.empresaId)
    .eq("id", id);
  if (error) return NextResponse.json(errorResponse(error.message), { status: 500 });
  return NextResponse.json(successResponse({ ok: true }));
}
