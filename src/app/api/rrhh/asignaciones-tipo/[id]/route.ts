import { NextRequest, NextResponse } from "next/server";
import { getTenantSupabaseFromAuth } from "@/lib/supabase/tenant-api";
import { successResponse, errorResponse } from "@/lib/api/response";
import { API_ERRORS } from "@/lib/api/errors";

/** Acepta cualquier slug — el catálogo de tipos es editable por empresa. */
function sanitizarTipos(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  return Array.from(new Set(
    input
      .map((t) => String(t).trim().toLowerCase())
      .filter(Boolean),
  ));
}

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await getTenantSupabaseFromAuth(_request);
    if (!ctx) return NextResponse.json(errorResponse(API_ERRORS.UNAUTHORIZED), { status: 401 });
    const { id } = await params;
    if (!id) return NextResponse.json(errorResponse("id obligatorio"), { status: 400 });

    const { data, error } = await ctx.supabase
      .from("asignaciones_tipo_empleado")
      .select("*")
      .eq("empresa_id", ctx.auth.empresa_id)
      .eq("id", id)
      .maybeSingle();
    if (error) return NextResponse.json(errorResponse(error.message), { status: 400 });
    if (!data) return NextResponse.json(errorResponse("Asignación no encontrada"), { status: 404 });
    return NextResponse.json(successResponse({ asignacion: data }));
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error";
    return NextResponse.json(errorResponse(msg), { status: 500 });
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await getTenantSupabaseFromAuth(request);
    if (!ctx) return NextResponse.json(errorResponse(API_ERRORS.UNAUTHORIZED), { status: 401 });
    const { id } = await params;
    if (!id) return NextResponse.json(errorResponse("id obligatorio"), { status: 400 });

    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const update: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
      updated_by: ctx.auth.usuarioCatalogId ?? null,
      updated_by_nombre: ctx.auth.usuarioNombre ?? ctx.auth.user?.email ?? null,
    };

    const TEXT = ["descripcion","empleado_id","seccion","sucursal","chofer_habilitacion","chofer_observacion"];
    const DATE = ["chofer_fecha_venc"];
    const NUM  = ["chofer_km"];
    const BOOL = ["activo"];

    if (body.descripcion !== undefined) {
      const n = String(body.descripcion).trim();
      if (!n) return NextResponse.json(errorResponse("La descripción no puede estar vacía"), { status: 400 });
      update.descripcion = n;
    }
    for (const k of TEXT) {
      if (k === "descripcion") continue;
      if (body[k] !== undefined) update[k] = body[k] ? String(body[k]).trim() || null : null;
    }
    for (const k of DATE) {
      if (body[k] !== undefined) update[k] = body[k] ? String(body[k]) : null;
    }
    for (const k of NUM) {
      if (body[k] !== undefined) update[k] = Number(body[k]) || 0;
    }
    for (const k of BOOL) {
      if (body[k] !== undefined) update[k] = Boolean(body[k]);
    }
    if (body.tipos !== undefined) {
      update.tipos = sanitizarTipos(body.tipos);
    }

    const { error } = await ctx.supabase
      .from("asignaciones_tipo_empleado")
      .update(update)
      .eq("id", id)
      .eq("empresa_id", ctx.auth.empresa_id);

    if (error) return NextResponse.json(errorResponse(error.message), { status: 400 });
    return NextResponse.json(successResponse({ ok: true }));
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error";
    return NextResponse.json(errorResponse(msg), { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await getTenantSupabaseFromAuth(_request);
    if (!ctx) return NextResponse.json(errorResponse(API_ERRORS.UNAUTHORIZED), { status: 401 });
    const { id } = await params;
    if (!id) return NextResponse.json(errorResponse("id obligatorio"), { status: 400 });

    const { error } = await ctx.supabase
      .from("asignaciones_tipo_empleado")
      .delete()
      .eq("id", id)
      .eq("empresa_id", ctx.auth.empresa_id);

    if (error) return NextResponse.json(errorResponse(error.message), { status: 400 });
    return NextResponse.json(successResponse({ ok: true }));
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error";
    return NextResponse.json(errorResponse(msg), { status: 500 });
  }
}
