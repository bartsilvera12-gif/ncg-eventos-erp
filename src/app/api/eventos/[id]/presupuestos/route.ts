import { NextResponse } from "next/server";
import { getChatServiceClientForEmpresa } from "@/app/api/chat/_chat-service-client";
import { errorResponse, successResponse } from "@/lib/api/response";
import { requireProyectosApiAccess } from "@/lib/proyectos/proyectos-auth";

const TIPOS_ITEM_OK = new Set(["servicio", "paquete", "producto", "texto"]);

interface PresupuestoItemInput {
  tipo: string;
  ref_id: string | null;
  descripcion: string;
  cantidad: number;
  precio_unitario: number;
  sort_order: number;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireProyectosApiAccess(request);
  if (!auth.ok) return NextResponse.json(errorResponse(auth.message), { status: auth.status });
  const { id } = await params;
  const sb = await getChatServiceClientForEmpresa(auth.empresaId);
  const { data, error } = await sb
    .from("evento_presupuestos")
    .select("*, items:evento_presupuesto_items(*)")
    .eq("empresa_id", auth.empresaId)
    .eq("proyecto_id", id)
    .order("version", { ascending: false });
  if (error) return NextResponse.json(errorResponse(error.message), { status: 500 });
  return NextResponse.json(successResponse({ presupuestos: data ?? [] }));
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireProyectosApiAccess(request);
  if (!auth.ok) return NextResponse.json(errorResponse(auth.message), { status: auth.status });
  const { id: proyectoId } = await params;
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;

  const rawItems = Array.isArray(body.items) ? (body.items as unknown[]) : [];
  const items: PresupuestoItemInput[] = [];
  for (let i = 0; i < rawItems.length; i++) {
    const x = rawItems[i];
    if (!x || typeof x !== "object") continue;
    const r = x as Record<string, unknown>;
    const tipoRaw = String(r.tipo ?? "servicio");
    const tipo = TIPOS_ITEM_OK.has(tipoRaw) ? tipoRaw : "servicio";
    const descripcion = String(r.descripcion ?? "").trim();
    if (!descripcion) continue;
    items.push({
      tipo,
      ref_id: typeof r.ref_id === "string" ? r.ref_id : null,
      descripcion,
      cantidad: typeof r.cantidad === "number" && r.cantidad > 0 ? r.cantidad : 1,
      precio_unitario: typeof r.precio_unitario === "number" ? r.precio_unitario : 0,
      sort_order: typeof r.sort_order === "number" ? r.sort_order : i,
    });
  }
  if (items.length === 0) {
    return NextResponse.json(errorResponse("Agregá al menos una línea al presupuesto."), { status: 400 });
  }

  const total = items.reduce((s, it) => s + it.cantidad * it.precio_unitario, 0);

  const sb = await getChatServiceClientForEmpresa(auth.empresaId);
  // Calcular siguiente versión
  const { data: last } = await sb
    .from("evento_presupuestos")
    .select("version")
    .eq("empresa_id", auth.empresaId)
    .eq("proyecto_id", proyectoId)
    .order("version", { ascending: false })
    .limit(1);
  const nextVersion = ((last ?? [])[0]?.version as number | undefined) ?? 0;

  const { data: presupuesto, error: eIns } = await sb
    .from("evento_presupuestos")
    .insert({
      empresa_id: auth.empresaId,
      proyecto_id: proyectoId,
      version: nextVersion + 1,
      estado: "borrador",
      fecha:
        typeof body.fecha === "string" && body.fecha
          ? body.fecha
          : new Date().toISOString().slice(0, 10),
      validez_dias:
        typeof body.validez_dias === "number" && body.validez_dias > 0
          ? Math.floor(body.validez_dias)
          : null,
      total,
      observaciones: typeof body.observaciones === "string" ? body.observaciones : null,
    })
    .select()
    .single();
  if (eIns || !presupuesto) {
    return NextResponse.json(errorResponse(eIns?.message ?? "No se pudo crear el presupuesto."), { status: 500 });
  }

  const { error: eItems } = await sb.from("evento_presupuesto_items").insert(
    items.map((it) => ({
      empresa_id: auth.empresaId,
      presupuesto_id: presupuesto.id,
      tipo: it.tipo,
      ref_id: it.ref_id,
      descripcion: it.descripcion,
      cantidad: it.cantidad,
      precio_unitario: it.precio_unitario,
      subtotal: it.cantidad * it.precio_unitario,
      sort_order: it.sort_order,
    }))
  );
  if (eItems) return NextResponse.json(errorResponse(eItems.message), { status: 500 });

  return NextResponse.json(successResponse({ presupuesto }));
}
