import { NextResponse } from "next/server";
import { getChatServiceClientForEmpresa } from "@/app/api/chat/_chat-service-client";
import { errorResponse, successResponse } from "@/lib/api/response";
import { requireProyectosApiAccess } from "@/lib/proyectos/proyectos-auth";

/**
 * GET /api/proyectos/[id]/rentabilidad
 *
 * Resumen financiero de una obra:
 * - presupuestado = proyectos.monto_vendido
 * - facturado     = Σ ventas.total where proyecto_id = X
 * - costo_materiales = Σ (movimientos_inventario SALIDA).cantidad * costo_unitario where proyecto_id = X
 * - costo_compras    = Σ compras.total where proyecto_id = X
 * - costo_gastos     = Σ gastos.monto  where proyecto_id = X
 * - costo_total = costo_materiales + costo_compras + costo_gastos
 * - margen = facturado - costo_total
 * - margen_pct = margen / facturado * 100 (0 si facturado=0)
 *
 * Lee datos ya cargados por el usuario en cada módulo. Sin duplicar carga.
 */
function num(v: unknown): number {
  if (v == null) return 0;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

function sum<T extends Record<string, unknown>>(rows: T[] | null | undefined, key: keyof T): number {
  if (!rows) return 0;
  return rows.reduce((acc, r) => acc + num(r[key]), 0);
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireProyectosApiAccess(_request);
  if (!auth.ok) return NextResponse.json(errorResponse(auth.message), { status: auth.status });

  const { id } = await params;
  const pid = id?.trim() ?? "";
  if (!pid) return NextResponse.json(errorResponse("id obligatorio"), { status: 400 });

  try {
    const sb = await getChatServiceClientForEmpresa(auth.empresaId);
    const empresaId = auth.empresaId;

    // Proyecto base (titulo + monto_vendido como "presupuestado")
    const { data: proyecto, error: ep } = await sb
      .from("proyectos")
      .select("id, titulo, monto_vendido")
      .eq("empresa_id", empresaId)
      .eq("id", pid)
      .maybeSingle();
    if (ep) return NextResponse.json(errorResponse(ep.message), { status: 400 });
    if (!proyecto) return NextResponse.json(errorResponse("Obra no encontrada"), { status: 404 });

    // Cuatro queries paralelas a tablas operativas.
    const [ventasQ, movsQ, comprasQ, gastosQ] = await Promise.all([
      sb.from("ventas")
        .select("total, fecha")
        .eq("empresa_id", empresaId)
        .eq("proyecto_id", pid),
      sb.from("movimientos_inventario")
        .select("cantidad, costo_unitario, tipo, fecha")
        .eq("empresa_id", empresaId)
        .eq("proyecto_id", pid)
        .eq("tipo", "SALIDA"),
      sb.from("compras")
        .select("total, fecha")
        .eq("empresa_id", empresaId)
        .eq("proyecto_id", pid),
      sb.from("gastos")
        .select("monto, fecha")
        .eq("empresa_id", empresaId)
        .eq("proyecto_id", pid),
    ]);

    const errors = [ventasQ.error, movsQ.error, comprasQ.error, gastosQ.error].filter(Boolean);
    if (errors.length > 0) {
      return NextResponse.json(errorResponse(errors[0]!.message), { status: 400 });
    }

    const ventasRows = (ventasQ.data ?? []) as { total: number | string }[];
    const movsRows = (movsQ.data ?? []) as { cantidad: number | string; costo_unitario: number | string }[];
    const comprasRows = (comprasQ.data ?? []) as { total: number | string }[];
    const gastosRows = (gastosQ.data ?? []) as { monto: number | string }[];

    const presupuestado = num(proyecto.monto_vendido);
    const facturado = sum(ventasRows, "total");
    const costoMateriales = movsRows.reduce(
      (acc, m) => acc + num(m.cantidad) * num(m.costo_unitario),
      0
    );
    const costoCompras = sum(comprasRows, "total");
    const costoGastos = sum(gastosRows, "monto");
    const costoTotal = costoMateriales + costoCompras + costoGastos;
    const margen = facturado - costoTotal;
    const margenPct = facturado > 0 ? (margen / facturado) * 100 : 0;

    return NextResponse.json(successResponse({
      proyecto: { id: proyecto.id, titulo: proyecto.titulo },
      presupuestado,
      facturado,
      costo_materiales: costoMateriales,
      costo_compras: costoCompras,
      costo_gastos: costoGastos,
      costo_total: costoTotal,
      margen,
      margen_pct: margenPct,
      cantidades: {
        ventas: ventasRows.length,
        movimientos: movsRows.length,
        compras: comprasRows.length,
        gastos: gastosRows.length,
      },
    }));
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error";
    return NextResponse.json(errorResponse(msg), { status: 500 });
  }
}
