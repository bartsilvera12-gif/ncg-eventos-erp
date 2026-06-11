import { NextRequest, NextResponse } from "next/server";
import { getTenantSupabaseFromAuth } from "@/lib/supabase/tenant-api";
import { successResponse, errorResponse } from "@/lib/api/response";
import { API_ERRORS } from "@/lib/api/errors";

/**
 * GET /api/finanzas/cuentas-por-cobrar
 *
 * Ventas reales (no presupuestos) con saldo > 0: total - monto_cobrado.
 * Ordenadas por fecha asc para priorizar las más antiguas.
 */
export async function GET(request: NextRequest) {
  try {
    const ctx = await getTenantSupabaseFromAuth(request);
    if (!ctx) return NextResponse.json(errorResponse(API_ERRORS.UNAUTHORIZED), { status: 401 });

    const { data, error } = await ctx.supabase
      .from("ventas")
      .select("id, numero_control, fecha, total, monto_cobrado, tipo_venta, plazo_dias, cliente_id, clientes:cliente_id(empresa, nombre_contacto)")
      .eq("empresa_id", ctx.auth.empresa_id)
      .or("tipo_documento.eq.venta,tipo_documento.is.null")
      .order("fecha", { ascending: true });
    if (error) return NextResponse.json(errorResponse(error.message), { status: 400 });

    const filas = (data ?? [])
      .map((row: Record<string, unknown>) => {
        const total = Number(row.total ?? 0);
        const cobrado = Number(row.monto_cobrado ?? 0);
        const saldo = total - cobrado;
        if (saldo <= 0) return null;
        const cli = row.clientes as { empresa?: string | null; nombre_contacto?: string | null } | { empresa?: string | null; nombre_contacto?: string | null }[] | null | undefined;
        const c = Array.isArray(cli) ? cli[0] : cli;
        // Cálculo de vencimiento para CREDITO
        let vencimiento: string | null = null;
        if (row.tipo_venta === "CREDITO" && row.plazo_dias != null && row.fecha) {
          const d = new Date(String(row.fecha));
          d.setDate(d.getDate() + Number(row.plazo_dias));
          vencimiento = d.toISOString();
        }
        return {
          id: row.id,
          numero_control: row.numero_control,
          fecha: row.fecha,
          cliente_nombre: c?.empresa ?? c?.nombre_contacto ?? "—",
          tipo_venta: row.tipo_venta,
          total,
          cobrado,
          saldo,
          vencimiento,
        };
      })
      .filter(Boolean) as Array<NonNullable<unknown>>;

    const totalSaldo = filas.reduce((acc, f) => acc + (f as { saldo: number }).saldo, 0);

    return NextResponse.json(successResponse({ filas, totales: { cantidad: filas.length, saldo: totalSaldo } }));
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error";
    return NextResponse.json(errorResponse(msg), { status: 500 });
  }
}
