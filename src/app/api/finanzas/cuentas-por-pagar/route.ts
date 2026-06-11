import { NextRequest, NextResponse } from "next/server";
import { getTenantSupabaseFromAuth } from "@/lib/supabase/tenant-api";
import { successResponse, errorResponse } from "@/lib/api/response";
import { API_ERRORS } from "@/lib/api/errors";

/**
 * GET /api/finanzas/cuentas-por-pagar
 *
 * Compras y gastos con saldo > 0: total - monto_pagado.
 * Devuelve lista unificada con origen='compra'|'gasto'.
 */
export async function GET(request: NextRequest) {
  try {
    const ctx = await getTenantSupabaseFromAuth(request);
    if (!ctx) return NextResponse.json(errorResponse(API_ERRORS.UNAUTHORIZED), { status: 401 });

    const [comprasQ, gastosQ] = await Promise.all([
      ctx.supabase
        .from("compras")
        .select("id, numero_control, fecha, total, monto_pagado, proveedor_nombre, tipo_pago, plazo_dias")
        .eq("empresa_id", ctx.auth.empresa_id)
        .order("fecha", { ascending: true }),
      ctx.supabase
        .from("gastos")
        .select("id, fecha, monto, monto_pagado, descripcion, categoria, tipo")
        .eq("empresa_id", ctx.auth.empresa_id)
        .order("fecha", { ascending: true }),
    ]);
    if (comprasQ.error) return NextResponse.json(errorResponse(comprasQ.error.message), { status: 400 });
    if (gastosQ.error) return NextResponse.json(errorResponse(gastosQ.error.message), { status: 400 });

    const compras = (comprasQ.data ?? [])
      .map((r: Record<string, unknown>) => {
        const total = Number(r.total ?? 0);
        const pagado = Number(r.monto_pagado ?? 0);
        const saldo = total - pagado;
        if (saldo <= 0) return null;
        let vencimiento: string | null = null;
        if (r.tipo_pago === "credito" && r.plazo_dias != null && r.fecha) {
          const d = new Date(String(r.fecha));
          d.setDate(d.getDate() + Number(r.plazo_dias));
          vencimiento = d.toISOString();
        }
        return {
          origen: "compra" as const,
          id: r.id,
          fecha: r.fecha,
          detalle: r.proveedor_nombre ?? "—",
          referencia: r.numero_control ?? null,
          total,
          pagado,
          saldo,
          vencimiento,
        };
      })
      .filter(Boolean) as Array<NonNullable<unknown>>;

    const gastos = (gastosQ.data ?? [])
      .map((r: Record<string, unknown>) => {
        const total = Number(r.monto ?? 0);
        const pagado = Number(r.monto_pagado ?? 0);
        const saldo = total - pagado;
        if (saldo <= 0) return null;
        return {
          origen: "gasto" as const,
          id: r.id,
          fecha: r.fecha,
          detalle: (r.descripcion as string) || (r.categoria as string) || "Gasto",
          referencia: (r.tipo as string) ?? null,
          total,
          pagado,
          saldo,
          vencimiento: null,
        };
      })
      .filter(Boolean) as Array<NonNullable<unknown>>;

    const filas = [...compras, ...gastos].sort((a, b) =>
      String((a as { fecha: string }).fecha).localeCompare(String((b as { fecha: string }).fecha))
    );

    const totalSaldo = filas.reduce((acc, f) => acc + (f as { saldo: number }).saldo, 0);
    return NextResponse.json(successResponse({
      filas,
      totales: { cantidad: filas.length, compras: compras.length, gastos: gastos.length, saldo: totalSaldo },
    }));
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error";
    return NextResponse.json(errorResponse(msg), { status: 500 });
  }
}
