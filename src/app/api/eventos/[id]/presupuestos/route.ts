import { NextResponse } from "next/server";
import { getChatServiceClientForEmpresa } from "@/app/api/chat/_chat-service-client";
import { errorResponse, successResponse } from "@/lib/api/response";
import { requireProyectosApiAccess } from "@/lib/proyectos/proyectos-auth";

const TIPOS_ITEM_OK = new Set(["servicio", "paquete", "producto", "texto"]);
const IVAS_OK = new Set([0, 5, 10]);

interface PresupuestoItemInput {
  tipo: string;
  ref_id: string | null;
  descripcion: string;
  cantidad: number;
  precio_unitario: number;
  unidad: string;
  categoria: string | null;
  descuento_pct: number;
  iva_pct: number;
  sort_order: number;
}

function calcLinea(it: PresupuestoItemInput) {
  const bruto = it.cantidad * it.precio_unitario;
  const subtotal = bruto * (1 - it.descuento_pct / 100);
  const iva = subtotal * (it.iva_pct / 100);
  return { subtotal, iva };
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
    const descuento_pct =
      typeof r.descuento_pct === "number" && r.descuento_pct >= 0 && r.descuento_pct <= 100
        ? r.descuento_pct
        : 0;
    const ivaRaw = typeof r.iva_pct === "number" ? r.iva_pct : 10;
    const iva_pct = IVAS_OK.has(ivaRaw) ? ivaRaw : 10;
    items.push({
      tipo,
      ref_id: typeof r.ref_id === "string" ? r.ref_id : null,
      descripcion,
      cantidad: typeof r.cantidad === "number" && r.cantidad > 0 ? r.cantidad : 1,
      precio_unitario: typeof r.precio_unitario === "number" ? r.precio_unitario : 0,
      unidad: typeof r.unidad === "string" && r.unidad.trim() ? r.unidad.trim() : "u",
      categoria:
        typeof r.categoria === "string" && r.categoria.trim() ? r.categoria.trim() : null,
      descuento_pct,
      iva_pct,
      sort_order: typeof r.sort_order === "number" ? r.sort_order : i,
    });
  }
  if (items.length === 0) {
    return NextResponse.json(errorResponse("Agregá al menos una línea al presupuesto."), { status: 400 });
  }

  let baseImponible = 0;
  let montoIva = 0;
  const itemRows = items.map((it) => {
    const { subtotal, iva } = calcLinea(it);
    baseImponible += subtotal;
    montoIva += iva;
    return { ...it, subtotal };
  });
  const total = baseImponible + montoIva;

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
      base_imponible: baseImponible,
      monto_iva: montoIva,
      total,
      observaciones: typeof body.observaciones === "string" ? body.observaciones : null,
      condiciones_pago:
        typeof body.condiciones_pago === "string" && body.condiciones_pago.trim()
          ? body.condiciones_pago.trim()
          : null,
    })
    .select()
    .single();
  if (eIns || !presupuesto) {
    return NextResponse.json(errorResponse(eIns?.message ?? "No se pudo crear el presupuesto."), { status: 500 });
  }

  const { error: eItems } = await sb.from("evento_presupuesto_items").insert(
    itemRows.map((it) => ({
      empresa_id: auth.empresaId,
      presupuesto_id: presupuesto.id,
      tipo: it.tipo,
      ref_id: it.ref_id,
      descripcion: it.descripcion,
      cantidad: it.cantidad,
      precio_unitario: it.precio_unitario,
      unidad: it.unidad,
      categoria: it.categoria,
      descuento_pct: it.descuento_pct,
      iva_pct: it.iva_pct,
      subtotal: it.subtotal,
      sort_order: it.sort_order,
    }))
  );
  if (eItems) return NextResponse.json(errorResponse(eItems.message), { status: 500 });

  return NextResponse.json(successResponse({ presupuesto }));
}
