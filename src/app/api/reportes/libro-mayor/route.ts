import { NextRequest, NextResponse } from "next/server";
import { getTenantSupabaseFromAuth } from "@/lib/supabase/tenant-api";
import { successResponse, errorResponse } from "@/lib/api/response";
import { API_ERRORS } from "@/lib/api/errors";
import { generarAsientos, resumenPorCuenta } from "@/lib/contabilidad/asientos";

/**
 * GET /api/reportes/libro-mayor?desde=&hasta=[&cuenta_id=]
 *   - sin cuenta_id → devuelve resumen por cuenta (modo='resumen').
 *   - con cuenta_id → devuelve movimientos + saldos de esa cuenta (modo='detalle').
 */
export async function GET(request: NextRequest) {
  try {
    const ctx = await getTenantSupabaseFromAuth(request);
    if (!ctx) return NextResponse.json(errorResponse(API_ERRORS.UNAUTHORIZED), { status: 401 });
    const sp = new URL(request.url).searchParams;
    const desde = sp.get("desde") || new Date().toISOString().slice(0, 8) + "01";
    const hasta = sp.get("hasta") || new Date().toISOString().slice(0, 10);
    const cuentaId = sp.get("cuenta_id");

    const asientos = await generarAsientos(ctx.supabase as unknown as Parameters<typeof generarAsientos>[0], ctx.auth.empresa_id, desde, hasta);

    if (!cuentaId) {
      return NextResponse.json(successResponse({ modo: "resumen", cuentas: resumenPorCuenta(asientos), desde, hasta }));
    }

    // Modo detalle: aplanar las lineas de esa cuenta con saldo corriente.
    let saldo = 0;
    const movimientos: Array<{ fecha: string; numero: string; concepto: string; descripcion: string | null; debe: number; haber: number; saldo: number }> = [];
    for (const a of asientos) {
      for (const l of a.lineas) {
        if (l.cuenta_codigo !== cuentaId) continue;
        saldo += l.debe - l.haber;
        movimientos.push({
          fecha: a.fecha,
          numero: a.numero,
          concepto: a.concepto,
          descripcion: l.descripcion,
          debe: l.debe,
          haber: l.haber,
          saldo,
        });
      }
    }
    return NextResponse.json(successResponse({
      modo: "detalle",
      cuenta_id: cuentaId,
      saldo_inicial: 0,
      saldo_final: saldo,
      movimientos,
      desde,
      hasta,
    }));
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error";
    console.error("[/api/reportes/libro-mayor]", msg);
    return NextResponse.json(errorResponse(msg), { status: 500 });
  }
}
