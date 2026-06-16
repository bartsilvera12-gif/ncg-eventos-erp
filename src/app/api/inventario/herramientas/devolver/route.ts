import { NextRequest, NextResponse } from "next/server";
import { getTenantSupabaseFromAuth } from "@/lib/supabase/tenant-api";
import { successResponse, errorResponse } from "@/lib/api/response";
import { API_ERRORS } from "@/lib/api/errors";

/**
 * POST /api/inventario/herramientas/devolver
 *
 * Devuelve unidades previamente asignadas. Según estado:
 *  - buen_estado          → cantidad_asignada -= X
 *  - requiere_mantenimiento → cantidad_asignada -= X; cantidad_mantenimiento += X
 *  - rota                 → cantidad_asignada -= X; stock_actual -= X (baja inmediata)
 *
 * Crea un movimiento tipo DEVOLUCION; si rota, además un movimiento BAJA.
 */
const ESTADOS = new Set(["buen_estado", "requiere_mantenimiento", "rota"]);

export async function POST(request: NextRequest) {
  try {
    const ctx = await getTenantSupabaseFromAuth(request);
    if (!ctx) return NextResponse.json(errorResponse(API_ERRORS.UNAUTHORIZED), { status: 401 });
    const empresaId = ctx.auth.empresa_id;

    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const producto_id = String(body.producto_id ?? "").trim();
    const cantidad = Number(body.cantidad);
    const estado_devolucion = String(body.estado_devolucion ?? "").trim();
    const responsableRaw = typeof body.responsable === "string" ? body.responsable.trim() : "";
    const proyecto_id = body.proyecto_id == null || body.proyecto_id === "" ? null : String(body.proyecto_id).trim();
    const ubicacion_destino = typeof body.ubicacion_destino === "string" && body.ubicacion_destino.trim() !== ""
      ? body.ubicacion_destino.trim()
      : null;
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
    if (!ESTADOS.has(estado_devolucion)) {
      return NextResponse.json(errorResponse("Estado de devolución inválido."), { status: 400 });
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

    const asignada = Number(prod.cantidad_asignada ?? 0);
    const mant = Number(prod.cantidad_mantenimiento ?? 0);
    const stock = Number(prod.stock_actual ?? 0);
    if (cantidad > asignada) {
      return NextResponse.json(
        errorResponse(`No podés devolver más de lo asignado. Asignadas: ${asignada}.`),
        { status: 400 }
      );
    }

    const usuarioNombre = responsableRaw || ctx.auth.usuarioNombre || ctx.auth.user?.email || null;
    const costoUnit = Number(prod.costo_promedio ?? 0);

    const { data: movRow, error: movErr } = await ctx.supabase
      .from("movimientos_inventario")
      .insert([{
        empresa_id: empresaId,
        producto_id: prod.id,
        producto_nombre: prod.nombre,
        producto_sku: prod.sku ?? "",
        tipo: "DEVOLUCION",
        cantidad,
        costo_unitario: costoUnit,
        origen: "ajuste_manual",
        referencia: ubicacion_destino,
        fecha: fechaIso,
        created_by: ctx.auth.usuarioCatalogId ?? null,
        usuario_nombre: usuarioNombre,
        proyecto_id,
        observacion,
        ubicacion_destino,
        estado_devolucion,
      }])
      .select("id, fecha, cantidad, estado_devolucion")
      .single();
    if (movErr) return NextResponse.json(errorResponse(`No se pudo registrar la devolución: ${movErr.message}`), { status: 400 });

    // Ajustes según estado
    const nuevaAsignada = asignada - cantidad;
    let nuevaMantenimiento = mant;
    let nuevoStock = stock;
    let extraBajaMov: { id?: string } | null = null;

    if (estado_devolucion === "requiere_mantenimiento") {
      nuevaMantenimiento = mant + cantidad;
    } else if (estado_devolucion === "rota") {
      nuevoStock = Math.max(0, stock - cantidad);
      // Movimiento BAJA paralelo para trazabilidad contable.
      const baja = await ctx.supabase
        .from("movimientos_inventario")
        .insert([{
          empresa_id: empresaId,
          producto_id: prod.id,
          producto_nombre: prod.nombre,
          producto_sku: prod.sku ?? "",
          tipo: "BAJA",
          cantidad,
          costo_unitario: costoUnit,
          origen: "ajuste_manual",
          fecha: fechaIso,
          created_by: ctx.auth.usuarioCatalogId ?? null,
          usuario_nombre: usuarioNombre,
          motivo_baja: "rotura",
          observacion: observacion ?? "Baja automática por devolución rota",
        }])
        .select("id")
        .single();
      if (!baja.error) extraBajaMov = baja.data as { id?: string };
    }

    const { error: updErr } = await ctx.supabase
      .from("productos")
      .update({
        cantidad_asignada: nuevaAsignada,
        cantidad_mantenimiento: nuevaMantenimiento,
        stock_actual: nuevoStock,
      })
      .eq("id", producto_id)
      .eq("empresa_id", empresaId);
    if (updErr) {
      console.error("[/api/inventario/herramientas/devolver] update", updErr.message);
      return NextResponse.json(successResponse({
        movimiento: movRow,
        baja_movimiento: extraBajaMov,
        warning: "Devolución registrada pero los contadores no se actualizaron.",
      }));
    }

    return NextResponse.json(successResponse({ movimiento: movRow, baja_movimiento: extraBajaMov }));
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error";
    return NextResponse.json(errorResponse(msg), { status: 500 });
  }
}
