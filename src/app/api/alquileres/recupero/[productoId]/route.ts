import { NextRequest, NextResponse } from "next/server";
import { getTenantSupabaseFromAuth } from "@/lib/supabase/tenant-api";
import { fetchDataSchemaForEmpresaId } from "@/lib/supabase/empresa-data-schema";
import { successResponse, errorResponse } from "@/lib/api/response";
import { API_ERRORS } from "@/lib/api/errors";
import { getRecuperoProducto } from "@/lib/alquileres/server/alquileres-pg";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ productoId: string }> }
) {
  try {
    const ctx = await getTenantSupabaseFromAuth(request);
    if (!ctx) return NextResponse.json(errorResponse(API_ERRORS.UNAUTHORIZED), { status: 401 });
    const { productoId } = await params;
    const schema = await fetchDataSchemaForEmpresaId(ctx.auth.empresa_id);
    const row = await getRecuperoProducto(schema, productoId);
    if (!row) {
      return NextResponse.json(successResponse({
        recupero: {
          producto_id: productoId,
          costo_total_invertido: 0,
          ingreso_real_alquiler: 0,
          porcentaje_recuperado: 0,
          monto_faltante: 0,
        },
      }));
    }
    return NextResponse.json(successResponse({
      recupero: {
        producto_id: row.producto_id,
        costo_total_invertido: Number(row.costo_total_invertido) || 0,
        ingreso_real_alquiler: Number(row.ingreso_real_alquiler) || 0,
        porcentaje_recuperado: Number(row.porcentaje_recuperado) || 0,
        monto_faltante: Number(row.monto_faltante) || 0,
      },
    }));
  } catch (err) {
    console.error("[/api/alquileres/recupero/:productoId GET]", err instanceof Error ? err.message : err);
    return NextResponse.json(errorResponse("No se pudo calcular el recupero."), { status: 500 });
  }
}
