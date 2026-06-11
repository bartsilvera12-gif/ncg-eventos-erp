import { NextRequest, NextResponse } from "next/server";
import { getTenantSupabaseFromAuth } from "@/lib/supabase/tenant-api";
import { successResponse, errorResponse } from "@/lib/api/response";
import { API_ERRORS } from "@/lib/api/errors";

/**
 * GET /api/reportes/rentabilidad-obras
 *
 * Rentabilidad consolidada de TODAS las obras:
 *   presupuestado = proyectos.monto_vendido
 *   facturado     = SUM(ventas.total) imputadas a la obra (excluye presupuestos)
 *   costo         = materiales (movs SALIDA) + compras + gastos + mano de obra (asignaciones)
 *   margen        = facturado - costo
 *
 * Agrupado por proyecto_id en JS para que solo sean 5 queries totales,
 * sin importar la cantidad de obras.
 */
function num(v: unknown): number {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
}

export async function GET(request: NextRequest) {
  try {
    const ctx = await getTenantSupabaseFromAuth(request);
    if (!ctx) return NextResponse.json(errorResponse(API_ERRORS.UNAUTHORIZED), { status: 401 });
    const empresaId = ctx.auth.empresa_id;

    const [proyQ, ventasQ, movsQ, comprasQ, gastosQ, moQ] = await Promise.all([
      ctx.supabase.from("proyectos")
        .select("id, titulo, monto_vendido, estado_id, archivado, proyecto_estados:estado_id(nombre, codigo)")
        .eq("empresa_id", empresaId)
        .eq("archivado", false),
      ctx.supabase.from("ventas")
        .select("proyecto_id, total")
        .eq("empresa_id", empresaId)
        .not("proyecto_id", "is", null)
        .or("tipo_documento.eq.venta,tipo_documento.is.null"),
      ctx.supabase.from("movimientos_inventario")
        .select("proyecto_id, cantidad, costo_unitario")
        .eq("empresa_id", empresaId)
        .eq("tipo", "SALIDA")
        .not("proyecto_id", "is", null),
      ctx.supabase.from("compras")
        .select("proyecto_id, total")
        .eq("empresa_id", empresaId)
        .not("proyecto_id", "is", null),
      ctx.supabase.from("gastos")
        .select("proyecto_id, monto")
        .eq("empresa_id", empresaId)
        .not("proyecto_id", "is", null),
      ctx.supabase.from("empleado_asignaciones")
        .select("proyecto_id, horas, costo_total")
        .eq("empresa_id", empresaId),
    ]);

    for (const q of [proyQ, ventasQ, movsQ, comprasQ, gastosQ, moQ]) {
      if (q.error) return NextResponse.json(errorResponse(q.error.message), { status: 400 });
    }

    const facturado = new Map<string, number>();
    for (const r of (ventasQ.data ?? []) as Array<{ proyecto_id: string; total: number | string }>) {
      facturado.set(r.proyecto_id, (facturado.get(r.proyecto_id) ?? 0) + num(r.total));
    }
    const costoMat = new Map<string, number>();
    for (const r of (movsQ.data ?? []) as Array<{ proyecto_id: string; cantidad: number | string; costo_unitario: number | string }>) {
      const v = num(r.cantidad) * num(r.costo_unitario);
      costoMat.set(r.proyecto_id, (costoMat.get(r.proyecto_id) ?? 0) + v);
    }
    const costoComp = new Map<string, number>();
    for (const r of (comprasQ.data ?? []) as Array<{ proyecto_id: string; total: number | string }>) {
      costoComp.set(r.proyecto_id, (costoComp.get(r.proyecto_id) ?? 0) + num(r.total));
    }
    const costoGastos = new Map<string, number>();
    for (const r of (gastosQ.data ?? []) as Array<{ proyecto_id: string; monto: number | string }>) {
      costoGastos.set(r.proyecto_id, (costoGastos.get(r.proyecto_id) ?? 0) + num(r.monto));
    }
    const costoMO = new Map<string, number>();
    const horasMO = new Map<string, number>();
    for (const r of (moQ.data ?? []) as Array<{ proyecto_id: string; horas: number | string; costo_total: number | string }>) {
      costoMO.set(r.proyecto_id, (costoMO.get(r.proyecto_id) ?? 0) + num(r.costo_total));
      horasMO.set(r.proyecto_id, (horasMO.get(r.proyecto_id) ?? 0) + num(r.horas));
    }

    const filas = (proyQ.data ?? []).map((p: Record<string, unknown>) => {
      const id = p.id as string;
      const presupuestado = num(p.monto_vendido);
      const fact = facturado.get(id) ?? 0;
      const cMat = costoMat.get(id) ?? 0;
      const cCom = costoComp.get(id) ?? 0;
      const cGas = costoGastos.get(id) ?? 0;
      const cMO = costoMO.get(id) ?? 0;
      const costoTotal = cMat + cCom + cGas + cMO;
      const margen = fact - costoTotal;
      const margenPct = fact > 0 ? (margen / fact) * 100 : 0;
      const est = p.proyecto_estados as { nombre?: string; codigo?: string } | { nombre?: string; codigo?: string }[] | null;
      const e = Array.isArray(est) ? est[0] : est;
      return {
        id,
        titulo: p.titulo as string,
        estado: e?.nombre ?? "—",
        estado_codigo: e?.codigo ?? null,
        presupuestado,
        facturado: fact,
        costo_materiales: cMat,
        costo_compras: cCom,
        costo_gastos: cGas,
        costo_mano_obra: cMO,
        costo_total: costoTotal,
        margen,
        margen_pct: margenPct,
        horas_mo: horasMO.get(id) ?? 0,
      };
    });

    const totales = filas.reduce(
      (acc, f) => ({
        presupuestado: acc.presupuestado + f.presupuestado,
        facturado: acc.facturado + f.facturado,
        costo_total: acc.costo_total + f.costo_total,
        margen: acc.margen + f.margen,
      }),
      { presupuestado: 0, facturado: 0, costo_total: 0, margen: 0 }
    );

    return NextResponse.json(successResponse({ filas, totales, cantidad: filas.length }));
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error";
    return NextResponse.json(errorResponse(msg), { status: 500 });
  }
}
