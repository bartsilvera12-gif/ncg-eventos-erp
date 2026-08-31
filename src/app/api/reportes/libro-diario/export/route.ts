import { NextRequest } from "next/server";
import { getTenantSupabaseFromAuth } from "@/lib/supabase/tenant-api";
import { buildXlsxBuffer, xlsxResponseHeaders, nowStamp } from "@/lib/excel/export";
import { generarAsientos } from "@/lib/contabilidad/asientos";

interface RowFlat {
  numero: string;
  fecha: string;
  concepto: string;
  cuenta_codigo: string;
  cuenta_nombre: string;
  descripcion: string;
  debe: number;
  haber: number;
}

export async function GET(request: NextRequest) {
  const ctx = await getTenantSupabaseFromAuth(request);
  if (!ctx) return new Response("Unauthorized", { status: 401 });

  const sp = new URL(request.url).searchParams;
  const desde = sp.get("desde") || new Date().toISOString().slice(0, 8) + "01";
  const hasta = sp.get("hasta") || new Date().toISOString().slice(0, 10);

  try {
    const asientos = await generarAsientos(ctx.supabase as unknown as Parameters<typeof generarAsientos>[0], ctx.auth.empresa_id, desde, hasta);
    const rows: RowFlat[] = [];
    for (const a of asientos) {
      for (const l of a.lineas) {
        rows.push({
          numero: a.numero,
          fecha: a.fecha,
          concepto: a.concepto,
          cuenta_codigo: l.cuenta_codigo,
          cuenta_nombre: l.cuenta_nombre,
          descripcion: l.descripcion ?? "",
          debe: l.debe,
          haber: l.haber,
        });
      }
    }
    const buf = buildXlsxBuffer<RowFlat>(rows, [
      { header: "Asiento",    value: (r) => r.numero,        width: 10 },
      { header: "Fecha",      value: (r) => r.fecha,         width: 12 },
      { header: "Concepto",   value: (r) => r.concepto,      width: 40 },
      { header: "Cta.",       value: (r) => r.cuenta_codigo, width: 8  },
      { header: "Cuenta",     value: (r) => r.cuenta_nombre, width: 26 },
      { header: "Detalle",    value: (r) => r.descripcion,   width: 24 },
      { header: "Debe",       value: (r) => Number(r.debe.toFixed(2)),  width: 14 },
      { header: "Haber",      value: (r) => Number(r.haber.toFixed(2)), width: 14 },
    ], { sheetName: "Libro Diario" });

    return new Response(new Uint8Array(buf), { status: 200, headers: xlsxResponseHeaders(`libro-diario-${desde}-a-${hasta}-${nowStamp()}`) });
  } catch (err) {
    console.error("[/api/reportes/libro-diario/export]", err instanceof Error ? err.message : err);
    return new Response("No se pudo generar el Excel", { status: 500 });
  }
}
