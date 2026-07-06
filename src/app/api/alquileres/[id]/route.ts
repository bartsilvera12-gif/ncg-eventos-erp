import { NextRequest, NextResponse } from "next/server";
import { getTenantSupabaseFromAuth } from "@/lib/supabase/tenant-api";
import { fetchDataSchemaForEmpresaId } from "@/lib/supabase/empresa-data-schema";
import { successResponse, errorResponse } from "@/lib/api/response";
import { API_ERRORS } from "@/lib/api/errors";
import { getAlquilerById, listAlquilerItems } from "@/lib/alquileres/server/alquileres-pg";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await getTenantSupabaseFromAuth(request);
    if (!ctx) return NextResponse.json(errorResponse(API_ERRORS.UNAUTHORIZED), { status: 401 });
    const { id } = await params;
    const schema = await fetchDataSchemaForEmpresaId(ctx.auth.empresa_id);
    const alquiler = await getAlquilerById(schema, ctx.auth.empresa_id, id);
    if (!alquiler) {
      return NextResponse.json(errorResponse("Alquiler no encontrado."), { status: 404 });
    }
    const items = await listAlquilerItems(schema, ctx.auth.empresa_id, id);
    return NextResponse.json(successResponse({ alquiler, items }));
  } catch (err) {
    console.error("[/api/alquileres/:id GET]", err instanceof Error ? err.message : err);
    return NextResponse.json(errorResponse("No se pudo cargar el alquiler."), { status: 500 });
  }
}
