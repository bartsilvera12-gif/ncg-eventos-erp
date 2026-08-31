import { NextRequest } from "next/server";
import { getTenantSupabaseFromAuth } from "@/lib/supabase/tenant-api";
import { buildXlsxBuffer, xlsxResponseHeaders, nowStamp } from "@/lib/excel/export";

interface Row { fecha: string; numero: string; cliente: string; nif: string; subtotal: number; iva: number; total: number; tipo: string }

export async function GET(request: NextRequest) {
  const ctx = await getTenantSupabaseFromAuth(request);
  if (!ctx) return new Response("Unauthorized", { status: 401 });

  const sp = new URL(request.url).searchParams;
  const mes = sp.get("mes") ?? new Date().toISOString().slice(0, 7);
  const desde = `${mes}-01`;
  const [y, m] = mes.split("-").map((v) => parseInt(v, 10));
  const hasta = new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 10);

  try {
    const { data, error } = await ctx.supabase
      .from("ventas")
      .select("id, numero_control, fecha, total, subtotal, monto_iva, tipo_venta, clientes:cliente_id(empresa, nombre_contacto, ruc)")
      .eq("empresa_id", ctx.auth.empresa_id)
      .or("tipo_documento.eq.venta,tipo_documento.is.null")
      .gte("fecha", desde)
      .lt("fecha", hasta)
      .order("fecha", { ascending: true });
    if (error) throw new Error(error.message);

    const rows: Row[] = (data ?? []).map((r: Record<string, unknown>) => {
      const cli = r.clientes as { empresa?: string | null; nombre_contacto?: string | null; ruc?: string | null } | { empresa?: string | null; nombre_contacto?: string | null; ruc?: string | null }[] | null | undefined;
      const c = Array.isArray(cli) ? cli[0] : cli;
      return {
        fecha: String(r.fecha ?? "").slice(0, 10),
        numero: String(r.numero_control ?? ""),
        cliente: String(c?.empresa ?? c?.nombre_contacto ?? "—"),
        nif: String(c?.ruc ?? ""),
        subtotal: Number(r.subtotal ?? 0),
        iva: Number(r.monto_iva ?? 0),
        total: Number(r.total ?? 0),
        tipo: String(r.tipo_venta ?? ""),
      };
    });

    const buf = buildXlsxBuffer<Row>(rows, [
      { header: "Fecha",    value: (r) => r.fecha,   width: 12 },
      { header: "Nº",       value: (r) => r.numero,  width: 14 },
      { header: "Cliente",  value: (r) => r.cliente, width: 32 },
      { header: "NIF",      value: (r) => r.nif,     width: 16 },
      { header: "Subtotal", value: (r) => Number(r.subtotal.toFixed(2)), width: 14 },
      { header: "IVA",      value: (r) => Number(r.iva.toFixed(2)),      width: 14 },
      { header: "Total",    value: (r) => Number(r.total.toFixed(2)),    width: 14 },
      { header: "Tipo",     value: (r) => r.tipo,    width: 12 },
    ], { sheetName: "Libro Ventas" });
    return new Response(new Uint8Array(buf), { status: 200, headers: xlsxResponseHeaders(`libro-ventas-${mes}-${nowStamp()}`) });
  } catch (err) {
    console.error("[/api/finanzas/libro-ventas/export]", err instanceof Error ? err.message : err);
    return new Response("No se pudo generar el Excel", { status: 500 });
  }
}
