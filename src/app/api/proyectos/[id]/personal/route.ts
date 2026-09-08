import { NextRequest, NextResponse } from "next/server";
import { getTenantSupabaseFromAuth } from "@/lib/supabase/tenant-api";
import { successResponse, errorResponse } from "@/lib/api/response";
import { API_ERRORS } from "@/lib/api/errors";

/**
 * GET /api/proyectos/[id]/personal — asignaciones de empleados a una obra.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await getTenantSupabaseFromAuth(request);
    if (!ctx) return NextResponse.json(errorResponse(API_ERRORS.UNAUTHORIZED), { status: 401 });
    const { id } = await params;
    const pid = id?.trim() ?? "";
    if (!pid) return NextResponse.json(errorResponse("id obligatorio"), { status: 400 });

    const { data, error } = await ctx.supabase
      .from("empleado_asignaciones")
      .select("id, empleado_id, nombre_ad_hoc, fecha, horas, costo_total, observacion, created_at, empleados:empleado_id(nombre, cargo)")
      .eq("empresa_id", ctx.auth.empresa_id)
      .eq("proyecto_id", pid)
      .order("fecha", { ascending: false });

    if (error) return NextResponse.json(errorResponse(error.message), { status: 400 });

    /** Aplana el join {empleados: {nombre, cargo}} → empleado_nombre / empleado_cargo.
     *  Si es una asignacion ad-hoc (sin empleado_id), usa nombre_ad_hoc como empleado_nombre. */
    const asignaciones = (data ?? []).map((row: Record<string, unknown>) => {
      const emp = row.empleados as { nombre?: string; cargo?: string | null } | { nombre?: string; cargo?: string | null }[] | null;
      const e = Array.isArray(emp) ? emp[0] : emp;
      const nombre = e?.nombre ?? (row.nombre_ad_hoc as string | null) ?? null;
      return { ...row, empleado_nombre: nombre, empleado_cargo: e?.cargo ?? null, empleados: undefined };
    });

    return NextResponse.json(successResponse({ asignaciones }));
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error";
    return NextResponse.json(errorResponse(msg), { status: 500 });
  }
}

/**
 * POST /api/proyectos/[id]/personal — asigna un empleado a la obra.
 * Body: { empleado_id, fecha?, horas, costo_total?, observacion? }
 * Si costo_total no se manda, lo calcula como horas * empleado.costo_hora.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await getTenantSupabaseFromAuth(request);
    if (!ctx) return NextResponse.json(errorResponse(API_ERRORS.UNAUTHORIZED), { status: 401 });
    const { id } = await params;
    const pid = id?.trim() ?? "";
    if (!pid) return NextResponse.json(errorResponse("id obligatorio"), { status: 400 });

    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const empleadoId = String(body.empleado_id ?? "").trim() || null;
    const nombreAdHoc = String(body.nombre_ad_hoc ?? "").trim() || null;
    if (!empleadoId && !nombreAdHoc) {
      return NextResponse.json(errorResponse("Cargá un empleado registrado o el nombre del empleado ocasional."), { status: 400 });
    }

    const horas = Number(body.horas) || 0;
    const costoInput = Number(body.costo_total) || 0;
    // Para asignaciones ad-hoc: no exigimos horas (basta con el total a pagar).
    // Para empleados registrados: mantenemos horas > 0 (para calcular auto si costo esta en 0).
    if (empleadoId && horas <= 0 && costoInput <= 0) {
      return NextResponse.json(errorResponse("Cargá horas o total a pagar."), { status: 400 });
    }
    if (nombreAdHoc && costoInput <= 0) {
      return NextResponse.json(errorResponse("Cargá el total a pagar para el empleado ocasional."), { status: 400 });
    }

    let costoTotal = costoInput;
    if (costoTotal <= 0 && empleadoId) {
      const { data: emp } = await ctx.supabase
        .from("empleados")
        .select("costo_hora")
        .eq("empresa_id", ctx.auth.empresa_id)
        .eq("id", empleadoId)
        .maybeSingle();
      const ch = emp ? Number((emp as { costo_hora?: number | string }).costo_hora ?? 0) : 0;
      costoTotal = ch * horas;
    }

    const insert = {
      empresa_id: ctx.auth.empresa_id,
      empleado_id: empleadoId,
      nombre_ad_hoc: nombreAdHoc,
      proyecto_id: pid,
      fecha: body.fecha ? String(body.fecha) : new Date().toISOString().slice(0, 10),
      horas,
      costo_total: costoTotal,
      observacion: body.observacion ? String(body.observacion).trim() : null,
    };

    const { data, error } = await ctx.supabase
      .from("empleado_asignaciones")
      .insert([insert])
      .select()
      .single();

    if (error) return NextResponse.json(errorResponse(error.message), { status: 400 });
    return NextResponse.json(successResponse({ asignacion: data }));
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error";
    return NextResponse.json(errorResponse(msg), { status: 500 });
  }
}
