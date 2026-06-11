import { NextRequest, NextResponse } from "next/server";
import { getTenantSupabaseFromAuth } from "@/lib/supabase/tenant-api";
import { successResponse, errorResponse } from "@/lib/api/response";
import { API_ERRORS } from "@/lib/api/errors";

/**
 * GET /api/finanzas/libro-ventas?mes=YYYY-MM
 *
 * Detalle de ventas reales (excluye presupuestos) del mes solicitado.
 * Devuelve lista + totales globales.
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
    const hastaDate = new Date(Date.UTC(y, m, 1)); // primer día del mes siguiente
    const hasta = hastaDate.toISOString().slice(0, 10);

    const { data, error } = await ctx.supabase
      .from("ventas")
      .select("id, numero_control, fecha, total, subtotal, monto_iva, tipo_venta, cliente_id, clientes:cliente_id(empresa, nombre_contacto, ruc)")
      .eq("empresa_id", ctx.auth.empresa_id)
      .or("tipo_documento.eq.venta,tipo_documento.is.null")
      .gte("fecha", desde)
      .lt("fecha", hasta)
      .order("fecha", { ascending: true });

    if (error) return NextResponse.json(errorResponse(error.message), { status: 400 });

    const rows = (data ?? []).map((row: Record<string, unknown>) => {
      const cli = row.clientes as { empresa?: string | null; nombre_contacto?: string | null; ruc?: string | null } | { empresa?: string | null; nombre_contacto?: string | null; ruc?: string | null }[] | null | undefined;
      const c = Array.isArray(cli) ? cli[0] : cli;
      return {
        id: row.id,
        numero_control: row.numero_control,
        fecha: row.fecha,
        total: Number(row.total ?? 0),
        subtotal: Number(row.subtotal ?? 0),
        monto_iva: Number(row.monto_iva ?? 0),
        tipo_venta: row.tipo_venta,
        cliente_nombre: c?.empresa ?? c?.nombre_contacto ?? "—",
        cliente_ruc: c?.ruc ?? null,
      };
    });

    const totalSubtotal = rows.reduce((acc, r) => acc + r.subtotal, 0);
    const totalIva = rows.reduce((acc, r) => acc + r.monto_iva, 0);
    const totalGeneral = rows.reduce((acc, r) => acc + r.total, 0);

    return NextResponse.json(successResponse({
      mes,
      desde,
      hasta,
      filas: rows,
      totales: {
        cantidad: rows.length,
        subtotal: totalSubtotal,
        iva: totalIva,
        total: totalGeneral,
      },
    }));
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error";
    return NextResponse.json(errorResponse(msg), { status: 500 });
  }
}
