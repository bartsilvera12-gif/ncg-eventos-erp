import { NextRequest, NextResponse } from "next/server";
import { getTenantSupabaseFromAuth } from "@/lib/supabase/tenant-api";
import { successResponse, errorResponse } from "@/lib/api/response";
import { API_ERRORS } from "@/lib/api/errors";

/**
 * POST /api/inventario/herramientas/baja
 *
 * Da de baja unidades de una herramienta. Reglas:
 *  - origen='disponible': se descuentan unidades disponibles (stock − asignada − mantenimiento).
 *  - origen='mantenimiento': se descuentan de cantidad_mantenimiento.
 *  - en ambos casos: stock_actual -= cantidad.
 *  - NUNCA se permite baja directa de unidades asignadas (devolvé primero).
 */
const MOTIVOS = new Set(["rotura", "perdida", "robo", "obsolescencia", "venta_activo"]);
type Origen = "disponible" | "mantenimiento";

export async function POST(request: NextRequest) {
  try {
    const ctx = await getTenantSupabaseFromAuth(request);
    if (!ctx) return NextResponse.json(errorResponse(API_ERRORS.UNAUTHORIZED), { status: 401 });
    const empresaId = ctx.auth.empresa_id;

    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const producto_id = String(body.producto_id ?? "").trim();
    const cantidad = Number(body.cantidad);
    const motivo_baja = String(body.motivo_baja ?? "").trim();
    const origen: Origen = body.origen === "mantenimiento" ? "mantenimiento" : "disponible";
    const responsableRaw = typeof body.responsable === "string" ? body.responsable.trim() : "";
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
    if (!MOTIVOS.has(motivo_baja)) {
      return NextResponse.json(errorResponse("Motivo de baja inválido."), { status: 400 });
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
      return NextResponse.json(errorResponse("Este flujo es solo para herramientas."), { status: 400 });
    }

    const stock = Number(prod.stock_actual ?? 0);
    const asignada = Number(prod.cantidad_asignada ?? 0);
    const mant = Number(prod.cantidad_mantenimiento ?? 0);
    const disponibles = stock - asignada - mant;

    if (origen === "disponible") {
      if (cantidad > disponibles) {
        return NextResponse.json(
          errorResponse(`No hay disponibles suficientes para dar de baja. Disponibles: ${disponibles}.`),
          { status: 400 }
        );
      }
    } else {
      if (cantidad > mant) {
        return NextResponse.json(
          errorResponse(`No hay tantas unidades en mantenimiento. En mantenimiento: ${mant}.`),
          { status: 400 }
        );
      }
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
        tipo: "BAJA",
        cantidad,
        costo_unitario: costoUnit,
        origen: "ajuste_manual",
        fecha: fechaIso,
        created_by: ctx.auth.usuarioCatalogId ?? null,
        usuario_nombre: usuarioNombre,
        motivo_baja,
        observacion,
      }])
      .select("id, fecha, cantidad, motivo_baja")
      .single();
    if (movErr) return NextResponse.json(errorResponse(`No se pudo registrar la baja: ${movErr.message}`), { status: 400 });

    const updates: Record<string, number> = {
      stock_actual: Math.max(0, stock - cantidad),
    };
    if (origen === "mantenimiento") updates.cantidad_mantenimiento = Math.max(0, mant - cantidad);

    const { error: updErr } = await ctx.supabase
      .from("productos")
      .update(updates)
      .eq("id", producto_id)
      .eq("empresa_id", empresaId);
    if (updErr) {
      return NextResponse.json(successResponse({ movimiento: movRow, warning: "Baja registrada pero los contadores no se actualizaron." }));
    }

    return NextResponse.json(successResponse({ movimiento: movRow }));
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error";
    return NextResponse.json(errorResponse(msg), { status: 500 });
  }
}
