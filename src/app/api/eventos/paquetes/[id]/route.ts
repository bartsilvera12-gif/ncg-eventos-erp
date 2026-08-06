import { NextResponse } from "next/server";
import { getChatServiceClientForEmpresa } from "@/app/api/chat/_chat-service-client";
import { errorResponse, successResponse } from "@/lib/api/response";
import { requireProyectosApiAccess } from "@/lib/proyectos/proyectos-auth";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireProyectosApiAccess(request);
  if (!auth.ok) return NextResponse.json(errorResponse(auth.message), { status: auth.status });
  const { id } = await params;
  const sb = await getChatServiceClientForEmpresa(auth.empresaId);
  const { data: paquete, error: eP } = await sb
    .from("paquetes_evento")
    .select("*")
    .eq("empresa_id", auth.empresaId)
    .eq("id", id)
    .maybeSingle();
  if (eP) return NextResponse.json(errorResponse(eP.message), { status: 500 });
  if (!paquete) return NextResponse.json(errorResponse("Paquete no encontrado."), { status: 404 });

  const { data: items, error: eI } = await sb
    .from("paquete_items")
    .select("*, servicios_catalogo:servicio_id(nombre, categoria)")
    .eq("paquete_id", id)
    .order("created_at");
  if (eI) return NextResponse.json(errorResponse(eI.message), { status: 500 });

  return NextResponse.json(successResponse({ paquete, items: items ?? [] }));
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
  if (typeof body.descripcion === "string") patch.descripcion = body.descripcion;
  if (typeof body.precio_total === "number" && body.precio_total >= 0) patch.precio_total = body.precio_total;
  if (typeof body.activo === "boolean") patch.activo = body.activo;
  patch.updated_at = new Date().toISOString();

  const sb = await getChatServiceClientForEmpresa(auth.empresaId);
  const { data, error } = await sb
    .from("paquetes_evento")
    .update(patch)
    .eq("empresa_id", auth.empresaId)
    .eq("id", id)
    .select()
    .single();
  if (error) return NextResponse.json(errorResponse(error.message), { status: 500 });
  return NextResponse.json(successResponse({ paquete: data }));
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
    .from("paquetes_evento")
    .delete()
    .eq("empresa_id", auth.empresaId)
    .eq("id", id);
  if (error) return NextResponse.json(errorResponse(error.message), { status: 500 });
  return NextResponse.json(successResponse({ ok: true }));
}
