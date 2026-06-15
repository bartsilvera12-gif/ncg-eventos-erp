import { NextRequest, NextResponse } from "next/server";
import { getTenantSupabaseFromAuth } from "@/lib/supabase/tenant-api";
import { successResponse, errorResponse } from "@/lib/api/response";
import { API_ERRORS } from "@/lib/api/errors";

/**
 * RRHH · Asignaciones de tipo de empleado.
 *
 * Tabla independiente `asignaciones_tipo_empleado`. NO toca `empleados`.
 * Cada fila representa una "ficha" de asignación con descripción libre,
 * tipos (roles), datos de sección/sucursal y, opcionalmente, datos de
 * chofer. Puede o no estar vinculada a un empleado del catálogo.
 */

const TIPOS_VALIDOS = new Set([
  "obrero","capataz","jornalero","soldador","montador",
  "tecnico","administrador","vendedor","cobrador","chofer",
]);

function sanitizarTipos(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  return Array.from(new Set(
    input
      .map((t) => String(t).trim().toLowerCase())
      .filter((t) => t && TIPOS_VALIDOS.has(t)),
  ));
}

export async function GET(request: NextRequest) {
  try {
    const ctx = await getTenantSupabaseFromAuth(request);
    if (!ctx) return NextResponse.json(errorResponse(API_ERRORS.UNAUTHORIZED), { status: 401 });

    const { data, error } = await ctx.supabase
      .from("asignaciones_tipo_empleado")
      .select("*")
      .eq("empresa_id", ctx.auth.empresa_id)
      .order("codigo", { ascending: false });

    if (error) return NextResponse.json(errorResponse(error.message), { status: 400 });
    return NextResponse.json(successResponse({ asignaciones: data ?? [] }));
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error";
    return NextResponse.json(errorResponse(msg), { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const ctx = await getTenantSupabaseFromAuth(request);
    if (!ctx) return NextResponse.json(errorResponse(API_ERRORS.UNAUTHORIZED), { status: 401 });

    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const descripcion = String(body.descripcion ?? "").trim();
    if (!descripcion) return NextResponse.json(errorResponse("La descripción es obligatoria."), { status: 400 });

    const str = (k: string): string | null => body[k] ? String(body[k]).trim() || null : null;
    const date = (k: string): string | null => body[k] ? String(body[k]) : null;
    const numv = (k: string): number => Number(body[k]) || 0;

    const insert = {
      empresa_id: ctx.auth.empresa_id,
      descripcion,
      empleado_id: str("empleado_id"),
      tipos: sanitizarTipos(body.tipos),
      seccion: str("seccion"),
      sucursal: str("sucursal"),
      activo: body.activo === undefined ? true : Boolean(body.activo),
      chofer_habilitacion: str("chofer_habilitacion"),
      chofer_fecha_venc: date("chofer_fecha_venc"),
      chofer_km: numv("chofer_km"),
      chofer_observacion: str("chofer_observacion"),
      created_by: ctx.auth.usuarioCatalogId ?? null,
      created_by_nombre: ctx.auth.usuarioNombre ?? ctx.auth.user?.email ?? null,
    };

    const { data, error } = await ctx.supabase
      .from("asignaciones_tipo_empleado")
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
