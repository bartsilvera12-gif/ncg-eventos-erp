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
      .select("*")
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

    const TEXT_FIELDS = [
      "tipo_documento","documento","lugar_nacimiento","nacionalidad","estado_civil",
      "grupo_sanguineo","direccion","email","telefono","cargo","tipo_empleado","tipo_periodo",
      "departamento","seccion","supervisor","banco","numero_cuenta",
    ];
    const DATE_FIELDS = ["fecha_nacimiento","fecha_ingreso","fecha_baja"];
    const NUM_FIELDS = ["salario_base","salario_complementario","costo_hora"];
    const BOOL_FIELDS = ["cobrar_con_cheque","excluir_liquidaciones","activo"];

    if (body.nombre !== undefined) {
      const n = String(body.nombre).trim();
      if (!n) return NextResponse.json(errorResponse("El nombre no puede estar vacío"), { status: 400 });
      update.nombre = n;
    }
    for (const k of TEXT_FIELDS) {
      if (body[k] !== undefined) update[k] = body[k] ? String(body[k]).trim() || null : null;
    }
    for (const k of DATE_FIELDS) {
      if (body[k] !== undefined) update[k] = body[k] ? String(body[k]) : null;
    }
    for (const k of NUM_FIELDS) {
      if (body[k] !== undefined) update[k] = Number(body[k]) || 0;
    }
    for (const k of BOOL_FIELDS) {
      if (body[k] !== undefined) update[k] = Boolean(body[k]);
    }

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
