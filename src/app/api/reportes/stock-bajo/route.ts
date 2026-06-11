import { NextRequest, NextResponse } from "next/server";
import { getTenantSupabaseFromAuth } from "@/lib/supabase/tenant-api";
import { successResponse, errorResponse } from "@/lib/api/response";
import { API_ERRORS } from "@/lib/api/errors";

/**
 * GET /api/reportes/stock-bajo
 *
 * Productos con stock_actual <= stock_minimo y stock_minimo > 0.
 * Ordenados por mayor diferencia (más urgentes primero).
 */
export async function GET(request: NextRequest) {
  try {
    const ctx = await getTenantSupabaseFromAuth(request);
    if (!ctx) return NextResponse.json(errorResponse(API_ERRORS.UNAUTHORIZED), { status: 401 });

    const { data, error } = await ctx.supabase
      .from("productos")
      .select("id, nombre, sku, stock_actual, stock_minimo, costo_promedio, unidad_medida")
      .eq("empresa_id", ctx.auth.empresa_id)
      .gt("stock_minimo", 0)
      .order("nombre", { ascending: true });

    if (error) return NextResponse.json(errorResponse(error.message), { status: 400 });

    const filas = (data ?? [])
      .map((r: Record<string, unknown>) => {
        const stock = Number(r.stock_actual ?? 0);
        const minimo = Number(r.stock_minimo ?? 0);
        const diff = minimo - stock;
        if (diff < 0) return null;
        const costo = Number(r.costo_promedio ?? 0);
        return {
          id: r.id as string,
          nombre: r.nombre as string,
          sku: r.sku as string,
          stock_actual: stock,
          stock_minimo: minimo,
          deficit: diff,
          unidad_medida: (r.unidad_medida as string) ?? "u",
          costo_reposicion_estimado: diff * costo,
          critico: stock === 0,
        };
      })
      .filter(Boolean) as Array<NonNullable<unknown>>;

    filas.sort((a, b) => (b as { deficit: number }).deficit - (a as { deficit: number }).deficit);

    const totales = filas.reduce(
      (acc, f) => ({
        criticos: acc.criticos + ((f as { critico: boolean }).critico ? 1 : 0),
        costo_reposicion: acc.costo_reposicion + (f as { costo_reposicion_estimado: number }).costo_reposicion_estimado,
      }),
      { criticos: 0, costo_reposicion: 0 }
    );

    return NextResponse.json(successResponse({ filas, cantidad: filas.length, totales }));
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error";
    return NextResponse.json(errorResponse(msg), { status: 500 });
  }
}
