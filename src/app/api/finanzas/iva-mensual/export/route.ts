import { NextRequest } from "next/server";
import { getTenantSupabaseFromAuth } from "@/lib/supabase/tenant-api";
import { buildXlsxBuffer, xlsxResponseHeaders, nowStamp } from "@/lib/excel/export";

interface Row { mes: string; iva_repercutido: number; iva_soportado: number; resultado_iva: number }

export async function GET(request: NextRequest) {
  const ctx = await getTenantSupabaseFromAuth(request);
  if (!ctx) return new Response("Unauthorized", { status: 401 });

  const sp = new URL(request.url).searchParams;
  const anio = parseInt(sp.get("anio") ?? String(new Date().getFullYear()), 10);
  if (!Number.isFinite(anio) || anio < 2000 || anio > 9999) return new Response("anio inválido", { status: 400 });
  const desde = `${anio}-01-01`;
  const hasta = `${anio + 1}-01-01`;

  try {
    const [ventasQ, comprasQ] = await Promise.all([
      ctx.supabase.from("ventas").select("fecha, monto_iva").eq("empresa_id", ctx.auth.empresa_id).or("tipo_documento.eq.venta,tipo_documento.is.null").gte("fecha", desde).lt("fecha", hasta),
      ctx.supabase.from("compras").select("fecha, monto_iva").eq("empresa_id", ctx.auth.empresa_id).gte("fecha", desde).lt("fecha", hasta),
    ]);
    if (ventasQ.error) throw new Error(ventasQ.error.message);
    if (comprasQ.error) throw new Error(comprasQ.error.message);

    const rep = Array.from({ length: 12 }, () => 0);
    const sop = Array.from({ length: 12 }, () => 0);
    for (const r of ((ventasQ.data ?? []) as { fecha?: string; monto_iva?: number | string }[])) {
      if (!r.fecha) continue;
      const m = parseInt(String(r.fecha).slice(5, 7), 10) - 1;
      if (m >= 0 && m < 12) rep[m] += Number(r.monto_iva ?? 0);
    }
    for (const r of ((comprasQ.data ?? []) as { fecha?: string; monto_iva?: number | string }[])) {
      if (!r.fecha) continue;
      const m = parseInt(String(r.fecha).slice(5, 7), 10) - 1;
      if (m >= 0 && m < 12) sop[m] += Number(r.monto_iva ?? 0);
    }

    const rows: Row[] = Array.from({ length: 12 }, (_, i) => ({
      mes: `${anio}-${String(i + 1).padStart(2, "0")}`,
      iva_repercutido: rep[i],
      iva_soportado: sop[i],
      resultado_iva: rep[i] - sop[i],
    }));

    const buf = buildXlsxBuffer<Row>(rows, [
      { header: "Mes",             value: (r) => r.mes,                                             width: 10 },
      { header: "IVA Repercutido", value: (r) => Number(r.iva_repercutido.toFixed(2)),              width: 16 },
      { header: "IVA Soportado",   value: (r) => Number(r.iva_soportado.toFixed(2)),                width: 16 },
      { header: "Resultado",       value: (r) => Number(r.resultado_iva.toFixed(2)),                width: 14 },
    ], { sheetName: `IVA ${anio}` });
    return new Response(new Uint8Array(buf), { status: 200, headers: xlsxResponseHeaders(`iva-mensual-${anio}-${nowStamp()}`) });
  } catch (err) {
    console.error("[/api/finanzas/iva-mensual/export]", err instanceof Error ? err.message : err);
    return new Response("No se pudo generar el Excel", { status: 500 });
  }
}
