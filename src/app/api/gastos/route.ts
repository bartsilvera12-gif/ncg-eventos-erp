import { NextRequest, NextResponse } from "next/server";
import { getTenantSupabaseFromAuth } from "@/lib/supabase/tenant-api";
import { successResponse, errorResponse } from "@/lib/api/response";
import { API_ERRORS } from "@/lib/api/errors";

/**
 * GET /api/gastos
 * Gastos operativos del tenant (service role).
 */
export async function GET(request: NextRequest) {
  try {
    const ctx = await getTenantSupabaseFromAuth(request);
    if (!ctx) {
      return NextResponse.json(errorResponse(API_ERRORS.UNAUTHORIZED), { status: 401 });
    }
    const { supabase, auth } = ctx;
    const { data, error } = await supabase
      .from("gastos")
      .select("*, proyectos:proyecto_id(titulo)")
      .eq("empresa_id", auth.empresa_id)
      .order("fecha", { ascending: false });

    if (error) {
      return NextResponse.json(errorResponse(error.message), { status: 400 });
    }
    /** Aplana el join PostgREST {proyectos: {titulo}} → proyecto_titulo. */
    const rows = (data ?? []).map((row: Record<string, unknown>) => {
      const p = row.proyectos as { titulo?: string } | { titulo?: string }[] | null | undefined;
      const titulo = Array.isArray(p) ? p[0]?.titulo : p?.titulo;
      return { ...row, proyecto_titulo: titulo ?? null, proyectos: undefined };
    });
    return NextResponse.json(successResponse(rows));
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error";
    return NextResponse.json(errorResponse(msg), { status: 500 });
  }
}
