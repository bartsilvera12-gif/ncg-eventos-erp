import { NextRequest, NextResponse } from "next/server";
import { getTenantSupabaseFromAuth } from "@/lib/supabase/tenant-api";
import { successResponse, errorResponse } from "@/lib/api/response";
import { API_ERRORS } from "@/lib/api/errors";

/**
 * POST /api/inventario/herramientas/asignar
 *
 * Asigna unidades de una herramienta a una obra/responsable. NO descuenta
 * stock_actual ni genera gasto: solo aumenta `cantidad_asignada`. Queda un
 * movimiento tipo ASIGNACION para historial.
 */
export async function POST(request: NextRequest) {
  try {
    const ctx = await getTenantSupabaseFromAuth(request);
    if (!ctx) return NextResponse.json(errorResponse(API_ERRORS.UNAUTHORIZED), { status: 401 });
    const empresaId = ctx.auth.empresa_id;

    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const producto_id = String(body.producto_id ?? "").trim();
    const cantidad = Number(body.cantidad);
    const responsableRaw = typeof body.responsable === "string" ? body.responsable.trim() : "";
    const proyecto_id = body.proyecto_id == null || body.proyecto_id === "" ? null : String(body.proyecto_id).trim();
    const ubicacion_origen = typeof body.ubicacion_origen === "string" && body.ubicacion_origen.trim() !== ""
      ? body.ubicacion_origen.trim()
      : null;
    const fechaIso = typeof body.fecha === "string" && body.fecha.trim() !== ""
      ? new Date(body.fecha).toISOString()
      : new Date().toISOString();
    const fecha_devolucion_estimada = typeof body.fecha_devolucion_estimada === "string" && body.fecha_devolucion_estimada.trim() !== ""
      ? body.fecha_devolucion_estimada.trim()
      : null;
    const observacion = typeof body.observacion === "string" && body.observacion.trim() !== ""
      ? body.observacion.trim()
      : null;

    if (!producto_id) return NextResponse.json(errorResponse("Falta la herramienta."), { status: 400 });
    if (!Number.isFinite(cantidad) || cantidad <= 0) {
      return NextResponse.json(errorResponse("La cantidad debe ser mayor a 0."), { status: 400 });
    }

    const { data: prod, error: prodErr } = await ctx.supabase
      .from("productos")
      .select("id, nombre, sku, stock_actual, costo_promedio, cantidad_asignada, cantidad_mantenimiento, tipo_inventario")
      .eq("id", producto_id)
      .eq("empresa_id", empresaId)
      .maybeSingle();
    if (prodErr) return NextResponse.json(errorResponse(prodErr.message), { status: 400 });
    if (!prod) return NextResponse.json(errorResponse("Herramienta no encontrada."), { status: 404 });
    if (prod.tipo_inventario !== "herramienta") {
      return NextResponse.json(errorResponse("Este flujo es solo para productos de tipo Herramienta."), { status: 400 });
    }

    const stock = Number(prod.stock_actual ?? 0);
    const asignada = Number(prod.cantidad_asignada ?? 0);
    const mant = Number(prod.cantidad_mantenimiento ?? 0);
    const disponibles = stock - asignada - mant;
    if (cantidad > disponibles) {
      return NextResponse.json(
        errorResponse(`No hay herramientas disponibles. Disponibles: ${disponibles}.`),
        { status: 400 }
      );
    }

    const usuarioNombre = responsableRaw || ctx.auth.usuarioNombre || ctx.auth.user?.email || null;

    const { data: movRow, error: movErr } = await ctx.supabase
      .from("movimientos_inventario")
      .insert([{
        empresa_id: empresaId,
        producto_id: prod.id,
        producto_nombre: prod.nombre,
        producto_sku: prod.sku ?? "",
        tipo: "ASIGNACION",
        cantidad,
        costo_unitario: Number(prod.costo_promedio ?? 0),
        origen: "ajuste_manual",
        referencia: ubicacion_origen,
        fecha: fechaIso,
        created_by: ctx.auth.usuarioCatalogId ?? null,
        usuario_nombre: usuarioNombre,
        proyecto_id,
        observacion,
        fecha_devolucion_estimada,
      }])
      .select("id, fecha, cantidad, proyecto_id, usuario_nombre")
      .single();
    if (movErr) return NextResponse.json(errorResponse(`No se pudo registrar la asignación: ${movErr.message}`), { status: 400 });

    const { error: updErr } = await ctx.supabase
      .from("productos")
      .update({ cantidad_asignada: asignada + cantidad })
      .eq("id", producto_id)
      .eq("empresa_id", empresaId);
    if (updErr) {
      console.error("[/api/inventario/herramientas/asignar] update cantidad_asignada", updErr.message);
      return NextResponse.json(successResponse({ movimiento: movRow, warning: "Asignación registrada pero el contador no se pudo actualizar." }));
    }

    return NextResponse.json(successResponse({ movimiento: movRow }));
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error";
    return NextResponse.json(errorResponse(msg), { status: 500 });
  }
}
