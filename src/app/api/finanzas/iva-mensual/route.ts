import { NextRequest, NextResponse } from "next/server";
import { getTenantSupabaseFromAuth } from "@/lib/supabase/tenant-api";
import { successResponse, errorResponse } from "@/lib/api/response";
import { API_ERRORS } from "@/lib/api/errors";

/**
 * GET /api/finanzas/iva-mensual?anio=YYYY
 *
 * Resumen del IVA del período (año):
 *  - iva_repercutido = SUM(ventas.monto_iva) por mes (solo ventas reales, no presupuestos)
 *  - iva_soportado   = SUM(compras.monto_iva) por mes
 *  - resultado_iva   = iva_repercutido - iva_soportado  (positivo = IVA a pagar, negativo = crédito a favor)
 *
 * Se mantienen los campos legacy `debito` / `credito` / `neto` en la respuesta
 * para no romper consumidores existentes durante la transición.
 *
 * Si no se pasa anio, devuelve el año actual.
 */
export async function GET(request: NextRequest) {
  try {
    const ctx = await getTenantSupabaseFromAuth(request);
    if (!ctx) return NextResponse.json(errorResponse(API_ERRORS.UNAUTHORIZED), { status: 401 });

    const sp = new URL(request.url).searchParams;
    const anio = parseInt(sp.get("anio") ?? String(new Date().getFullYear()), 10);
    if (!Number.isFinite(anio) || anio < 2000 || anio > 9999) {
      return NextResponse.json(errorResponse("anio inválido"), { status: 400 });
    }
    const desde = `${anio}-01-01`;
    const hasta = `${anio + 1}-01-01`;

    const [ventasQ, comprasQ] = await Promise.all([
      ctx.supabase
        .from("ventas")
        .select("fecha, monto_iva")
        .eq("empresa_id", ctx.auth.empresa_id)
        .or("tipo_documento.eq.venta,tipo_documento.is.null")
        .gte("fecha", desde)
        .lt("fecha", hasta),
      ctx.supabase
        .from("compras")
        .select("fecha, monto_iva")
        .eq("empresa_id", ctx.auth.empresa_id)
        .gte("fecha", desde)
        .lt("fecha", hasta),
    ]);
    if (ventasQ.error) return NextResponse.json(errorResponse(ventasQ.error.message), { status: 400 });
    if (comprasQ.error) return NextResponse.json(errorResponse(comprasQ.error.message), { status: 400 });

    const mesIdx = (fechaIso: string): number => {
      // YYYY-MM-DD... → 0..11
      const m = parseInt(fechaIso.slice(5, 7), 10);
      return Number.isFinite(m) ? m - 1 : 0;
    };

    const ivaRepercutido = Array.from({ length: 12 }, () => 0);
    const ivaSoportado = Array.from({ length: 12 }, () => 0);

    for (const r of (ventasQ.data ?? []) as { fecha?: string; monto_iva?: number | string }[]) {
      if (!r.fecha) continue;
      ivaRepercutido[mesIdx(r.fecha)] += Number(r.monto_iva ?? 0);
    }
    for (const r of (comprasQ.data ?? []) as { fecha?: string; monto_iva?: number | string }[]) {
      if (!r.fecha) continue;
      ivaSoportado[mesIdx(r.fecha)] += Number(r.monto_iva ?? 0);
    }

    const meses = Array.from({ length: 12 }, (_, i) => {
      const rep = ivaRepercutido[i];
      const sop = ivaSoportado[i];
      const resultado = rep - sop;
      return {
        mes: `${anio}-${String(i + 1).padStart(2, "0")}`,
        // Campos nuevos (ES)
        iva_repercutido: rep,
        iva_soportado: sop,
        resultado_iva: resultado,
        // Alias legacy (no romper consumidores)
        debito: rep,
        credito: sop,
        neto: resultado,
      };
    });

    const totales = meses.reduce(
      (acc, m) => ({
        iva_repercutido: acc.iva_repercutido + m.iva_repercutido,
        iva_soportado: acc.iva_soportado + m.iva_soportado,
        resultado_iva: acc.resultado_iva + m.resultado_iva,
        debito: acc.debito + m.debito,
        credito: acc.credito + m.credito,
        neto: acc.neto + m.neto,
      }),
      { iva_repercutido: 0, iva_soportado: 0, resultado_iva: 0, debito: 0, credito: 0, neto: 0 }
    );

    return NextResponse.json(successResponse({ anio, meses, totales }));
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error";
    return NextResponse.json(errorResponse(msg), { status: 500 });
  }
}
