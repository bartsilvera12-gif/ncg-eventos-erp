import { NextRequest, NextResponse } from "next/server";
import { getTenantSupabaseFromAuth } from "@/lib/supabase/tenant-api";
import { successResponse, errorResponse } from "@/lib/api/response";
import { API_ERRORS } from "@/lib/api/errors";

/**
 * PATCH /api/proyectos/imputar
 *
 * Imputa una venta/compra/gasto/movimiento_inventario a una obra/proyecto.
 * Setea solo proyecto_id de la fila indicada. Lista blanca de tablas para evitar
 * que se modifique cualquier tabla arbitraria.
 *
 * Body: { tabla: "ventas"|"compras"|"gastos"|"movimientos_inventario", id: string, proyecto_id: string|null }
 */
const TABLAS_PERMITIDAS = new Set(["ventas", "compras", "gastos", "movimientos_inventario"]);

export async function PATCH(request: NextRequest) {
  try {
    const ctx = await getTenantSupabaseFromAuth(request);
    if (!ctx) return NextResponse.json(errorResponse(API_ERRORS.UNAUTHORIZED), { status: 401 });

    const body = (await request.json().catch(() => ({}))) as {
      tabla?: string;
      id?: string;
      proyecto_id?: string | null;
    };

    const tabla = String(body.tabla ?? "").trim();
    const id = String(body.id ?? "").trim();
    const proyectoId = body.proyecto_id == null || body.proyecto_id === "" ? null : String(body.proyecto_id);

    if (!TABLAS_PERMITIDAS.has(tabla)) {
      return NextResponse.json(errorResponse("Tabla no permitida."), { status: 400 });
    }
    if (!id) {
      return NextResponse.json(errorResponse("Falta id."), { status: 400 });
    }

    const { error } = await ctx.supabase
      .from(tabla)
      .update({ proyecto_id: proyectoId })
      .eq("id", id)
      .eq("empresa_id", ctx.auth.empresa_id);

    if (error) {
      return NextResponse.json(errorResponse(error.message), { status: 400 });
    }
    return NextResponse.json(successResponse({ ok: true }));
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error";
    return NextResponse.json(errorResponse(msg), { status: 500 });
  }
}
