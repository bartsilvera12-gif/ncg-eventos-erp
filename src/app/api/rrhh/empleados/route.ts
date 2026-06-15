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
      .select("*")
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

    const str = (k: string): string | null => body[k] ? String(body[k]).trim() || null : null;
    const date = (k: string): string | null => body[k] ? String(body[k]) : null;
    const numv = (k: string): number => Number(body[k]) || 0;
    const bool = (k: string): boolean => Boolean(body[k]);

    const insert = {
      empresa_id: ctx.auth.empresa_id,
      nombre,
      // Documento
      tipo_documento: str("tipo_documento") ?? "CI",
      documento: str("documento"),
      // Personales
      fecha_nacimiento: date("fecha_nacimiento"),
      lugar_nacimiento: str("lugar_nacimiento"),
      nacionalidad: str("nacionalidad"),
      estado_civil: str("estado_civil"),
      grupo_sanguineo: str("grupo_sanguineo"),
      // Contacto
      direccion: str("direccion"),
      email: str("email"),
      telefono: str("telefono"),
      // Laborales
      cargo: str("cargo"),
      fecha_ingreso: date("fecha_ingreso"),
      fecha_baja: date("fecha_baja"),
      tipo_empleado: str("tipo_empleado"),
      tipo_periodo: str("tipo_periodo") ?? "mensual",
      departamento: str("departamento"),
      seccion: str("seccion"),
      supervisor: str("supervisor"),
      // Compensación
      salario_base: numv("salario_base"),
      salario_complementario: numv("salario_complementario"),
      costo_hora: numv("costo_hora"),
      // Bancario
      banco: str("banco"),
      numero_cuenta: str("numero_cuenta"),
      cobrar_con_cheque: bool("cobrar_con_cheque"),
      // Estado
      excluir_liquidaciones: bool("excluir_liquidaciones"),
      activo: body.activo === undefined ? true : Boolean(body.activo),
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
