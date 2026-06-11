import { NextRequest, NextResponse } from "next/server";
import { getTenantSupabaseFromAuth } from "@/lib/supabase/tenant-api";
import { successResponse, errorResponse } from "@/lib/api/response";
import { API_ERRORS } from "@/lib/api/errors";

function diasEntre(desde: string, hasta: string): number {
  const d1 = new Date(desde).getTime();
  const d2 = new Date(hasta).getTime();
  return Math.max(1, Math.round((d2 - d1) / (1000 * 60 * 60 * 24)) + 1);
}

/**
 * GET /api/rrhh/vacaciones
 *
 * Lista solicitudes de vacaciones con datos del empleado.
 */
export async function GET(request: NextRequest) {
  try {
    const ctx = await getTenantSupabaseFromAuth(request);
    if (!ctx) return NextResponse.json(errorResponse(API_ERRORS.UNAUTHORIZED), { status: 401 });

    const { data, error } = await ctx.supabase
      .from("empleado_vacaciones")
      .select("id, empleado_id, fecha_desde, fecha_hasta, dias, estado, observacion, aprobado_at, created_at, empleados:empleado_id(nombre, cargo)")
      .eq("empresa_id", ctx.auth.empresa_id)
      .order("created_at", { ascending: false });

    if (error) return NextResponse.json(errorResponse(error.message), { status: 400 });

    const solicitudes = (data ?? []).map((row: Record<string, unknown>) => {
      const emp = row.empleados as { nombre?: string; cargo?: string | null } | { nombre?: string; cargo?: string | null }[] | null;
      const e = Array.isArray(emp) ? emp[0] : emp;
      return { ...row, empleado_nombre: e?.nombre ?? null, empleado_cargo: e?.cargo ?? null, empleados: undefined };
    });

    return NextResponse.json(successResponse({ solicitudes }));
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error";
    return NextResponse.json(errorResponse(msg), { status: 500 });
  }
}

/**
 * POST /api/rrhh/vacaciones
 * Body: { empleado_id, fecha_desde, fecha_hasta, observacion? }
 * Crea solicitud en estado 'pendiente'. dias se calcula del rango.
 */
export async function POST(request: NextRequest) {
  try {
    const ctx = await getTenantSupabaseFromAuth(request);
    if (!ctx) return NextResponse.json(errorResponse(API_ERRORS.UNAUTHORIZED), { status: 401 });

    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const empleadoId = String(body.empleado_id ?? "").trim();
    const desde = String(body.fecha_desde ?? "").trim();
    const hasta = String(body.fecha_hasta ?? "").trim();
    if (!empleadoId) return NextResponse.json(errorResponse("Falta empleado_id"), { status: 400 });
    if (!/^\d{4}-\d{2}-\d{2}$/.test(desde) || !/^\d{4}-\d{2}-\d{2}$/.test(hasta)) {
      return NextResponse.json(errorResponse("Fechas inválidas (YYYY-MM-DD)"), { status: 400 });
    }
    if (hasta < desde) return NextResponse.json(errorResponse("fecha_hasta debe ser >= fecha_desde"), { status: 400 });

    const ins = await ctx.supabase
      .from("empleado_vacaciones")
      .insert([{
        empresa_id: ctx.auth.empresa_id,
        empleado_id: empleadoId,
        fecha_desde: desde,
        fecha_hasta: hasta,
        dias: diasEntre(desde, hasta),
        estado: "pendiente",
        observacion: body.observacion ? String(body.observacion).trim() : null,
      }])
      .select()
      .single();
    if (ins.error) return NextResponse.json(errorResponse(ins.error.message), { status: 400 });

    return NextResponse.json(successResponse({ solicitud: ins.data }));
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error";
    return NextResponse.json(errorResponse(msg), { status: 500 });
  }
}
