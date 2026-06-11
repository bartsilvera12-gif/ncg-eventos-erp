import { NextRequest, NextResponse } from "next/server";
import { getTenantSupabaseFromAuth } from "@/lib/supabase/tenant-api";
import { successResponse, errorResponse } from "@/lib/api/response";
import { API_ERRORS } from "@/lib/api/errors";

const TABLAS = new Set(["ventas", "compras", "gastos"]);

/**
 * PATCH /api/finanzas/saldar
 *
 * Marca una venta/compra/gasto como cobrada o pagada (total).
 * Body: { tabla: 'ventas'|'compras'|'gastos', id: string, fecha?: string }
 *
 * - Para ventas, setea monto_cobrado = total y fecha_cobro = fecha (default now).
 * - Para compras, setea monto_pagado = total y fecha_pago = fecha (default now).
 * - Para gastos, setea monto_pagado = monto y fecha_pago = fecha (default now).
 *
 * El MVP solo soporta saldar el total. Pagos parciales pueden agregarse después
 * con un body { monto } y una tabla de movimientos dedicada.
 */
export async function PATCH(request: NextRequest) {
  try {
    const ctx = await getTenantSupabaseFromAuth(request);
    if (!ctx) return NextResponse.json(errorResponse(API_ERRORS.UNAUTHORIZED), { status: 401 });

    const body = (await request.json().catch(() => ({}))) as {
      tabla?: string;
      id?: string;
      fecha?: string;
    };
    const tabla = String(body.tabla ?? "").trim();
    const id = String(body.id ?? "").trim();
    if (!TABLAS.has(tabla)) return NextResponse.json(errorResponse("Tabla no permitida"), { status: 400 });
    if (!id) return NextResponse.json(errorResponse("Falta id"), { status: 400 });
    const fecha = body.fecha && /^\d{4}-\d{2}-\d{2}/.test(body.fecha) ? body.fecha : new Date().toISOString();

    // Necesitamos saber el total/monto actual de la fila
    const colTotal = tabla === "gastos" ? "monto" : "total";
    const { data: row, error: e1 } = await ctx.supabase
      .from(tabla)
      .select(`id, ${colTotal}`)
      .eq("id", id)
      .eq("empresa_id", ctx.auth.empresa_id)
      .maybeSingle();
    if (e1) return NextResponse.json(errorResponse(e1.message), { status: 400 });
    if (!row) return NextResponse.json(errorResponse("Registro no encontrado"), { status: 404 });
    const totalNum = Number((row as Record<string, unknown>)[colTotal] ?? 0);

    const update =
      tabla === "ventas"
        ? { monto_cobrado: totalNum, fecha_cobro: fecha }
        : { monto_pagado: totalNum, fecha_pago: fecha };

    const { error: e2 } = await ctx.supabase
      .from(tabla)
      .update(update)
      .eq("id", id)
      .eq("empresa_id", ctx.auth.empresa_id);

    if (e2) return NextResponse.json(errorResponse(e2.message), { status: 400 });
    return NextResponse.json(successResponse({ ok: true }));
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error";
    return NextResponse.json(errorResponse(msg), { status: 500 });
  }
}
