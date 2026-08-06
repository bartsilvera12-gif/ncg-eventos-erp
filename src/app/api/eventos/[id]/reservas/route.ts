import { NextResponse } from "next/server";
import { getChatServiceClientForEmpresa } from "@/app/api/chat/_chat-service-client";
import { errorResponse, successResponse } from "@/lib/api/response";
import { requireProyectosApiAccess } from "@/lib/proyectos/proyectos-auth";

// Reservas de stock (productos reutilizables) para un evento.
// Anti-doble-reserva: valida en app que la suma de reservas activas del producto
// en el rango solicitado no exceda su stock_actual. Los consumibles no usan
// esta tabla — descuentan stock por movimientos_inventario cuando se ejecuta el
// evento.

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireProyectosApiAccess(request);
  if (!auth.ok) return NextResponse.json(errorResponse(auth.message), { status: auth.status });
  const { id } = await params;
  const sb = await getChatServiceClientForEmpresa(auth.empresaId);
  const { data, error } = await sb
    .from("stock_reservas")
    .select("*, productos:producto_id(nombre, sku, stock_actual)")
    .eq("empresa_id", auth.empresaId)
    .eq("proyecto_id", id)
    .order("fecha_inicio");
  if (error) return NextResponse.json(errorResponse(error.message), { status: 500 });
  const reservas = (data ?? []).map((r) => {
    const raw = r as Record<string, unknown>;
    const p = raw.productos as { nombre?: string; sku?: string; stock_actual?: number } | null;
    return { ...raw, producto_nombre: p?.nombre ?? null, producto_sku: p?.sku ?? null };
  });
  return NextResponse.json(successResponse({ reservas }));
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireProyectosApiAccess(request);
  if (!auth.ok) return NextResponse.json(errorResponse(auth.message), { status: auth.status });
  const { id: proyectoId } = await params;
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;

  const producto_id = String(body.producto_id ?? "").trim();
  if (!producto_id)
    return NextResponse.json(errorResponse("Falta el producto."), { status: 400 });
  const cantidad =
    typeof body.cantidad === "number" && body.cantidad > 0 ? body.cantidad : 0;
  if (cantidad <= 0)
    return NextResponse.json(errorResponse("La cantidad debe ser mayor a 0."), { status: 400 });
  const fecha_inicio = String(body.fecha_inicio ?? "");
  const fecha_fin = String(body.fecha_fin ?? "");
  if (!fecha_inicio || !fecha_fin)
    return NextResponse.json(errorResponse("Faltan las fechas de la reserva."), { status: 400 });
  if (new Date(fecha_fin).getTime() < new Date(fecha_inicio).getTime())
    return NextResponse.json(errorResponse("La fecha fin no puede ser anterior al inicio."), { status: 400 });

  const sb = await getChatServiceClientForEmpresa(auth.empresaId);

  // Chequeo anti-sobre-reserva: cuánto de este producto ya está reservado en
  // rangos que se solapan con el pedido.
  const { data: prodRow } = await sb
    .from("productos")
    .select("stock_actual")
    .eq("empresa_id", auth.empresaId)
    .eq("id", producto_id)
    .maybeSingle();
  const stockActual = Number((prodRow as { stock_actual?: number } | null)?.stock_actual ?? 0);

  const { data: solapadas } = await sb
    .from("stock_reservas")
    .select("cantidad")
    .eq("empresa_id", auth.empresaId)
    .eq("producto_id", producto_id)
    .in("estado", ["reservado", "entregado"])
    .lt("fecha_inicio", fecha_fin)
    .gt("fecha_fin", fecha_inicio);
  const yaReservado = (solapadas ?? []).reduce(
    (acc, r) => acc + Number((r as { cantidad?: number }).cantidad ?? 0),
    0
  );

  if (yaReservado + cantidad > stockActual) {
    return NextResponse.json(
      errorResponse(
        `Stock insuficiente: ${cantidad} solicitadas, ${Math.max(stockActual - yaReservado, 0)} disponibles en ese rango.`
      ),
      { status: 409 }
    );
  }

  const { data, error } = await sb
    .from("stock_reservas")
    .insert({
      empresa_id: auth.empresaId,
      producto_id,
      proyecto_id: proyectoId,
      cantidad,
      fecha_inicio,
      fecha_fin,
      estado: "reservado",
      observaciones: typeof body.observaciones === "string" ? body.observaciones : null,
    })
    .select()
    .single();
  if (error) return NextResponse.json(errorResponse(error.message), { status: 500 });
  return NextResponse.json(successResponse({ reserva: data }));
}
