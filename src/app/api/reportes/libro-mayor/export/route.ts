import { NextRequest } from "next/server";
import { getTenantSupabaseFromAuth } from "@/lib/supabase/tenant-api";
import { buildXlsxBuffer, xlsxResponseHeaders, nowStamp } from "@/lib/excel/export";
import { generarAsientos, resumenPorCuenta } from "@/lib/contabilidad/asientos";

interface ResumenRow {
  codigo: string;
  nombre: string;
  tipo: string;
  debe_periodo: number;
  haber_periodo: number;
  saldo_final: number;
}

interface DetalleRow {
  fecha: string;
  numero: string;
  concepto: string;
  descripcion: string;
  debe: number;
  haber: number;
  saldo: number;
}

export async function GET(request: NextRequest) {
  const ctx = await getTenantSupabaseFromAuth(request);
  if (!ctx) return new Response("Unauthorized", { status: 401 });

  const sp = new URL(request.url).searchParams;
  const desde = sp.get("desde") || new Date().toISOString().slice(0, 8) + "01";
  const hasta = sp.get("hasta") || new Date().toISOString().slice(0, 10);
  const cuentaId = sp.get("cuenta_id");

  try {
    const asientos = await generarAsientos(ctx.supabase as unknown as Parameters<typeof generarAsientos>[0], ctx.auth.empresa_id, desde, hasta);

    if (!cuentaId) {
      const cuentas = resumenPorCuenta(asientos) as ResumenRow[];
      const buf = buildXlsxBuffer<ResumenRow>(cuentas, [
        { header: "Código",   value: (r) => r.codigo, width: 10 },
        { header: "Cuenta",   value: (r) => r.nombre, width: 30 },
        { header: "Tipo",     value: (r) => r.tipo,   width: 12 },
        { header: "Debe",     value: (r) => Number(r.debe_periodo.toFixed(2)),  width: 14 },
        { header: "Haber",    value: (r) => Number(r.haber_periodo.toFixed(2)), width: 14 },
        { header: "Saldo",    value: (r) => Number(r.saldo_final.toFixed(2)),    width: 14 },
      ], { sheetName: "Libro Mayor" });
      return new Response(new Uint8Array(buf), { status: 200, headers: xlsxResponseHeaders(`libro-mayor-${desde}-a-${hasta}-${nowStamp()}`) });
    }

    // Detalle de una cuenta.
    let saldo = 0;
    const rows: DetalleRow[] = [];
    for (const a of asientos) {
      for (const l of a.lineas) {
        if (l.cuenta_codigo !== cuentaId) continue;
        saldo += l.debe - l.haber;
        rows.push({
          fecha: a.fecha,
          numero: a.numero,
          concepto: a.concepto,
          descripcion: l.descripcion ?? "",
          debe: l.debe,
          haber: l.haber,
          saldo,
        });
      }
    }
    const buf = buildXlsxBuffer<DetalleRow>(rows, [
      { header: "Fecha",     value: (r) => r.fecha,       width: 12 },
      { header: "Asiento",   value: (r) => r.numero,      width: 10 },
      { header: "Concepto",  value: (r) => r.concepto,    width: 40 },
      { header: "Detalle",   value: (r) => r.descripcion, width: 24 },
      { header: "Debe",      value: (r) => Number(r.debe.toFixed(2)),  width: 14 },
      { header: "Haber",     value: (r) => Number(r.haber.toFixed(2)), width: 14 },
      { header: "Saldo",     value: (r) => Number(r.saldo.toFixed(2)), width: 14 },
    ], { sheetName: `Cta ${cuentaId}` });
    return new Response(new Uint8Array(buf), { status: 200, headers: xlsxResponseHeaders(`libro-mayor-cta-${cuentaId}-${desde}-a-${hasta}-${nowStamp()}`) });
  } catch (err) {
    console.error("[/api/reportes/libro-mayor/export]", err instanceof Error ? err.message : err);
    return new Response("No se pudo generar el Excel", { status: 500 });
  }
}
