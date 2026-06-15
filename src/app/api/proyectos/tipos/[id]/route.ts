import { NextResponse } from "next/server";
import { getChatServiceClientForEmpresa } from "@/app/api/chat/_chat-service-client";
import { errorResponse, successResponse } from "@/lib/api/response";
import { requireProyectosApiAccess } from "@/lib/proyectos/proyectos-auth";

/** PATCH /api/proyectos/tipos/[id] — edita nombre, descripcion, activo. */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireProyectosApiAccess(request);
  if (!auth.ok) return NextResponse.json(errorResponse(auth.message), { status: auth.status });
  const { id } = await params;
  if (!id) return NextResponse.json(errorResponse("id obligatorio"), { status: 400 });

  try {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const update: Record<string, unknown> = {};
    if (body.nombre !== undefined) {
      const n = String(body.nombre).trim();
      if (!n) return NextResponse.json(errorResponse("Nombre vacío"), { status: 400 });
      update.nombre = n;
    }
    if (body.descripcion !== undefined) {
      update.descripcion = body.descripcion ? String(body.descripcion).trim() : null;
    }
    if (body.activo !== undefined) update.activo = Boolean(body.activo);
    if (Object.keys(update).length === 0) {
      return NextResponse.json(errorResponse("Nada que actualizar"), { status: 400 });
    }

    const sb = await getChatServiceClientForEmpresa(auth.empresaId);
    const { error } = await sb
      .from("proyecto_tipos")
      .update(update)
      .eq("id", id)
      .eq("empresa_id", auth.empresaId);
    if (error) return NextResponse.json(errorResponse(error.message), { status: 400 });
    return NextResponse.json(successResponse({ ok: true }));
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error";
    return NextResponse.json(errorResponse(msg), { status: 500 });
  }
}

/**
 * DELETE /api/proyectos/tipos/[id]
 * Solo si no hay proyectos vinculados al tipo (FK protege la integridad).
 */
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireProyectosApiAccess(request);
  if (!auth.ok) return NextResponse.json(errorResponse(auth.message), { status: auth.status });
  const { id } = await params;
  if (!id) return NextResponse.json(errorResponse("id obligatorio"), { status: 400 });

  try {
    const sb = await getChatServiceClientForEmpresa(auth.empresaId);
    // Chequear uso
    const { count, error: e1 } = await sb
      .from("proyectos")
      .select("id", { count: "exact", head: true })
      .eq("empresa_id", auth.empresaId)
      .eq("tipo_id", id);
    if (e1) return NextResponse.json(errorResponse(e1.message), { status: 400 });
    if ((count ?? 0) > 0) {
      return NextResponse.json(errorResponse(`Hay ${count} proyecto(s) con este tipo. Desactivalo o reasignalos antes de borrar.`), { status: 400 });
    }
    const { error } = await sb
      .from("proyecto_tipos")
      .delete()
      .eq("id", id)
      .eq("empresa_id", auth.empresaId);
    if (error) return NextResponse.json(errorResponse(error.message), { status: 400 });
    return NextResponse.json(successResponse({ ok: true }));
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error";
    return NextResponse.json(errorResponse(msg), { status: 500 });
  }
}
