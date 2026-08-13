import { NextResponse } from "next/server";
import { getChatServiceClientForEmpresa } from "@/app/api/chat/_chat-service-client";
import { errorResponse, successResponse } from "@/lib/api/response";
import { requireProyectosApiAccess } from "@/lib/proyectos/proyectos-auth";

const ESTADOS_OK = new Set(["borrador", "enviado", "aprobado", "rechazado"]);

type PresupuestoRow = {
  id: string;
  empresa_id: string;
  proyecto_id: string;
  version: number;
  estado: string;
  base_imponible: number | string;
  monto_iva: number | string;
  total: number | string;
  condiciones_pago: string | null;
  observaciones: string | null;
  venta_id: string | null;
  items: Array<{
    id: string;
    tipo: string;
    descripcion: string;
    cantidad: number | string;
    precio_unitario: number | string;
    unidad: string;
    categoria: string | null;
    descuento_pct: number | string;
    iva_pct: number | string;
    subtotal: number | string;
    sort_order: number;
  }>;
};

// Sb es el client de PostgREST scopeado al schema de datos de la empresa.
// Usamos `any` local para evitar hacer explotar el genérico del builder.
/* eslint-disable @typescript-eslint/no-explicit-any */
type Sb = any;

/**
 * Al aprobar el presupuesto:
 *   - Marca el evento como "confirmado" (buscando proyecto_estados por código).
 *   - Actualiza monto_vendido del evento con el total del presupuesto.
 *   - Crea una venta (tipo_documento='venta', estado='completada') con los
 *     ítems del presupuesto como partidas manuales (tipo_partida='servicio',
 *     sin producto_id, sin tocar stock) para que cuente en Ventas/reportes.
 *   - Deja el id de la venta creada en presupuesto.venta_id.
 *
 * Si algún side-effect falla, el estado del presupuesto igual queda como
 * "aprobado" — la aprobación es la fuente de verdad; el resto se puede
 * reintentar. El error se devuelve al cliente.
 */
