import { NextRequest, NextResponse } from "next/server";
import { getTenantSupabaseFromAuth } from "@/lib/supabase/tenant-api";
import { successResponse, errorResponse } from "@/lib/api/response";
import { API_ERRORS } from "@/lib/api/errors";

/**
 * POST /api/ventas/[id]/convertir-obra
 *
 * Convierte un presupuesto aprobado en una obra (proyecto):
 * 1. Lee la venta, valida tipo_documento='presupuesto' y estado_presupuesto='aprobado'.
 * 2. Resuelve estado y tipo de proyecto por defecto.
 * 3. Crea un proyecto con titulo derivado, monto_vendido = ventas.total, cliente_id si está.
 * 4. Setea ventas.proyecto_id = nuevo proyecto y ventas.estado_presupuesto = 'convertido'.
 *
 * Body opcional: { titulo?: string }
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await getTenantSupabaseFromAuth(request);
    if (!ctx) return NextResponse.json(errorResponse(API_ERRORS.UNAUTHORIZED), { status: 401 });
    const { id } = await params;
    if (!id) return NextResponse.json(errorResponse("id obligatorio"), { status: 400 });
    const empresaId = ctx.auth.empresa_id;

    // 1. Cargar la venta
    const { data: venta, error: e1 } = await ctx.supabase
      .from("ventas")
      .select("id, numero_control, cliente_id, total, tipo_documento, estado_presupuesto, proyecto_id")
      .eq("id", id)
      .eq("empresa_id", empresaId)
      .maybeSingle();
    if (e1) return NextResponse.json(errorResponse(e1.message), { status: 400 });
    if (!venta) return NextResponse.json(errorResponse("Presupuesto no encontrado"), { status: 404 });

    const v = venta as {
      id: string;
      numero_control: string | null;
      cliente_id: string | null;
      total: number | string;
      tipo_documento: string | null;
      estado_presupuesto: string | null;
      proyecto_id: string | null;
    };

    if (v.tipo_documento !== "presupuesto") {
      return NextResponse.json(errorResponse("Esta venta no es un presupuesto."), { status: 400 });
    }
    if (v.estado_presupuesto !== "aprobado") {
      return NextResponse.json(errorResponse("Solo presupuestos aprobados se convierten en obra."), { status: 400 });
    }
    if (v.proyecto_id) {
      return NextResponse.json(errorResponse("Este presupuesto ya está vinculado a una obra."), { status: 400 });
    }

    // 2. Estado inicial y tipo de proyecto
    const [estadoQ, tipoQ] = await Promise.all([
      ctx.supabase.from("proyecto_estados")
        .select("id")
        .eq("empresa_id", empresaId)
        .eq("activo", true)
        .eq("es_estado_inicial", true)
        .order("sort_order", { ascending: true })
        .limit(1),
      ctx.supabase.from("proyecto_tipos")
        .select("id")
        .eq("empresa_id", empresaId)
        .eq("activo", true)
        .order("created_at", { ascending: true })
        .limit(1),
    ]);
    if (estadoQ.error) return NextResponse.json(errorResponse(estadoQ.error.message), { status: 400 });
    if (tipoQ.error) return NextResponse.json(errorResponse(tipoQ.error.message), { status: 400 });

    const estadoId = (estadoQ.data ?? [])[0]?.id as string | undefined;
    const tipoId = (tipoQ.data ?? [])[0]?.id as string | undefined;
    if (!estadoId) return NextResponse.json(errorResponse("Falta configurar al menos un estado inicial activo."), { status: 400 });
    if (!tipoId) return NextResponse.json(errorResponse("Falta configurar al menos un tipo de proyecto."), { status: 400 });

    const body = (await request.json().catch(() => ({}))) as { titulo?: string };
    const tituloProp = body.titulo?.trim();
    const titulo = tituloProp || `Obra (de presupuesto ${v.numero_control ?? id.slice(0, 8)})`;

    // 3. Crear el proyecto
    const insertProy = {
      empresa_id: empresaId,
      cliente_id: v.cliente_id ?? null,
      tipo_id: tipoId,
      estado_id: estadoId,
      titulo,
      prioridad: "normal",
      monto_vendido: Number(v.total) || 0,
      fecha_ingreso: new Date().toISOString(),
    };

    const { data: nuevoProy, error: e2 } = await ctx.supabase
      .from("proyectos")
      .insert([insertProy])
      .select("id, titulo")
      .single();
    if (e2 || !nuevoProy) {
      return NextResponse.json(errorResponse(e2?.message ?? "No se pudo crear la obra"), { status: 400 });
    }
    const nuevoProyecto = nuevoProy as { id: string; titulo: string };

    // 4. Actualizar el presupuesto: vincular a obra + marcar convertido
    const { error: e3 } = await ctx.supabase
      .from("ventas")
      .update({ proyecto_id: nuevoProyecto.id, estado_presupuesto: "convertido" })
      .eq("id", id)
      .eq("empresa_id", empresaId);
    if (e3) {
      return NextResponse.json(errorResponse(e3.message), { status: 400 });
    }

    return NextResponse.json(successResponse({ proyecto: nuevoProyecto }));
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error";
    return NextResponse.json(errorResponse(msg), { status: 500 });
  }
}
