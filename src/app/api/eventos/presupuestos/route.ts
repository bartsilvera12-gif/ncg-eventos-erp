import { NextResponse } from "next/server";
import { getChatServiceClientForEmpresa } from "@/app/api/chat/_chat-service-client";
import { errorResponse, successResponse } from "@/lib/api/response";
import { requireProyectosApiAccess } from "@/lib/proyectos/proyectos-auth";

// GET /api/eventos/presupuestos — lista todos los presupuestos de todos los
// eventos de la empresa, con datos del evento y cliente para render de lista.
// Filtros opcionales: ?estado=aprobado|borrador|enviado|rechazado
export async function GET(request: Request) {
  const auth = await requireProyectosApiAccess(request);
  if (!auth.ok) return NextResponse.json(errorResponse(auth.message), { status: auth.status });

  const sp = new URL(request.url).searchParams;
  const estado = sp.get("estado");

  const sb = await getChatServiceClientForEmpresa(auth.empresaId);
  let q = sb
    .from("evento_presupuestos")
    .select(
      `id, version, estado, fecha, total, observaciones, aprobado_at, created_at,
       proyecto_id,
       proyectos:proyecto_id(titulo, fecha_evento, cliente_id,
         clientes:cliente_id(empresa, nombre_contacto))`
    )
    .eq("empresa_id", auth.empresaId)
    .order("created_at", { ascending: false })
    .limit(500);

  if (estado) q = q.eq("estado", estado);

  const { data, error } = await q;
  if (error) return NextResponse.json(errorResponse(error.message), { status: 500 });

  const presupuestos = (data ?? []).map((row) => {
    const r = row as Record<string, unknown>;
    const proy = r.proyectos as {
      titulo?: string;
      fecha_evento?: string | null;
      clientes?: { empresa?: string; nombre_contacto?: string } | null;
    } | null;
    return {
      id: r.id,
      version: r.version,
      estado: r.estado,
      fecha: r.fecha,
      total: r.total,
      observaciones: r.observaciones,
      aprobado_at: r.aprobado_at,
      created_at: r.created_at,
      proyecto_id: r.proyecto_id,
      evento_titulo: proy?.titulo ?? null,
      evento_fecha: proy?.fecha_evento ?? null,
      cliente_nombre: proy?.clientes?.empresa || proy?.clientes?.nombre_contacto || null,
    };
  });

  return NextResponse.json(successResponse({ presupuestos }));
}
