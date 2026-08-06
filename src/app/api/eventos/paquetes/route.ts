import { NextResponse } from "next/server";
import { getChatServiceClientForEmpresa } from "@/app/api/chat/_chat-service-client";
import { errorResponse, successResponse } from "@/lib/api/response";
import { requireProyectosApiAccess } from "@/lib/proyectos/proyectos-auth";

interface PaqueteItemInput {
  servicio_id: string;
  cantidad?: number;
  precio_unitario?: number;
}

export async function GET(request: Request) {
  const auth = await requireProyectosApiAccess(request);
  if (!auth.ok) return NextResponse.json(errorResponse(auth.message), { status: auth.status });
  const sb = await getChatServiceClientForEmpresa(auth.empresaId);
  const { data, error } = await sb
    .from("paquetes_evento")
    .select("*")
    .eq("empresa_id", auth.empresaId)
    .order("nombre");
  if (error) return NextResponse.json(errorResponse(error.message), { status: 500 });
  return NextResponse.json(successResponse({ paquetes: data ?? [] }));
}

export async function POST(request: Request) {
  const auth = await requireProyectosApiAccess(request);
  if (!auth.ok) return NextResponse.json(errorResponse(auth.message), { status: auth.status });

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const nombre = String(body.nombre ?? "").trim();
  if (!nombre) return NextResponse.json(errorResponse("El nombre es obligatorio."), { status: 400 });

  const rawItems = Array.isArray(body.items) ? (body.items as unknown[]) : [];
  const items: PaqueteItemInput[] = [];
  for (const x of rawItems) {
    if (!x || typeof x !== "object") continue;
    const r = x as Record<string, unknown>;
    const servicio_id = String(r.servicio_id ?? "").trim();
    if (!servicio_id) continue;
    items.push({
      servicio_id,
      cantidad: typeof r.cantidad === "number" && r.cantidad > 0 ? r.cantidad : 1,
      precio_unitario: typeof r.precio_unitario === "number" ? r.precio_unitario : 0,
    });
  }

  const precioTotal = items.reduce(
    (acc, it) => acc + (it.cantidad ?? 1) * (it.precio_unitario ?? 0),
    typeof body.precio_total === "number" ? 0 : 0
  );
  const precioTotalFinal =
    typeof body.precio_total === "number" && body.precio_total > 0
      ? body.precio_total
      : precioTotal;

  const sb = await getChatServiceClientForEmpresa(auth.empresaId);
  const { data: paquete, error: errIns } = await sb
    .from("paquetes_evento")
    .insert({
      empresa_id: auth.empresaId,
      nombre,
      descripcion: typeof body.descripcion === "string" ? body.descripcion : null,
      precio_total: precioTotalFinal,
      activo: body.activo !== false,
    })
    .select()
    .single();
  if (errIns || !paquete)
    return NextResponse.json(errorResponse(errIns?.message ?? "No se pudo crear el paquete."), { status: 500 });

  if (items.length > 0) {
    const { error: errItems } = await sb.from("paquete_items").insert(
      items.map((it) => ({
        empresa_id: auth.empresaId,
        paquete_id: paquete.id,
        servicio_id: it.servicio_id,
        cantidad: it.cantidad,
        precio_unitario: it.precio_unitario,
      }))
    );
    if (errItems)
      return NextResponse.json(errorResponse(errItems.message), { status: 500 });
  }

  return NextResponse.json(successResponse({ paquete }));
}
