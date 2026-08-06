import { NextResponse } from "next/server";
import { getChatServiceClientForEmpresa } from "@/app/api/chat/_chat-service-client";
import { errorResponse, successResponse } from "@/lib/api/response";
import { requireProyectosApiAccess } from "@/lib/proyectos/proyectos-auth";

// GET /api/eventos/:id/pagos
// Devuelve pagos imputados al evento + resumen (total cobrado, saldo).
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireProyectosApiAccess(request);
  if (!auth.ok) return NextResponse.json(errorResponse(auth.message), { status: auth.status });
  const { id } = await params;
  const sb = await getChatServiceClientForEmpresa(auth.empresaId);

  const { data: pagos, error: eP } = await sb
    .from("pagos")
    .select("id, fecha, monto, medio_pago, referencia, observaciones")
    .eq("empresa_id", auth.empresaId)
    .eq("proyecto_id", id)
    .order("fecha", { ascending: false });
  if (eP) return NextResponse.json(errorResponse(eP.message), { status: 500 });

  const totalCobrado = (pagos ?? []).reduce(
    (acc, p) => acc + Number((p as { monto?: number }).monto ?? 0),
    0
  );

  // Total presupuestado = último presupuesto aprobado del evento.
  const { data: presAprob } = await sb
    .from("evento_presupuestos")
    .select("total")
    .eq("empresa_id", auth.empresaId)
    .eq("proyecto_id", id)
    .eq("estado", "aprobado")
    .order("version", { ascending: false })
    .limit(1);
  const totalPresupuesto = Number(((presAprob ?? [])[0] as { total?: number } | undefined)?.total ?? 0);
  const saldo = Math.max(totalPresupuesto - totalCobrado, 0);
  const estaPagado = totalPresupuesto > 0 && totalCobrado >= totalPresupuesto;

  return NextResponse.json(
    successResponse({
      total_cobrado: totalCobrado,
      total_presupuesto: totalPresupuesto,
      saldo_pendiente: saldo,
      esta_pagado: estaPagado,
      pagos: pagos ?? [],
    })
  );
}