async function aplicarAprobacion(
  sb: Sb,
  empresaId: string,
  presupuestoId: string,
  presupuesto: PresupuestoRow
): Promise<{ ventaId: string | null; error: string | null }> {
  const total = Number(presupuesto.total ?? 0);
  const base = Number(presupuesto.base_imponible ?? 0);
  const iva = Number(presupuesto.monto_iva ?? 0);

  // 1) Evento → estado "confirmado" (si el catálogo lo tiene) + monto_vendido.
  const estadoQ = await sb
    .from("proyecto_estados")
    .select("id")
    .eq("empresa_id", empresaId)
    .eq("codigo", "confirmado")
    .eq("activo", true)
    .limit(1)
    .maybeSingle();
  const estadoConfirmadoId = (estadoQ.data as { id?: string } | null)?.id ?? null;

  const patchEvento: Record<string, unknown> = {
    monto_vendido: total,
    updated_at: new Date().toISOString(),
  };
  if (estadoConfirmadoId) patchEvento.estado_id = estadoConfirmadoId;
  await sb
    .from("proyectos")
    .update(patchEvento)
    .eq("empresa_id", empresaId)
    .eq("id", presupuesto.proyecto_id);

  // 2) Si ya había una venta asociada, no la duplicamos.
  if (presupuesto.venta_id) {
    return { ventaId: presupuesto.venta_id, error: null };
  }

  // 3) Generar numero_control VTA-XXXXXX (best-effort).
  const maxQ = await sb
    .from("ventas")
    .select("numero_control")
    .eq("empresa_id", empresaId)
    .like("numero_control", "VTA-%")
    .order("numero_control", { ascending: false })
    .limit(1);
  if (maxQ.error) return { ventaId: null, error: maxQ.error.message };
  let nextNum = 1;
  const lastNum = (maxQ.data?.[0] as { numero_control?: string } | undefined)?.numero_control;
  if (lastNum) {
    const m = lastNum.match(/^VTA-(\d+)$/);
    if (m) nextNum = parseInt(m[1], 10) + 1;
  }
  const numeroControl = `VTA-${String(nextNum).padStart(6, "0")}`;
  const fechaIso = new Date().toISOString();

  // 4) Cliente del evento.
  const evQ = await sb
    .from("proyectos")
    .select("cliente_id, titulo")
    .eq("empresa_id", empresaId)
    .eq("id", presupuesto.proyecto_id)
    .maybeSingle();
  const clienteId = (evQ.data as { cliente_id?: string | null } | null)?.cliente_id ?? null;
  const eventoTitulo = (evQ.data as { titulo?: string } | null)?.titulo ?? "";

  // 5) Insert venta cabecera.
  const insVenta = await sb
    .from("ventas")
    .insert({
      empresa_id: empresaId,
      cliente_id: clienteId,
      numero_control: numeroControl,
      moneda: "GS",
      tipo_cambio: 1,
      subtotal: base,
      monto_iva: iva,
      total,
      estado: "completada",
      tipo_venta: "CONTADO",
      metodo_pago: null,
      fecha: fechaIso,
      observaciones: `Presupuesto v${presupuesto.version} · ${eventoTitulo}`.slice(0, 500),
      tipo_documento: "venta",
      proyecto_id: presupuesto.proyecto_id,
      monto_cobrado: 0,
    })
    .select("id")
    .single();
  if (insVenta.error) return { ventaId: null, error: insVenta.error.message };
  const ventaId = String((insVenta.data as { id: string }).id);

  // 6) Insert items — todos como partidas manuales, sin tocar stock.
  const itemsRows = presupuesto.items.map((it) => {
    const cant = Number(it.cantidad);
    const precio = Number(it.precio_unitario);
    const desc = Number(it.descuento_pct ?? 0);
    const ivaPct = Number(it.iva_pct ?? 10);
    const subtotal = cant * precio * (1 - desc / 100);
    const montoIvaLinea = subtotal * (ivaPct / 100);
    const tipoIvaStr = ivaPct === 0 ? "EXENTA" : `${ivaPct}%`;
    return {
      empresa_id: empresaId,
      venta_id: ventaId,
      producto_id: null,
      producto_nombre: it.descripcion,
      sku: "",
      cantidad: cant,
      precio_venta_original: precio,
      precio_venta: precio,
      tipo_iva: tipoIvaStr,
      tipo_precio: "minorista",
      subtotal,
      monto_iva: montoIvaLinea,
      total_linea: subtotal + montoIvaLinea,
      tipo_partida: "servicio",
      descripcion: it.categoria ? `[${it.categoria}] ${it.descripcion}` : it.descripcion,
    };
  });
  const insItems = await sb.from("ventas_items").insert(itemsRows);
  if (insItems.error) {
    await sb.from("ventas").delete().eq("id", ventaId).eq("empresa_id", empresaId);
    return { ventaId: null, error: insItems.error.message };
  }

  // 7) Guardar el vínculo en el presupuesto.
  await sb
    .from("evento_presupuestos")
    .update({ venta_id: ventaId, updated_at: new Date().toISOString() })
    .eq("empresa_id", empresaId)
    .eq("id", presupuestoId);

  return { ventaId, error: null };
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; presupuestoId: string }> }
) {
  const auth = await requireProyectosApiAccess(request);
  if (!auth.ok) return NextResponse.json(errorResponse(auth.message), { status: auth.status });
  const { presupuestoId } = await params;
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const patch: Record<string, unknown> = {};
  let esAprobacion = false;
  if (typeof body.estado === "string" && ESTADOS_OK.has(body.estado)) {
    patch.estado = body.estado;
    if (body.estado === "aprobado") {
      patch.aprobado_at = new Date().toISOString();
      esAprobacion = true;
    }
  }
  if (typeof body.observaciones === "string") patch.observaciones = body.observaciones;
  patch.updated_at = new Date().toISOString();

  const sb = await getChatServiceClientForEmpresa(auth.empresaId);
  const { error } = await sb
    .from("evento_presupuestos")
    .update(patch)
    .eq("empresa_id", auth.empresaId)
    .eq("id", presupuestoId);
  if (error) return NextResponse.json(errorResponse(error.message), { status: 500 });

  let ventaId: string | null = null;
  if (esAprobacion) {
    const { data: presupuesto } = await sb
      .from("evento_presupuestos")
      .select("*, items:evento_presupuesto_items(*)")
      .eq("empresa_id", auth.empresaId)
      .eq("id", presupuestoId)
      .maybeSingle();
    if (presupuesto) {
      const res = await aplicarAprobacion(
        sb,
        auth.empresaId,
        presupuestoId,
        presupuesto as PresupuestoRow
      );
      ventaId = res.ventaId;
      if (res.error) {
        return NextResponse.json(
          errorResponse(`Presupuesto aprobado, pero falló la creación de la venta: ${res.error}`),
          { status: 500 }
        );
      }
    }
  }

  return NextResponse.json(successResponse({ ok: true, venta_id: ventaId }));
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string; presupuestoId: string }> }
) {
  const auth = await requireProyectosApiAccess(request);
  if (!auth.ok) return NextResponse.json(errorResponse(auth.message), { status: auth.status });
  const { presupuestoId } = await params;
  const sb = await getChatServiceClientForEmpresa(auth.empresaId);
  const { error } = await sb
    .from("evento_presupuestos")
    .delete()
    .eq("empresa_id", auth.empresaId)
    .eq("id", presupuestoId);
  if (error) return NextResponse.json(errorResponse(error.message), { status: 500 });
  return NextResponse.json(successResponse({ ok: true }));
}
