import { NextRequest, NextResponse } from "next/server";
import { getTenantSupabaseFromAuth } from "@/lib/supabase/tenant-api";
import { successResponse, errorResponse } from "@/lib/api/response";
import { API_ERRORS } from "@/lib/api/errors";

/**
 * GET /api/finanzas/libro-compras?mes=YYYY-MM
 *
 * Detalle de compras + gastos del mes. Devuelve lista unificada
 * (origen=compra|gasto) con totales globales.
 *
 * Si no se pasa mes, devuelve el mes actual.
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

    const [comprasQ, gastosQ] = await Promise.all([
      ctx.supabase
        .from("compras")
        .select("id, numero_control, fecha, total, subtotal, monto_iva, proveedor_nombre, nro_timbrado")
        .eq("empresa_id", ctx.auth.empresa_id)
        .gte("fecha", desde)
        .lt("fecha", hasta)
        .order("fecha", { ascending: true }),
      ctx.supabase
        .from("gastos")
        .select("id, fecha, monto, descripcion, categoria, tipo")
        .eq("empresa_id", ctx.auth.empresa_id)
        .gte("fecha", desde)
        .lt("fecha", hasta)
        .order("fecha", { ascending: true }),
    ]);

    if (comprasQ.error) return NextResponse.json(errorResponse(comprasQ.error.message), { status: 400 });
    if (gastosQ.error) return NextResponse.json(errorResponse(gastosQ.error.message), { status: 400 });

    const compras = (comprasQ.data ?? []).map((r: Record<string, unknown>) => ({
      origen: "compra" as const,
      id: r.id,
      fecha: r.fecha,
      detalle: r.proveedor_nombre ?? "—",
      referencia: r.numero_control ?? r.nro_timbrado ?? null,
      subtotal: Number(r.subtotal ?? r.total ?? 0),
      monto_iva: Number(r.monto_iva ?? 0),
      total: Number(r.total ?? 0),
    }));

    const gastos = (gastosQ.data ?? []).map((r: Record<string, unknown>) => ({
      origen: "gasto" as const,
      id: r.id,
      fecha: r.fecha,
      detalle: (r.descripcion as string) || (r.categoria as string) || "Gasto",
      referencia: (r.tipo as string) ?? null,
      subtotal: Number(r.monto ?? 0),
      monto_iva: 0, // gastos no tienen IVA discriminado en este modelo
      total: Number(r.monto ?? 0),
    }));

    const filas = [...compras, ...gastos].sort((a, b) =>
      String(a.fecha).localeCompare(String(b.fecha))
    );

    const totSub = filas.reduce((acc, r) => acc + r.subtotal, 0);
    const totIva = filas.reduce((acc, r) => acc + r.monto_iva, 0);
    const totTot = filas.reduce((acc, r) => acc + r.total, 0);

    return NextResponse.json(successResponse({
      mes,
      desde,
      hasta,
      filas,
      totales: {
        cantidad: filas.length,
        compras: compras.length,
        gastos: gastos.length,
        subtotal: totSub,
        iva: totIva,
        total: totTot,
      },
    }));
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error";
    return NextResponse.json(errorResponse(msg), { status: 500 });
  }
}
