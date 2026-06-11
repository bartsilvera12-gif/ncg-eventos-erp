import { NextRequest, NextResponse } from "next/server";
import { getTenantSupabaseFromAuth } from "@/lib/supabase/tenant-api";
import { successResponse, errorResponse } from "@/lib/api/response";
import { API_ERRORS } from "@/lib/api/errors";

/**
 * GET /api/rrhh/empleados — lista todos los empleados del tenant.
 */
export async function GET(request: NextRequest) {
  try {
    const ctx = await getTenantSupabaseFromAuth(request);
    if (!ctx) return NextResponse.json(errorResponse(API_ERRORS.UNAUTHORIZED), { status: 401 });

    const { data, error } = await ctx.supabase
      .from("empleados")
      .select("id, nombre, documento, cargo, salario_base, costo_hora, activo, fecha_ingreso, created_at")
      .eq("empresa_id", ctx.auth.empresa_id)
      .order("nombre", { ascending: true });

    if (error) return NextResponse.json(errorResponse(error.message), { status: 400 });
    return NextResponse.json(successResponse({ empleados: data ?? [] }));
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error";
    return NextResponse.json(errorResponse(msg), { status: 500 });
  }
}

/**
 * POST /api/rrhh/empleados — crea un empleado.
 * Body: { nombre, documento?, cargo?, salario_base?, costo_hora?, fecha_ingreso? }
 */
export async function POST(request: NextRequest) {
  try {
    const ctx = await getTenantSupabaseFromAuth(request);
    if (!ctx) return NextResponse.json(errorResponse(API_ERRORS.UNAUTHORIZED), { status: 401 });

    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const nombre = String(body.nombre ?? "").trim();
    if (!nombre) return NextResponse.json(errorResponse("El nombre es obligatorio."), { status: 400 });

    const insert = {
      empresa_id: ctx.auth.empresa_id,
      nombre,
      documento: body.documento ? String(body.documento).trim() : null,
      cargo: body.cargo ? String(body.cargo).trim() : null,
      salario_base: Number(body.salario_base) || 0,
      costo_hora: Number(body.costo_hora) || 0,
      fecha_ingreso: body.fecha_ingreso ? String(body.fecha_ingreso) : null,
      activo: true,
    };

    const { data, error } = await ctx.supabase
      .from("empleados")
      .insert([insert])
      .select()
      .single();

    if (error) return NextResponse.json(errorResponse(error.message), { status: 400 });
    return NextResponse.json(successResponse({ empleado: data }));
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error";
    return NextResponse.json(errorResponse(msg), { status: 500 });
  }
}
