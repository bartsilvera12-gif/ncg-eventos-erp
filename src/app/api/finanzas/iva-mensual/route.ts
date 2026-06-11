import { NextRequest, NextResponse } from "next/server";
import { getTenantSupabaseFromAuth } from "@/lib/supabase/tenant-api";
import { successResponse, errorResponse } from "@/lib/api/response";
import { API_ERRORS } from "@/lib/api/errors";

/**
 * GET /api/finanzas/iva-mensual?anio=YYYY
 *
 * Resumen mensual de IVA del año:
 *  - debito  = SUM(ventas.monto_iva) por mes (solo ventas reales, no presupuestos)
 *  - credito = SUM(compras.monto_iva) por mes
 *  - neto    = debito - credito  (positivo = a pagar, negativo = crédito a favor)
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

    const debito = Array.from({ length: 12 }, () => 0);
    const credito = Array.from({ length: 12 }, () => 0);

    for (const r of (ventasQ.data ?? []) as { fecha?: string; monto_iva?: number | string }[]) {
      if (!r.fecha) continue;
      debito[mesIdx(r.fecha)] += Number(r.monto_iva ?? 0);
    }
    for (const r of (comprasQ.data ?? []) as { fecha?: string; monto_iva?: number | string }[]) {
      if (!r.fecha) continue;
      credito[mesIdx(r.fecha)] += Number(r.monto_iva ?? 0);
    }

    const meses = Array.from({ length: 12 }, (_, i) => {
      const d = debito[i];
      const c = credito[i];
      return {
        mes: `${anio}-${String(i + 1).padStart(2, "0")}`,
        debito: d,
        credito: c,
        neto: d - c,
      };
    });

    const totales = meses.reduce(
      (acc, m) => ({ debito: acc.debito + m.debito, credito: acc.credito + m.credito, neto: acc.neto + m.neto }),
      { debito: 0, credito: 0, neto: 0 }
    );

    return NextResponse.json(successResponse({ anio, meses, totales }));
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error";
    return NextResponse.json(errorResponse(msg), { status: 500 });
  }
}
