import { NextRequest, NextResponse } from "next/server";
import { getTenantSupabaseFromAuth } from "@/lib/supabase/tenant-api";
import { successResponse, errorResponse } from "@/lib/api/response";
import { API_ERRORS } from "@/lib/api/errors";

/**
 * GET /api/rrhh/empleados/[id] — obtiene un empleado por id (mismo tenant).
 */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await getTenantSupabaseFromAuth(_request);
    if (!ctx) return NextResponse.json(errorResponse(API_ERRORS.UNAUTHORIZED), { status: 401 });
    const { id } = await params;
    if (!id) return NextResponse.json(errorResponse("id obligatorio"), { status: 400 });

    const { data, error } = await ctx.supabase
      .from("empleados")
      .select("id, nombre, documento, cargo, salario_base, costo_hora, activo, fecha_ingreso")
      .eq("empresa_id", ctx.auth.empresa_id)
      .eq("id", id)
      .maybeSingle();
    if (error) return NextResponse.json(errorResponse(error.message), { status: 400 });
    if (!data) return NextResponse.json(errorResponse("Empleado no encontrado"), { status: 404 });
    return NextResponse.json(successResponse({ empleado: data }));
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error";
    return NextResponse.json(errorResponse(msg), { status: 500 });
  }
}

/**
 * PATCH /api/rrhh/empleados/[id] — edita campos del empleado.
 * Body: { nombre?, documento?, cargo?, salario_base?, costo_hora?, fecha_ingreso?, activo? }
 */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await getTenantSupabaseFromAuth(request);
    if (!ctx) return NextResponse.json(errorResponse(API_ERRORS.UNAUTHORIZED), { status: 401 });
    const { id } = await params;
    if (!id) return NextResponse.json(errorResponse("id obligatorio"), { status: 400 });

    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const update: Record<string, unknown> = { updated_at: new Date().toISOString() };

    if (body.nombre !== undefined) {
      const n = String(body.nombre).trim();
      if (!n) return NextResponse.json(errorResponse("El nombre no puede estar vacío"), { status: 400 });
      update.nombre = n;
    }
    if (body.documento !== undefined) update.documento = body.documento ? String(body.documento).trim() : null;
    if (body.cargo !== undefined) update.cargo = body.cargo ? String(body.cargo).trim() : null;
    if (body.salario_base !== undefined) update.salario_base = Number(body.salario_base) || 0;
    if (body.costo_hora !== undefined) update.costo_hora = Number(body.costo_hora) || 0;
    if (body.fecha_ingreso !== undefined) update.fecha_ingreso = body.fecha_ingreso ? String(body.fecha_ingreso) : null;
    if (body.activo !== undefined) update.activo = Boolean(body.activo);

    const { error } = await ctx.supabase
      .from("empleados")
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
