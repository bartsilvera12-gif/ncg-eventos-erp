import { NextRequest, NextResponse } from "next/server";
import { getTenantSupabaseFromAuth } from "@/lib/supabase/tenant-api";
import { successResponse, errorResponse } from "@/lib/api/response";
import { API_ERRORS } from "@/lib/api/errors";

const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await getTenantSupabaseFromAuth(request);
    if (!ctx) return NextResponse.json(errorResponse(API_ERRORS.UNAUTHORIZED), { status: 401 });
    const { id } = await params;
    if (!id || !uuidRe.test(id)) return NextResponse.json(errorResponse("id inválido"), { status: 400 });

    const { data: row, error: errGet } = await ctx.supabase
      .from("departamentos_catalogo")
      .select("id, es_sistema")
      .eq("id", id)
      .eq("empresa_id", ctx.auth.empresa_id)
      .maybeSingle();
    if (errGet || !row) return NextResponse.json(errorResponse("Registro no encontrado"), { status: 404 });

    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };

    if (typeof body.nombre === "string") {
      const n = body.nombre.trim();
      if (!n || n.length > 200) return NextResponse.json(errorResponse("nombre inválido"), { status: 400 });
      patch.nombre = n;
    }
    if (typeof body.activo === "boolean") patch.activo = body.activo;
    if (body.orden !== undefined && body.orden !== null) {
      if (typeof body.orden === "number" && Number.isFinite(body.orden)) {
        patch.orden = Math.max(0, Math.min(32000, Math.trunc(body.orden)));
      } else {
        return NextResponse.json(errorResponse("orden inválido"), { status: 400 });
      }
    }

    const { error } = await ctx.supabase
      .from("departamentos_catalogo")
      .update(patch)
      .eq("id", id)
      .eq("empresa_id", ctx.auth.empresa_id);
    if (error) return NextResponse.json(errorResponse(error.message), { status: 400 });
    return NextResponse.json(successResponse({ ok: true }));
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error";
    return NextResponse.json(errorResponse(msg), { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await getTenantSupabaseFromAuth(_request);
    if (!ctx) return NextResponse.json(errorResponse(API_ERRORS.UNAUTHORIZED), { status: 401 });
    const { id } = await params;
    if (!id || !uuidRe.test(id)) return NextResponse.json(errorResponse("id inválido"), { status: 400 });

    const { data: row, error: errGet } = await ctx.supabase
      .from("departamentos_catalogo")
      .select("id, es_sistema")
      .eq("id", id)
      .eq("empresa_id", ctx.auth.empresa_id)
      .maybeSingle();
    if (errGet || !row) return NextResponse.json(errorResponse("Registro no encontrado"), { status: 404 });
    if ((row as { es_sistema: boolean }).es_sistema) {
      return NextResponse.json(errorResponse("Los departamentos de sistema no se pueden eliminar (desactívalos en su lugar)."), { status: 400 });
    }

    const { error } = await ctx.supabase
      .from("departamentos_catalogo")
      .delete()
      .eq("id", id)
      .eq("empresa_id", ctx.auth.empresa_id);
    if (error) return NextResponse.json(errorResponse(error.message), { status: 400 });
    return NextResponse.json(successResponse({ ok: true }));
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error";
    return NextResponse.json(errorResponse(msg), { status: 500 });
  }
}
