import { NextResponse } from "next/server";
import { getChatServiceClientForEmpresa } from "@/app/api/chat/_chat-service-client";
import { errorResponse, successResponse } from "@/lib/api/response";
import { requireProyectosApiAccess } from "@/lib/proyectos/proyectos-auth";

const TIPOS_OK = new Set(["salon", "jardin", "terraza", "escenario", "otro"]);

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireProyectosApiAccess(request);
  if (!auth.ok) return NextResponse.json(errorResponse(auth.message), { status: auth.status });
  const { id } = await params;
  const sb = await getChatServiceClientForEmpresa(auth.empresaId);
  const { data, error } = await sb
    .from("recursos")
    .select("*")
    .eq("empresa_id", auth.empresaId)
    .eq("id", id)
    .maybeSingle();
  if (error) return NextResponse.json(errorResponse(error.message), { status: 500 });
  if (!data) return NextResponse.json(errorResponse("Recurso no encontrado."), { status: 404 });
  return NextResponse.json(successResponse({ recurso: data }));
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
  if (typeof body.nombre === "string" && body.nombre.trim()) patch.nombre = body.nombre.trim();
  if (typeof body.tipo === "string" && TIPOS_OK.has(body.tipo)) patch.tipo = body.tipo;
  if (typeof body.capacidad === "number" && body.capacidad > 0) patch.capacidad = Math.floor(body.capacidad);
  if (body.capacidad === null) patch.capacidad = null;
  if (typeof body.descripcion === "string") patch.descripcion = body.descripcion;
  if (typeof body.activo === "boolean") patch.activo = body.activo;
  patch.updated_at = new Date().toISOString();

  const sb = await getChatServiceClientForEmpresa(auth.empresaId);
  const { data, error } = await sb
    .from("recursos")
    .update(patch)
    .eq("empresa_id", auth.empresaId)
    .eq("id", id)
    .select()
    .single();
  if (error) return NextResponse.json(errorResponse(error.message), { status: 500 });
  return NextResponse.json(successResponse({ recurso: data }));
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
    .from("recursos")
    .delete()
    .eq("empresa_id", auth.empresaId)
    .eq("id", id);
  if (error) return NextResponse.json(errorResponse(error.message), { status: 500 });
  return NextResponse.json(successResponse({ ok: true }));
}
