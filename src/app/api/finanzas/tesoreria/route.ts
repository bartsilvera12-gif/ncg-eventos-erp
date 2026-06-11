import { NextRequest, NextResponse } from "next/server";
import { getTenantSupabaseFromAuth } from "@/lib/supabase/tenant-api";
import { successResponse, errorResponse } from "@/lib/api/response";
import { API_ERRORS } from "@/lib/api/errors";

/**
 * GET /api/finanzas/tesoreria?mes=YYYY-MM
 *
 * Flujo de dinero del mes: cobros (ventas con fecha_cobro en el rango)
 * y pagos (compras con fecha_pago + gastos con fecha_pago).
 * Ordenado cronológicamente. Devuelve totales (entradas, salidas, saldo neto).
 */
export async function GET(request: NextRequest) {
  try {
    const ctx = await getTenantSupabaseFromAuth(request);
    if (!ctx) return NextResponse.json(errorResponse(API_ERRORS.UNAUTHORIZED), { status: 401 });

    const sp = new URL(request.url).searchParams;
    const mes = sp.get("mes") ?? new Date().toISOString().slice(0, 7);
    const desde = `${mes}-01`;
    const [y, m] = mes.split("-").map((v) => parseInt(v, 10));
    const hasta = new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 10);

    const [cobrosQ, pagosComprasQ, pagosGastosQ] = await Promise.all([
      ctx.supabase
        .from("ventas")
        .select("id, numero_control, monto_cobrado, fecha_cobro, cliente_id, clientes:cliente_id(empresa, nombre_contacto)")
        .eq("empresa_id", ctx.auth.empresa_id)
        .or("tipo_documento.eq.venta,tipo_documento.is.null")
        .gte("fecha_cobro", desde)
        .lt("fecha_cobro", hasta),
      ctx.supabase
        .from("compras")
        .select("id, numero_control, monto_pagado, fecha_pago, proveedor_nombre")
        .eq("empresa_id", ctx.auth.empresa_id)
        .gte("fecha_pago", desde)
        .lt("fecha_pago", hasta),
      ctx.supabase
        .from("gastos")
        .select("id, monto_pagado, fecha_pago, descripcion, categoria")
        .eq("empresa_id", ctx.auth.empresa_id)
        .gte("fecha_pago", desde)
        .lt("fecha_pago", hasta),
    ]);
    if (cobrosQ.error) return NextResponse.json(errorResponse(cobrosQ.error.message), { status: 400 });
    if (pagosComprasQ.error) return NextResponse.json(errorResponse(pagosComprasQ.error.message), { status: 400 });
    if (pagosGastosQ.error) return NextResponse.json(errorResponse(pagosGastosQ.error.message), { status: 400 });

    const cobros = (cobrosQ.data ?? []).map((r: Record<string, unknown>) => {
      const cli = r.clientes as { empresa?: string | null; nombre_contacto?: string | null } | { empresa?: string | null; nombre_contacto?: string | null }[] | null | undefined;
      const c = Array.isArray(cli) ? cli[0] : cli;
      return {
        tipo: "cobro" as const,
        id: r.id,
        fecha: r.fecha_cobro,
        detalle: c?.empresa ?? c?.nombre_contacto ?? "Cliente",
        referencia: r.numero_control as string | null,
        monto: Number(r.monto_cobrado ?? 0),
      };
    });

    const pagosCompras = (pagosComprasQ.data ?? []).map((r: Record<string, unknown>) => ({
      tipo: "pago" as const,
      id: r.id,
      fecha: r.fecha_pago,
      detalle: (r.proveedor_nombre as string) ?? "Proveedor",
      referencia: (r.numero_control as string) ?? null,
      monto: Number(r.monto_pagado ?? 0),
      origen: "compra" as const,
    }));

    const pagosGastos = (pagosGastosQ.data ?? []).map((r: Record<string, unknown>) => ({
      tipo: "pago" as const,
      id: r.id,
      fecha: r.fecha_pago,
      detalle: (r.descripcion as string) || (r.categoria as string) || "Gasto",
      referencia: null,
      monto: Number(r.monto_pagado ?? 0),
      origen: "gasto" as const,
    }));

    const filas = [...cobros, ...pagosCompras, ...pagosGastos]
      .filter((r) => r.fecha != null)
      .sort((a, b) => String(a.fecha).localeCompare(String(b.fecha)));

    const totalEntradas = cobros.reduce((acc, r) => acc + r.monto, 0);
    const totalSalidas = pagosCompras.reduce((acc, r) => acc + r.monto, 0) + pagosGastos.reduce((acc, r) => acc + r.monto, 0);
    const neto = totalEntradas - totalSalidas;

    return NextResponse.json(successResponse({
      mes,
      filas,
      totales: {
        entradas: totalEntradas,
        salidas: totalSalidas,
        neto,
        cantidadCobros: cobros.length,
        cantidadPagos: pagosCompras.length + pagosGastos.length,
      },
    }));
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error";
    return NextResponse.json(errorResponse(msg), { status: 500 });
  }
}
