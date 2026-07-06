import { NextRequest, NextResponse } from "next/server";
import { getTenantSupabaseFromAuth } from "@/lib/supabase/tenant-api";
import { fetchDataSchemaForEmpresaId } from "@/lib/supabase/empresa-data-schema";
import { successResponse, errorResponse } from "@/lib/api/response";
import { API_ERRORS } from "@/lib/api/errors";
import { updateAlquilerEstado } from "@/lib/alquileres/server/alquileres-pg";

const ESTADOS_OK = ["reservado", "activo", "finalizado", "anulado"] as const;

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await getTenantSupabaseFromAuth(request);
    if (!ctx) return NextResponse.json(errorResponse(API_ERRORS.UNAUTHORIZED), { status: 401 });
    const { id } = await params;
    const body = (await request.json().catch(() => ({}))) as { estado?: string };
    const estadoRaw = String(body.estado ?? "");
    if (!(ESTADOS_OK as readonly string[]).includes(estadoRaw)) {
      return NextResponse.json(errorResponse("Estado inválido."), { status: 400 });
    }
    const schema = await fetchDataSchemaForEmpresaId(ctx.auth.empresa_id);
    await updateAlquilerEstado(
      schema,
      ctx.auth.empresa_id,
      id,
      estadoRaw as "reservado" | "activo" | "finalizado" | "anulado"
    );
    return NextResponse.json(successResponse({ ok: true }));
  } catch (err) {
    console.error("[/api/alquileres/:id/estado PATCH]", err instanceof Error ? err.message : err);
    return NextResponse.json(errorResponse("No se pudo actualizar el estado."), { status: 500 });
  }
}
