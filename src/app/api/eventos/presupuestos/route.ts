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

// GET /api/eventos/presupuestos — lista TODOS los presupuestos de la empresa,
// incluyendo cotizaciones standalone (proyecto_id NULL) y los vinculados a
// eventos. Cada fila incluye evento/cliente para render.
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
       proyecto_id, cliente_id, titulo_evento, tipo_evento, fecha_evento_aprox,
       cantidad_invitados,
       proyectos:proyecto_id(titulo, fecha_evento, cliente_id,
         clientes:cliente_id(empresa, nombre_contacto)),
       clientes:cliente_id(empresa, nombre_contacto)`
    )
    .eq("empresa_id", auth.empresaId)
    .order("created_at", { ascending: false })
    .limit(500);

  if (estado) q = q.eq("estado", estado);

  const { data, error } = await q;
  if (error) return NextResponse.json(errorResponse(error.message), { status: 500 });

  // Aplanar: si el presupuesto tiene proyecto vinculado, usar los datos del
  // proyecto; si es standalone, usar los campos snapshot del propio presupuesto.
  const presupuestos = (data ?? []).map((row) => {
    const r = row as Record<string, unknown>;
    const proy = r.proyectos as {
      titulo?: string;
      fecha_evento?: string | null;
      clientes?: { empresa?: string; nombre_contacto?: string } | null;
    } | null;
    const cliDir = r.clientes as { empresa?: string; nombre_contacto?: string } | null;
    const clienteNombre =
      proy?.clientes?.empresa || proy?.clientes?.nombre_contacto ||
      cliDir?.empresa || cliDir?.nombre_contacto || null;
    return {
      id: r.id,
      version: r.version,
      estado: r.estado,
      fecha: r.fecha,
      total: r.total,
      observaciones: r.observaciones,
      aprobado_at: r.aprobado_at,
      created_at: r.created_at,
      proyecto_id: r.proyecto_id, // null si es cotización standalone
      es_cotizacion: !r.proyecto_id,
      evento_titulo: proy?.titulo ?? (r.titulo_evento as string | null) ?? null,
      evento_fecha: proy?.fecha_evento ?? (r.fecha_evento_aprox as string | null) ?? null,
      cliente_nombre: clienteNombre,
      tipo_evento: r.tipo_evento,
      cantidad_invitados: r.cantidad_invitados,
    };
  });

  return NextResponse.json(successResponse({ presupuestos }));
}

// POST /api/eventos/presupuestos — crea presupuesto STANDALONE (cotización)
// sin vincular a un evento. Body incluye cliente_id + titulo_evento +
// tipo_evento + fecha_evento_aprox + cantidad_invitados + items.
// El evento se crea recién al aprobar.
export async function POST(request: Request) {
  const auth = await requireProyectosApiAccess(request);
  if (!auth.ok) return NextResponse.json(errorResponse(auth.message), { status: auth.status });
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;

  const clienteId = typeof body.cliente_id === "string" ? body.cliente_id : null;
  const tituloEvento = String(body.titulo_evento ?? "").trim();
  if (!clienteId) return NextResponse.json(errorResponse("Cliente obligatorio."), { status: 400 });
  if (!tituloEvento)
    return NextResponse.json(errorResponse("Título del evento obligatorio."), { status: 400 });

  const rawItems = Array.isArray(body.items) ? (body.items as unknown[]) : [];
  const items: PresupuestoItemInput[] = [];
  for (let i = 0; i < rawItems.length; i++) {
    const x = rawItems[i];
    if (!x || typeof x !== "object") continue;
    const r = x as Record<string, unknown>;
    const tipoRaw = String(r.tipo ?? "texto");
    const tipo = TIPOS_ITEM_OK.has(tipoRaw) ? tipoRaw : "texto";
    const descripcion = String(r.descripcion ?? "").trim();
    if (!descripcion) continue;
    const descuento_pct =
      typeof r.descuento_pct === "number" && r.descuento_pct >= 0 && r.descuento_pct <= 100
        ? r.descuento_pct
        : 0;
    const ivaRaw = typeof r.iva_pct === "number" ? r.iva_pct : 0;
    const iva_pct = IVAS_OK.has(ivaRaw) ? ivaRaw : 0;
    items.push({
      tipo,
      ref_id: typeof r.ref_id === "string" ? r.ref_id : null,
      descripcion,
      cantidad: typeof r.cantidad === "number" && r.cantidad > 0 ? r.cantidad : 1,
      precio_unitario: typeof r.precio_unitario === "number" ? r.precio_unitario : 0,
      unidad: typeof r.unidad === "string" && r.unidad.trim() ? r.unidad.trim() : "servicio",
      categoria:
        typeof r.categoria === "string" && r.categoria.trim() ? r.categoria.trim() : null,
      descuento_pct,
      iva_pct,
      sort_order: typeof r.sort_order === "number" ? r.sort_order : i,
    });
  }
  if (items.length === 0) {
    return NextResponse.json(errorResponse("Agregá al menos una línea."), { status: 400 });
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
  const { data: presupuesto, error: eIns } = await sb
    .from("evento_presupuestos")
    .insert({
      empresa_id: auth.empresaId,
      proyecto_id: null, // standalone: se vincula al aprobar
      version: 1,
      estado: "borrador",
      fecha: new Date().toISOString().slice(0, 10),
      validez_dias:
        typeof body.validez_dias === "number" && body.validez_dias > 0
          ? Math.floor(body.validez_dias)
          : 30,
      base_imponible: baseImponible,
      monto_iva: montoIva,
      total,
      observaciones: typeof body.observaciones === "string" ? body.observaciones : null,
      cliente_id: clienteId,
      titulo_evento: tituloEvento,
      tipo_evento: typeof body.tipo_evento === "string" ? body.tipo_evento : null,
      fecha_evento_aprox:
        typeof body.fecha_evento_aprox === "string" && body.fecha_evento_aprox
          ? body.fecha_evento_aprox
          : null,
      cantidad_invitados:
        typeof body.cantidad_invitados === "number" && body.cantidad_invitados > 0
          ? Math.floor(body.cantidad_invitados)
          : null,
    })
    .select()
    .single();
  if (eIns || !presupuesto) {
    return NextResponse.json(
      errorResponse(eIns?.message ?? "No se pudo crear la cotización."),
      { status: 500 }
    );
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
