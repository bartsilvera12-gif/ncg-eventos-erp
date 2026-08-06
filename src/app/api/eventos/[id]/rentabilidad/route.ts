import { NextResponse } from "next/server";
import { getChatServiceClientForEmpresa } from "@/app/api/chat/_chat-service-client";
import { errorResponse, successResponse } from "@/lib/api/response";
import { requireProyectosApiAccess } from "@/lib/proyectos/proyectos-auth";

// GET /api/eventos/:id/rentabilidad
// Consume la función ncgeventos.rentabilidad_evento(uuid) que agrupa:
//   total_cobrado = Σ pagos.monto con proyecto_id
//   total_presupuesto = MAX(evento_presupuestos.total) con estado=aprobado
//   saldo_pendiente = total_presupuesto - total_cobrado
//   total_costos = Σ compras.total + Σ gastos.monto + Σ evento_servicios.costo×cant
//   ganancia = total_cobrado - total_costos
//   margen_pct = ganancia / total_cobrado × 100
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireProyectosApiAccess(request);
  if (!auth.ok) return NextResponse.json(errorResponse(auth.message), { status: auth.status });
  const { id } = await params;

  const sb = await getChatServiceClientForEmpresa(auth.empresaId);
  const { data, error } = await sb.rpc("rentabilidad_evento", { p_proyecto_id: id });

  if (error) return NextResponse.json(errorResponse(error.message), { status: 500 });
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) {
    return NextResponse.json(
      successResponse({
        rentabilidad: {
          proyecto_id: id,
          total_cobrado: 0,
          total_presupuesto: 0,
          saldo_pendiente: 0,
          esta_pagado: false,
          total_costos: 0,
          ganancia: 0,
          margen_pct: 0,
        },
      })
    );
  }
  const r = row as Record<string, unknown>;
  return NextResponse.json(
    successResponse({
      rentabilidad: {
        proyecto_id: id,
        total_cobrado: Number(r.total_cobrado) || 0,
        total_presupuesto: Number(r.total_presupuesto) || 0,
        saldo_pendiente: Number(r.saldo_pendiente) || 0,
        esta_pagado: Boolean(r.esta_pagado),
        total_costos: Number(r.total_costos) || 0,
        ganancia: Number(r.ganancia) || 0,
        margen_pct: Number(r.margen_pct) || 0,
      },
    })
  );
}
