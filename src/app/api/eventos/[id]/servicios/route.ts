import { NextResponse } from "next/server";
import { getChatServiceClientForEmpresa } from "@/app/api/chat/_chat-service-client";
import { errorResponse, successResponse } from "@/lib/api/response";
import { requireProyectosApiAccess } from "@/lib/proyectos/proyectos-auth";

const ESTADOS_OK = new Set(["pendiente", "contratado", "entregado", "cancelado"]);

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireProyectosApiAccess(request);
  if (!auth.ok) return NextResponse.json(errorResponse(auth.message), { status: auth.status });
  const { id } = await params;
  const sb = await getChatServiceClientForEmpresa(auth.empresaId);
  const { data, error } = await sb
    .from("evento_servicios")
    .select("*, proveedores:proveedor_id(nombre)")
    .eq("empresa_id", auth.empresaId)
    .eq("proyecto_id", id)
    .order("created_at");
  if (error) return NextResponse.json(errorResponse(error.message), { status: 500 });
  const servicios = (data ?? []).map((r) => {
    const raw = r as Record<string, unknown>;
    const p = raw.proveedores as { nombre?: string } | null;
    return { ...raw, proveedor_nombre: p?.nombre ?? null };
  });
  return NextResponse.json(successResponse({ servicios }));
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireProyectosApiAccess(request);
  if (!auth.ok) return NextResponse.json(errorResponse(auth.message), { status: auth.status });
  const { id: proyectoId } = await params;
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;

  const descripcion = String(body.descripcion ?? "").trim();
  if (!descripcion)
    return NextResponse.json(errorResponse("La descripción es obligatoria."), { status: 400 });
  const cantidad =
    typeof body.cantidad === "number" && body.cantidad > 0 ? body.cantidad : 1;
  const precio =
    typeof body.precio_unitario === "number" && body.precio_unitario >= 0
      ? body.precio_unitario
      : 0;
  const costo =
    typeof body.costo_unitario === "number" && body.costo_unitario >= 0
      ? body.costo_unitario
      : 0;
  const estadoRaw = String(body.estado ?? "pendiente");
  const estado = ESTADOS_OK.has(estadoRaw) ? estadoRaw : "pendiente";

  const sb = await getChatServiceClientForEmpresa(auth.empresaId);
  const { data, error } = await sb
    .from("evento_servicios")
    .insert({
      empresa_id: auth.empresaId,
      proyecto_id: proyectoId,
      servicio_id: typeof body.servicio_id === "string" ? body.servicio_id : null,
      paquete_id: typeof body.paquete_id === "string" ? body.paquete_id : null,
      proveedor_id: typeof body.proveedor_id === "string" ? body.proveedor_id : null,
      descripcion,
      cantidad,
      precio_unitario: precio,
      costo_unitario: costo,
      subtotal: cantidad * precio,
      estado,
      observaciones: typeof body.observaciones === "string" ? body.observaciones : null,
    })
    .select()
    .single();
  if (error) return NextResponse.json(errorResponse(error.message), { status: 500 });
  return NextResponse.json(successResponse({ servicio: data }));
}
