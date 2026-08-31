import { NextRequest, NextResponse } from "next/server";
import { getTenantSupabaseFromAuth } from "@/lib/supabase/tenant-api";
import { successResponse, errorResponse } from "@/lib/api/response";
import { API_ERRORS } from "@/lib/api/errors";

/**
 * GET /api/inventario/movimientos — lista movimientos via PostgREST (compat Hostinger sin pool PG).
 */
export async function GET(request: NextRequest) {
  try {
    const ctx = await getTenantSupabaseFromAuth(request);
    if (!ctx) return NextResponse.json(errorResponse(API_ERRORS.UNAUTHORIZED), { status: 401 });
    const empresaId = ctx.auth.empresa_id;

    const { data, error } = await ctx.supabase
      .from("movimientos_inventario")
      .select(
        "id, empresa_id, producto_id, producto_nombre, producto_sku, tipo, cantidad, costo_unitario, origen, referencia, fecha, created_at, updated_at, created_by, usuario_nombre, proyecto_id, motivo, observacion, ubicacion_destino, fecha_devolucion_estimada, estado_devolucion, motivo_baja, proyectos:proyecto_id(titulo)"
      )
      .eq("empresa_id", empresaId)
      .order("fecha", { ascending: false })
      .limit(500);
    if (error) throw new Error(error.message);

    /** Aplana el join PostgREST {proyectos: {titulo}} → proyecto_titulo. */
    const movimientos = (data ?? []).map((row: Record<string, unknown>) => {
      const proyectos = row.proyectos as { titulo?: string } | { titulo?: string }[] | null | undefined;
      const titulo = Array.isArray(proyectos) ? proyectos[0]?.titulo : proyectos?.titulo;
      return { ...row, proyecto_titulo: titulo ?? null, proyectos: undefined };
    });

    return NextResponse.json(successResponse({ movimientos }));
  } catch (err) {
    console.error("[/api/inventario/movimientos GET]", err instanceof Error ? err.message : err);
    return NextResponse.json(errorResponse("No se pudieron cargar los movimientos."), { status: 500 });
  }
}

/**
 * POST /api/inventario/movimientos — registra un movimiento manual (entrada, salida,
 * ajuste) y actualiza el stock del producto. Auth server-side, así que el form del
 * cliente no necesita depender de getCurrentUser() del browser (que fallaba con
 * 'Usuario no autenticado o sin empresa' en NCG Eventos).
 */
export async function POST(request: NextRequest) {
  try {
    const ctx = await getTenantSupabaseFromAuth(request);
    if (!ctx) return NextResponse.json(errorResponse(API_ERRORS.UNAUTHORIZED), { status: 401 });
    const empresaId = ctx.auth.empresa_id;
    const sb = ctx.supabase;

    const body = (await request.json().catch(() => ({}))) as {
      producto_id?: string;
      tipo?: "ENTRADA" | "SALIDA" | "AJUSTE";
      cantidad?: number | string;
      costo_unitario?: number | string;
      origen?: "compra" | "venta" | "ajuste_manual" | "inventario_inicial";
      referencia?: string | null;
      proyecto_id?: string | null;
      fecha?: string | null;
    };

    const productoId = String(body.producto_id ?? "").trim();
    const tipo = body.tipo;
    const cantidad = Number(body.cantidad);
    const origen = body.origen ?? "ajuste_manual";
    if (!productoId) return NextResponse.json(errorResponse("producto_id es obligatorio."), { status: 400 });
    if (!tipo || !["ENTRADA", "SALIDA", "AJUSTE"].includes(tipo)) {
      return NextResponse.json(errorResponse("tipo inválido (ENTRADA / SALIDA / AJUSTE)."), { status: 400 });
    }
    if (!Number.isFinite(cantidad) || cantidad === 0) {
      return NextResponse.json(errorResponse("La cantidad debe ser distinta de 0."), { status: 400 });
    }

    // 1. Producto (para nombre/sku snapshot + stock actual).
    const { data: prod, error: pErr } = await sb
      .from("productos")
      .select("id, nombre, sku, stock_actual")
      .eq("id", productoId)
      .eq("empresa_id", empresaId)
      .maybeSingle();
    if (pErr) throw new Error(pErr.message);
    if (!prod) return NextResponse.json(errorResponse("Producto no encontrado."), { status: 404 });

    const cantidadFinal = tipo === "AJUSTE" ? cantidad : Math.abs(cantidad);
    const delta = tipo === "ENTRADA" ? cantidadFinal : tipo === "SALIDA" ? -cantidadFinal : cantidadFinal;
    const stockActual = Number((prod as { stock_actual: number }).stock_actual ?? 0);
    const nuevoStock = Math.max(0, stockActual + delta);

    // 2. Insert movimiento.
    const insert: Record<string, unknown> = {
      empresa_id: empresaId,
      producto_id: productoId,
      producto_nombre: (prod as { nombre: string }).nombre,
      producto_sku: (prod as { sku: string }).sku,
      tipo,
      cantidad: cantidadFinal,
      costo_unitario: Number(body.costo_unitario ?? 0) || 0,
      origen,
      referencia: body.referencia ?? null,
      fecha: body.fecha ?? new Date().toISOString(),
      proyecto_id: body.proyecto_id ?? null,
      created_by: ctx.auth.usuarioCatalogId ?? null,
      usuario_nombre: ctx.auth.usuarioNombre ?? ctx.auth.user.email ?? null,
    };

    const { data: movRow, error: mErr } = await sb
      .from("movimientos_inventario")
      .insert([insert])
      .select()
      .single();
    if (mErr) {
      console.error("[/api/inventario/movimientos POST insert]", mErr.message);
      return NextResponse.json(errorResponse(`No se pudo insertar el movimiento: ${mErr.message}`), { status: 500 });
    }

    // 3. Update stock (salvo inventario_inicial que ya viene del insert original).
    if (origen !== "inventario_inicial") {
      const { error: upErr } = await sb
        .from("productos")
        .update({ stock_actual: nuevoStock })
        .eq("id", productoId)
        .eq("empresa_id", empresaId);
      if (upErr) console.warn("[/api/inventario/movimientos POST update stock]", upErr.message);
    }

    return NextResponse.json(successResponse({ movimiento: movRow, stock_resultante: nuevoStock }));
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error inesperado.";
    console.error("[/api/inventario/movimientos POST]", msg);
    return NextResponse.json(errorResponse(msg), { status: 500 });
  }
}
