import { NextRequest, NextResponse } from "next/server";
import { getTenantSupabaseFromAuth } from "@/lib/supabase/tenant-api";
import { successResponse, errorResponse } from "@/lib/api/response";
import { API_ERRORS } from "@/lib/api/errors";

/**
 * Impacto en stock de un movimiento (mismo signo que el insert original).
 * ENTRADA suma, SALIDA resta, AJUSTE = valor signed tal cual.
 */
function deltaDe(tipo: string, cantidad: number): number {
  const c = Math.abs(cantidad);
  if (tipo === "ENTRADA") return c;
  if (tipo === "SALIDA") return -c;
  return cantidad; // AJUSTE conserva signo
}

async function actualizarStockConDelta(
  sb: Awaited<ReturnType<typeof getTenantSupabaseFromAuth>> extends infer T ? T extends { supabase: infer S } ? S : never : never,
  empresaId: string,
  productoId: string,
  delta: number
) {
  if (delta === 0) return;
  const { data: prod, error: pErr } = await sb!
    .from("productos")
    .select("stock_actual")
    .eq("id", productoId)
    .eq("empresa_id", empresaId)
    .maybeSingle();
  if (pErr) throw new Error(pErr.message);
  if (!prod) return;
  const actual = Number((prod as { stock_actual: number }).stock_actual ?? 0);
  const nuevo = Math.max(0, actual + delta);
  const { error: upErr } = await sb!
    .from("productos")
    .update({ stock_actual: nuevo })
    .eq("id", productoId)
    .eq("empresa_id", empresaId);
  if (upErr) throw new Error(upErr.message);
}

export async function GET(
  request: NextRequest,
  ctxParam: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await getTenantSupabaseFromAuth(request);
    if (!ctx) return NextResponse.json(errorResponse(API_ERRORS.UNAUTHORIZED), { status: 401 });
    const { id } = await ctxParam.params;

    const { data, error } = await ctx.supabase
      .from("movimientos_inventario")
      .select("*")
      .eq("id", id)
      .eq("empresa_id", ctx.auth.empresa_id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) return NextResponse.json(errorResponse("Movimiento no encontrado."), { status: 404 });
    return NextResponse.json(successResponse({ movimiento: data }));
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error";
    return NextResponse.json(errorResponse(msg), { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  ctxParam: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await getTenantSupabaseFromAuth(request);
    if (!ctx) return NextResponse.json(errorResponse(API_ERRORS.UNAUTHORIZED), { status: 401 });
    const empresaId = ctx.auth.empresa_id;
    const sb = ctx.supabase;
    const { id } = await ctxParam.params;

    // 1. Movimiento actual (para reversar su impacto en stock).
    const { data: existing, error: exErr } = await sb
      .from("movimientos_inventario")
      .select("id, producto_id, tipo, cantidad, origen")
      .eq("id", id)
      .eq("empresa_id", empresaId)
      .maybeSingle();
    if (exErr) throw new Error(exErr.message);
    if (!existing) return NextResponse.json(errorResponse("Movimiento no encontrado."), { status: 404 });

    const body = (await request.json().catch(() => ({}))) as {
      tipo?: "ENTRADA" | "SALIDA" | "AJUSTE";
      cantidad?: number | string;
      costo_unitario?: number | string;
      origen?: "compra" | "venta" | "ajuste_manual" | "inventario_inicial";
      referencia?: string | null;
      proyecto_id?: string | null;
      fecha?: string | null;
    };

    const nuevoTipo = body.tipo ?? (existing.tipo as "ENTRADA" | "SALIDA" | "AJUSTE");
    const nuevaCant = body.cantidad != null ? Number(body.cantidad) : Number(existing.cantidad);
    if (!Number.isFinite(nuevaCant) || nuevaCant === 0) {
      return NextResponse.json(errorResponse("La cantidad debe ser distinta de 0."), { status: 400 });
    }
    const cantFinal = nuevoTipo === "AJUSTE" ? nuevaCant : Math.abs(nuevaCant);

    // 2. Reversar delta viejo (solo si el original impactaba stock).
    const oldSkipStock = existing.origen === "inventario_inicial";
    const newSkipStock = (body.origen ?? existing.origen) === "inventario_inicial";
    if (!oldSkipStock) {
      const deltaViejo = deltaDe(existing.tipo as string, Number(existing.cantidad));
      await actualizarStockConDelta(sb, empresaId, existing.producto_id as string, -deltaViejo);
    }

    // 3. Update movimiento.
    const patch: Record<string, unknown> = {
      tipo: nuevoTipo,
      cantidad: cantFinal,
      updated_at: new Date().toISOString(),
    };
    if (body.costo_unitario != null) patch.costo_unitario = Number(body.costo_unitario) || 0;
    if (body.origen != null) patch.origen = body.origen;
    if (body.referencia !== undefined) patch.referencia = body.referencia;
    if (body.proyecto_id !== undefined) patch.proyecto_id = body.proyecto_id;
    if (body.fecha != null) patch.fecha = body.fecha;

    const { data: updated, error: uErr } = await sb
      .from("movimientos_inventario")
      .update(patch)
      .eq("id", id)
      .eq("empresa_id", empresaId)
      .select()
      .single();
    if (uErr) throw new Error(uErr.message);

    // 4. Aplicar delta nuevo.
    if (!newSkipStock) {
      const deltaNuevo = deltaDe(nuevoTipo, cantFinal);
      await actualizarStockConDelta(sb, empresaId, existing.producto_id as string, deltaNuevo);
    }

    return NextResponse.json(successResponse({ movimiento: updated }));
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error";
    console.error("[/api/inventario/movimientos/[id] PATCH]", msg);
    return NextResponse.json(errorResponse(msg), { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  ctxParam: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await getTenantSupabaseFromAuth(request);
    if (!ctx) return NextResponse.json(errorResponse(API_ERRORS.UNAUTHORIZED), { status: 401 });
    const empresaId = ctx.auth.empresa_id;
    const sb = ctx.supabase;
    const { id } = await ctxParam.params;

    const { data: existing, error: exErr } = await sb
      .from("movimientos_inventario")
      .select("id, producto_id, tipo, cantidad, origen")
      .eq("id", id)
      .eq("empresa_id", empresaId)
      .maybeSingle();
    if (exErr) throw new Error(exErr.message);
    if (!existing) return NextResponse.json(errorResponse("Movimiento no encontrado."), { status: 404 });

    // Delete row.
    const { error: dErr } = await sb
      .from("movimientos_inventario")
      .delete()
      .eq("id", id)
      .eq("empresa_id", empresaId);
    if (dErr) throw new Error(dErr.message);

    // Reversar impacto en stock (solo si el movimiento originalmente lo afectaba).
    if (existing.origen !== "inventario_inicial") {
      const deltaViejo = deltaDe(existing.tipo as string, Number(existing.cantidad));
      await actualizarStockConDelta(sb, empresaId, existing.producto_id as string, -deltaViejo);
    }

    return NextResponse.json(successResponse({ ok: true }));
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error";
    console.error("[/api/inventario/movimientos/[id] DELETE]", msg);
    return NextResponse.json(errorResponse(msg), { status: 500 });
  }
}
