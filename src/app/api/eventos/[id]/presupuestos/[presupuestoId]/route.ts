import { NextResponse } from "next/server";
import { getChatServiceClientForEmpresa } from "@/app/api/chat/_chat-service-client";
import { errorResponse, successResponse } from "@/lib/api/response";
import { requireProyectosApiAccess } from "@/lib/proyectos/proyectos-auth";

const ESTADOS_OK = new Set(["borrador", "enviado", "aprobado", "rechazado"]);

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; presupuestoId: string }> }
) {
  const auth = await requireProyectosApiAccess(request);
  if (!auth.ok) return NextResponse.json(errorResponse(auth.message), { status: auth.status });
  const { presupuestoId } = await params;
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const patch: Record<string, unknown> = {};
  if (typeof body.estado === "string" && ESTADOS_OK.has(body.estado)) {
    patch.estado = body.estado;
    if (body.estado === "aprobado") patch.aprobado_at = new Date().toISOString();
  }
  if (typeof body.observaciones === "string") patch.observaciones = body.observaciones;
  patch.updated_at = new Date().toISOString();

  const sb = await getChatServiceClientForEmpresa(auth.empresaId);
  const { error } = await sb
    .from("evento_presupuestos")
    .update(patch)
    .eq("empresa_id", auth.empresaId)
    .eq("id", presupuestoId);
  if (error) return NextResponse.json(errorResponse(error.message), { status: 500 });
  return NextResponse.json(successResponse({ ok: true }));
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string; presupuestoId: string }> }
) {
  const auth = await requireProyectosApiAccess(request);
  if (!auth.ok) return NextResponse.json(errorResponse(auth.message), { status: auth.status });
  const { presupuestoId } = await params;
  const sb = await getChatServiceClientForEmpresa(auth.empresaId);
  const { error } = await sb
    .from("evento_presupuestos")
    .delete()
    .eq("empresa_id", auth.empresaId)
    .eq("id", presupuestoId);
  if (error) return NextResponse.json(errorResponse(error.message), { status: 500 });
  return NextResponse.json(successResponse({ ok: true }));
}
