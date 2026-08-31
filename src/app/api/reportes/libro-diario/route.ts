import { NextRequest, NextResponse } from "next/server";
import { getTenantSupabaseFromAuth } from "@/lib/supabase/tenant-api";
import { successResponse, errorResponse } from "@/lib/api/response";
import { API_ERRORS } from "@/lib/api/errors";
import { generarAsientos } from "@/lib/contabilidad/asientos";

/**
 * GET /api/reportes/libro-diario?desde=YYYY-MM-DD&hasta=YYYY-MM-DD
 * Genera los asientos del periodo desde ventas/compras/gastos.
 */
export async function GET(request: NextRequest) {
  try {
    const ctx = await getTenantSupabaseFromAuth(request);
    if (!ctx) return NextResponse.json(errorResponse(API_ERRORS.UNAUTHORIZED), { status: 401 });
    const sp = new URL(request.url).searchParams;
    const desde = sp.get("desde") || new Date().toISOString().slice(0, 8) + "01";
    const hasta = sp.get("hasta") || new Date().toISOString().slice(0, 10);
    const asientos = await generarAsientos(ctx.supabase as unknown as Parameters<typeof generarAsientos>[0], ctx.auth.empresa_id, desde, hasta);
    const totals = asientos.reduce((acc, a) => ({ debe: acc.debe + a.total_debe, haber: acc.haber + a.total_haber }), { debe: 0, haber: 0 });
    return NextResponse.json(successResponse({ asientos, totals, desde, hasta }));
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error";
    console.error("[/api/reportes/libro-diario]", msg);
    return NextResponse.json(errorResponse(msg), { status: 500 });
  }
}
