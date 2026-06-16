import { NextRequest, NextResponse } from "next/server";
import { getTenantSupabaseFromAuth } from "@/lib/supabase/tenant-api";
import { successResponse, errorResponse } from "@/lib/api/response";
import { API_ERRORS } from "@/lib/api/errors";
import {
  ensureSemillasTiposEmpleado,
  generarSlugDesdeNombre,
  type TipoEmpleadoRow,
} from "@/lib/rrhh/tipos-empleado-catalogo";

/**
 * GET /api/rrhh/tipos-empleado-catalogo
 *   - default: trae sólo activos, orden asc (forms)
 *   - ?all=1: trae todos (admin)
 */
export async function GET(request: NextRequest) {
  try {
    const ctx = await getTenantSupabaseFromAuth(request);
    if (!ctx) return NextResponse.json(errorResponse(API_ERRORS.UNAUTHORIZED), { status: 401 });

    await ensureSemillasTiposEmpleado(ctx.supabase, ctx.auth.empresa_id);

    const all = request.nextUrl.searchParams.get("all") === "1";
    let q = ctx.supabase
      .from("tipos_empleado_catalogo")
      .select("id, empresa_id, slug, nombre, activo, orden, es_sistema, created_at, updated_at")
      .eq("empresa_id", ctx.auth.empresa_id)
      .order("orden", { ascending: true });
    if (!all) q = q.eq("activo", true);

    const { data, error } = await q;
    if (error) return NextResponse.json(errorResponse(error.message), { status: 400 });
    return NextResponse.json(successResponse({ tipos: (data ?? []) as TipoEmpleadoRow[] }));
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error";
    return NextResponse.json(errorResponse(msg), { status: 500 });
  }
}

/**
 * POST /api/rrhh/tipos-empleado-catalogo
 * Body: { nombre: string, orden?: number }
 */
export async function POST(request: NextRequest) {
  try {
    const ctx = await getTenantSupabaseFromAuth(request);
    if (!ctx) return NextResponse.json(errorResponse(API_ERRORS.UNAUTHORIZED), { status: 401 });

    await ensureSemillasTiposEmpleado(ctx.supabase, ctx.auth.empresa_id);

    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const nombre = typeof body.nombre === "string" ? body.nombre.trim() : "";
    if (!nombre || nombre.length > 200) {
      return NextResponse.json(errorResponse("nombre inválido"), { status: 400 });
    }

    const { data: exist, error: errList } = await ctx.supabase
      .from("tipos_empleado_catalogo")
      .select("slug")
      .eq("empresa_id", ctx.auth.empresa_id);
    if (errList) return NextResponse.json(errorResponse(errList.message), { status: 400 });

    const set = new Set<string>(((exist ?? []) as { slug: string }[]).map((e) => e.slug));
    const slug = generarSlugDesdeNombre(nombre, set);

    const ordenRaw = body.orden;
    const orden = typeof ordenRaw === "number" && Number.isFinite(ordenRaw)
      ? Math.max(0, Math.min(32000, Math.trunc(ordenRaw)))
      : 999;

    const { data, error } = await ctx.supabase
      .from("tipos_empleado_catalogo")
      .insert({
        empresa_id: ctx.auth.empresa_id,
        slug,
        nombre,
        activo: true,
        orden,
        es_sistema: false,
      })
      .select("id, empresa_id, slug, nombre, activo, orden, es_sistema, created_at, updated_at")
      .single();
    if (error) {
      if (String(error.message).toLowerCase().includes("unique")) {
        return NextResponse.json(errorResponse("Ya existe un tipo con ese identificador"), { status: 400 });
      }
      return NextResponse.json(errorResponse(error.message), { status: 400 });
    }
    return NextResponse.json(successResponse({ tipo: data }), { status: 201 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error";
    return NextResponse.json(errorResponse(msg), { status: 500 });
  }
}
