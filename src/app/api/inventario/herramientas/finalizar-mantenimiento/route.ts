import { NextRequest, NextResponse } from "next/server";
import { getTenantSupabaseFromAuth } from "@/lib/supabase/tenant-api";
import { successResponse, errorResponse } from "@/lib/api/response";
import { API_ERRORS } from "@/lib/api/errors";

/**
 * POST /api/inventario/herramientas/finalizar-mantenimiento
 *
 * Vuelve a disponible una cantidad que estaba en mantenimiento. No toca stock.
 * Crea un movimiento tipo MANTENIMIENTO_FIN.
 */
export async function POST(request: NextRequest) {
  try {
    const ctx = await getTenantSupabaseFromAuth(request);
    if (!ctx) return NextResponse.json(errorResponse(API_ERRORS.UNAUTHORIZED), { status: 401 });
    const empresaId = ctx.auth.empresa_id;

    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const producto_id = String(body.producto_id ?? "").trim();
    const cantidad = Number(body.cantidad);
    const observacion = typeof body.observacion === "string" && body.observacion.trim() !== ""
      ? body.observacion.trim()
      : null;
    const fechaIso = typeof body.fecha === "string" && body.fecha.trim() !== ""
      ? new Date(body.fecha).toISOString()
      : new Date().toISOString();

    if (!producto_id) return NextResponse.json(errorResponse("Falta la herramienta."), { status: 400 });
    if (!Number.isFinite(cantidad) || cantidad <= 0) {
      return NextResponse.json(errorResponse("La cantidad debe ser mayor a 0."), { status: 400 });
    }

    const { data: prod, error: prodErr } = await ctx.supabase
      .from("productos")
      .select("id, nombre, sku, costo_promedio, cantidad_mantenimiento, tipo_inventario")
      .eq("id", producto_id)
      .eq("empresa_id", empresaId)
      .maybeSingle();
    if (prodErr) return NextResponse.json(errorResponse(prodErr.message), { status: 400 });
    if (!prod) return NextResponse.json(errorResponse("Herramienta no encontrada."), { status: 404 });
    if (prod.tipo_inventario !== "herramienta") {
      return NextResponse.json(errorResponse("Este flujo es solo para herramientas."), { status: 400 });
    }

    const mant = Number(prod.cantidad_mantenimiento ?? 0);
    if (cantidad > mant) {
      return NextResponse.json(
        errorResponse(`No hay tantas unidades en mantenimiento. En mantenimiento: ${mant}.`),
        { status: 400 }
      );
    }

    const usuarioNombre = ctx.auth.usuarioNombre || ctx.auth.user?.email || null;

    const { data: movRow, error: movErr } = await ctx.supabase
      .from("movimientos_inventario")
      .insert([{
        empresa_id: empresaId,
        producto_id: prod.id,
        producto_nombre: prod.nombre,
        producto_sku: prod.sku ?? "",
        tipo: "MANTENIMIENTO_FIN",
        cantidad,
        costo_unitario: Number(prod.costo_promedio ?? 0),
        origen: "ajuste_manual",
        fecha: fechaIso,
        created_by: ctx.auth.usuarioCatalogId ?? null,
        usuario_nombre: usuarioNombre,
        observacion,
      }])
      .select("id, fecha, cantidad")
      .single();
    if (movErr) return NextResponse.json(errorResponse(`No se pudo registrar el fin de mantenimiento: ${movErr.message}`), { status: 400 });

    const { error: updErr } = await ctx.supabase
      .from("productos")
      .update({ cantidad_mantenimiento: mant - cantidad })
      .eq("id", producto_id)
      .eq("empresa_id", empresaId);
    if (updErr) {
      return NextResponse.json(successResponse({ movimiento: movRow, warning: "Movimiento registrado pero el contador no se actualizó." }));
    }

    return NextResponse.json(successResponse({ movimiento: movRow }));
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error";
    return NextResponse.json(errorResponse(msg), { status: 500 });
  }
}
