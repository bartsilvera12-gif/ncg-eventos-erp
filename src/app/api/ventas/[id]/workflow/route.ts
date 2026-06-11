import { NextRequest, NextResponse } from "next/server";
import { getTenantSupabaseFromAuth } from "@/lib/supabase/tenant-api";
import { successResponse, errorResponse } from "@/lib/api/response";
import { API_ERRORS } from "@/lib/api/errors";

const ESTADOS_PRESUP = new Set(["pendiente", "aprobado", "rechazado", "convertido"]);

/**
 * PATCH /api/ventas/[id]/workflow
 *
 * Cambia tipo_documento y/o estado_presupuesto de una venta.
 * Body: { tipo_documento?: 'venta'|'presupuesto', estado_presupuesto?: 'pendiente'|'aprobado'|'rechazado'|'convertido'|null }
 *
 * Reglas:
 * - Si tipo_documento = 'venta', estado_presupuesto se setea a null.
 * - Si tipo_documento = 'presupuesto' y no se pasa estado, default 'pendiente'.
 */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await getTenantSupabaseFromAuth(request);
    if (!ctx) return NextResponse.json(errorResponse(API_ERRORS.UNAUTHORIZED), { status: 401 });
    const { id } = await params;
    if (!id) return NextResponse.json(errorResponse("id obligatorio"), { status: 400 });

    const body = (await request.json().catch(() => ({}))) as {
      tipo_documento?: string;
      estado_presupuesto?: string | null;
    };

    const update: Record<string, unknown> = {};

    if (body.tipo_documento === "venta") {
      update.tipo_documento = "venta";
      update.estado_presupuesto = null;
    } else if (body.tipo_documento === "presupuesto") {
      update.tipo_documento = "presupuesto";
      if (body.estado_presupuesto === undefined) {
        update.estado_presupuesto = "pendiente";
      }
    }

    if (body.estado_presupuesto !== undefined) {
      const v = body.estado_presupuesto;
      if (v !== null && !ESTADOS_PRESUP.has(String(v))) {
        return NextResponse.json(errorResponse("estado_presupuesto inválido"), { status: 400 });
      }
      update.estado_presupuesto = v;
    }

    if (Object.keys(update).length === 0) {
      return NextResponse.json(errorResponse("Nada que actualizar"), { status: 400 });
    }

    const { error } = await ctx.supabase
      .from("ventas")
      .update(update)
      .eq("id", id)
      .eq("empresa_id", ctx.auth.empresa_id);

    if (error) return NextResponse.json(errorResponse(error.message), { status: 400 });
    return NextResponse.json(successResponse({ ok: true }));
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error";
    return NextResponse.json(errorResponse(msg), { status: 500 });
  }
}
