import { NextRequest } from "next/server";
import { getTenantSupabaseFromAuth } from "@/lib/supabase/tenant-api";
import { buildXlsxBuffer, xlsxResponseHeaders, nowStamp } from "@/lib/excel/export";

interface Row { origen: string; fecha: string; detalle: string; referencia: string; subtotal: number; monto_iva: number; total: number }

export async function GET(request: NextRequest) {
  const ctx = await getTenantSupabaseFromAuth(request);
  if (!ctx) return new Response("Unauthorized", { status: 401 });

  const sp = new URL(request.url).searchParams;
  const mes = sp.get("mes") ?? new Date().toISOString().slice(0, 7);
  const desde = `${mes}-01`;
  const [y, m] = mes.split("-").map((v) => parseInt(v, 10));
  const hasta = new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 10);

  try {
    const [comprasQ, gastosQ] = await Promise.all([
      ctx.supabase.from("compras").select("id, numero_control, fecha, total, subtotal, monto_iva, proveedor_nombre, nro_timbrado").eq("empresa_id", ctx.auth.empresa_id).gte("fecha", desde).lt("fecha", hasta).order("fecha", { ascending: true }),
      ctx.supabase.from("gastos").select("id, fecha, monto, descripcion, categoria, tipo").eq("empresa_id", ctx.auth.empresa_id).gte("fecha", desde).lt("fecha", hasta).order("fecha", { ascending: true }),
    ]);
    if (comprasQ.error) throw new Error(comprasQ.error.message);
    if (gastosQ.error) throw new Error(gastosQ.error.message);

    const rows: Row[] = [
      ...(comprasQ.data ?? []).map((r: Record<string, unknown>) => ({ origen: "Compra", fecha: String(r.fecha ?? "").slice(0, 10), detalle: String(r.proveedor_nombre ?? "—"), referencia: String(r.numero_control ?? r.nro_timbrado ?? ""), subtotal: Number(r.subtotal ?? r.total ?? 0), monto_iva: Number(r.monto_iva ?? 0), total: Number(r.total ?? 0) })),
      ...(gastosQ.data ?? []).map((r: Record<string, unknown>) => ({ origen: "Gasto",  fecha: String(r.fecha ?? "").slice(0, 10), detalle: String(r.descripcion ?? r.categoria ?? "Gasto"), referencia: String(r.tipo ?? ""), subtotal: Number(r.monto ?? 0), monto_iva: 0, total: Number(r.monto ?? 0) })),
    ].sort((a, b) => a.fecha.localeCompare(b.fecha));

    const buf = buildXlsxBuffer<Row>(rows, [
      { header: "Origen",     value: (r) => r.origen,     width: 10 },
      { header: "Fecha",      value: (r) => r.fecha,      width: 12 },
      { header: "Proveedor",  value: (r) => r.detalle,    width: 32 },
      { header: "Referencia", value: (r) => r.referencia, width: 16 },
      { header: "Subtotal",   value: (r) => Number(r.subtotal.toFixed(2)),  width: 14 },
      { header: "IVA",        value: (r) => Number(r.monto_iva.toFixed(2)), width: 14 },
      { header: "Total",      value: (r) => Number(r.total.toFixed(2)),     width: 14 },
    ], { sheetName: "Libro Compras" });
    return new Response(new Uint8Array(buf), { status: 200, headers: xlsxResponseHeaders(`libro-compras-${mes}-${nowStamp()}`) });
  } catch (err) {
    console.error("[/api/finanzas/libro-compras/export]", err instanceof Error ? err.message : err);
    return new Response("No se pudo generar el Excel", { status: 500 });
  }
}
