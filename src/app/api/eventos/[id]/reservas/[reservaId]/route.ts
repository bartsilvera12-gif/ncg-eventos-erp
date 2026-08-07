import { NextResponse } from "next/server";
import { getChatServiceClientForEmpresa } from "@/app/api/chat/_chat-service-client";
import { errorResponse, successResponse } from "@/lib/api/response";
import { requireProyectosApiAccess } from "@/lib/proyectos/proyectos-auth";

const ESTADOS_OK = new Set(["reservado", "entregado", "devuelto", "anulado"]);

// PATCH /api/eventos/:id/reservas/:reservaId
// Body: { estado: 'reservado'|'entregado'|'devuelto'|'anulado', cantidad_devuelta?, cantidad_danada?, observaciones? }
// Al pasar a 'devuelto' con cantidad_danada > 0, mueve N unidades del producto
// a cantidad_mantenimiento (marca como en reparación).
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; reservaId: string }> }
) {
  const auth = await requireProyectosApiAccess(request);
  if (!auth.ok) return NextResponse.json(errorResponse(auth.message), { status: auth.status });
  const { reservaId } = await params;

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const estado = typeof body.estado === "string" ? body.estado : "";
  if (!ESTADOS_OK.has(estado)) {
    return NextResponse.json(errorResponse("Estado inválido."), { status: 400 });
  }

  const sb = await getChatServiceClientForEmpresa(auth.empresaId);

  const { data: reserva, error: eG } = await sb
    .from("stock_reservas")
    .select("id, producto_id, cantidad, estado")
    .eq("empresa_id", auth.empresaId)
    .eq("id", reservaId)
    .maybeSingle();
  if (eG) return NextResponse.json(errorResponse(eG.message), { status: 500 });
  if (!reserva)
    return NextResponse.json(errorResponse("Reserva no encontrada."), { status: 404 });

  const patch: Record<string, unknown> = {
    estado,
    updated_at: new Date().toISOString(),
  };
  if (typeof body.observaciones === "string") patch.observaciones = body.observaciones;

  const { error: eU } = await sb
    .from("stock_reservas")
    .update(patch)
    .eq("empresa_id", auth.empresaId)
    .eq("id", reservaId);
  if (eU) return NextResponse.json(errorResponse(eU.message), { status: 500 });

  // Efecto colateral: si estado='devuelto' con cantidad_danada > 0, aumentar
  // cantidad_mantenimiento del producto (marca como en reparación).
  if (estado === "devuelto") {
    const cantidadDanada = Number(body.cantidad_danada) || 0;
    if (cantidadDanada > 0) {
      const { data: prod } = await sb
        .from("productos")
        .select("cantidad_mantenimiento")
        .eq("empresa_id", auth.empresaId)
        .eq("id", (reserva as { producto_id: string }).producto_id)
        .maybeSingle();
      const actual = Number((prod as { cantidad_mantenimiento?: number } | null)?.cantidad_mantenimiento ?? 0);
      await sb
        .from("productos")
        .update({
          cantidad_mantenimiento: actual + cantidadDanada,
          updated_at: new Date().toISOString(),
        })
        .eq("empresa_id", auth.empresaId)
        .eq("id", (reserva as { producto_id: string }).producto_id);
    }
  }

  return NextResponse.json(successResponse({ ok: true }));
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string; reservaId: string }> }
) {
  const auth = await requireProyectosApiAccess(request);
  if (!auth.ok) return NextResponse.json(errorResponse(auth.message), { status: auth.status });
  const { reservaId } = await params;
  const sb = await getChatServiceClientForEmpresa(auth.empresaId);
  const { error } = await sb
    .from("stock_reservas")
    .delete()
    .eq("empresa_id", auth.empresaId)
    .eq("id", reservaId);
  if (error) return NextResponse.json(errorResponse(error.message), { status: 500 });
  return NextResponse.json(successResponse({ ok: true }));
}
