import { NextRequest, NextResponse } from "next/server";
import { getTenantSupabaseFromAuth } from "@/lib/supabase/tenant-api";
import { successResponse, errorResponse } from "@/lib/api/response";
import { API_ERRORS } from "@/lib/api/errors";

/**
 * GET /api/inventario/movimientos — lista movimientos via PostgREST (compat Hostinger sin pool PG).
 */
export async function GET(request: NextRequest) {
  try {
    const ctx = await getTenantSupabaseFromAuth(request);
    if (!ctx) return NextResponse.json(errorResponse(API_ERRORS.UNAUTHORIZED), { status: 401 });
    const empresaId = ctx.auth.empresa_id;

    const { data, error } = await ctx.supabase
      .from("movimientos_inventario")
      .select(
        "id, empresa_id, producto_id, producto_nombre, producto_sku, tipo, cantidad, costo_unitario, origen, referencia, fecha, created_at, updated_at, created_by, usuario_nombre, proyecto_id, proyectos:proyecto_id(titulo)"
      )
      .eq("empresa_id", empresaId)
      .order("fecha", { ascending: false })
      .limit(500);
    if (error) throw new Error(error.message);

    /** Aplana el join PostgREST {proyectos: {titulo}} → proyecto_titulo. */
    const movimientos = (data ?? []).map((row: Record<string, unknown>) => {
      const proyectos = row.proyectos as { titulo?: string } | { titulo?: string }[] | null | undefined;
      const titulo = Array.isArray(proyectos) ? proyectos[0]?.titulo : proyectos?.titulo;
      return { ...row, proyecto_titulo: titulo ?? null, proyectos: undefined };
    });

    return NextResponse.json(successResponse({ movimientos }));
  } catch (err) {
    console.error("[/api/inventario/movimientos GET]", err instanceof Error ? err.message : err);
    return NextResponse.json(errorResponse("No se pudieron cargar los movimientos."), { status: 500 });
  }
}
