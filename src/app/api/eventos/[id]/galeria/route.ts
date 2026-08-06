import { NextResponse } from "next/server";
import { getChatServiceClientForEmpresa } from "@/app/api/chat/_chat-service-client";
import { errorResponse, successResponse } from "@/lib/api/response";
import { requireProyectosApiAccess } from "@/lib/proyectos/proyectos-auth";

// GET /api/eventos/:id/galeria — lista fotos del evento (proyecto_archivos con tipo=foto).
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireProyectosApiAccess(request);
  if (!auth.ok) return NextResponse.json(errorResponse(auth.message), { status: auth.status });
  const { id } = await params;
  const sb = await getChatServiceClientForEmpresa(auth.empresaId);

  const { data, error } = await sb
    .from("proyecto_archivos")
    .select("id, nombre, descripcion, storage_bucket, storage_path, mime_type, size_bytes, orden, created_at")
    .eq("empresa_id", auth.empresaId)
    .eq("proyecto_id", id)
    .eq("tipo", "foto")
    .order("orden", { ascending: true })
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json(errorResponse(error.message), { status: 500 });

  // Generar URLs firmadas (5 min) para render inmediato.
  const fotos = await Promise.all(
    (data ?? []).map(async (row) => {
      const r = row as Record<string, unknown>;
      const bucket = String(r.storage_bucket ?? "proyectos");
      const path = String(r.storage_path ?? "");
      let signedUrl: string | null = null;
      if (path) {
        const { data: sig } = await sb.storage.from(bucket).createSignedUrl(path, 300);
        signedUrl = sig?.signedUrl ?? null;
      }
      return { ...r, url: signedUrl };
    })
  );

  return NextResponse.json(successResponse({ fotos }));
}

// POST /api/eventos/:id/galeria — registra metadata de una foto subida.
// El upload físico va contra el bucket 'proyectos' desde el cliente
// (Supabase Storage). Este endpoint solo registra la fila.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireProyectosApiAccess(request);
  if (!auth.ok) return NextResponse.json(errorResponse(auth.message), { status: auth.status });
  const { id: proyectoId } = await params;
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;

  const nombre = String(body.nombre ?? "").trim();
  const storage_path = String(body.storage_path ?? "").trim();
  if (!nombre || !storage_path)
    return NextResponse.json(
      errorResponse("Faltan nombre o path del archivo."),
      { status: 400 }
    );

  const sb = await getChatServiceClientForEmpresa(auth.empresaId);
  const { data, error } = await sb
    .from("proyecto_archivos")
    .insert({
      empresa_id: auth.empresaId,
      proyecto_id: proyectoId,
      nombre,
      descripcion: typeof body.descripcion === "string" ? body.descripcion : null,
      storage_bucket: typeof body.storage_bucket === "string" ? body.storage_bucket : "proyectos",
      storage_path,
      mime_type: typeof body.mime_type === "string" ? body.mime_type : "image/jpeg",
      size_bytes:
        typeof body.size_bytes === "number" ? body.size_bytes : null,
      tipo: "foto",
      orden: typeof body.orden === "number" ? body.orden : 0,
      uploaded_by: auth.usuarioCatalogId,
    })
    .select()
    .single();
  if (error) return NextResponse.json(errorResponse(error.message), { status: 500 });
  return NextResponse.json(successResponse({ foto: data }));
}

// DELETE /api/eventos/:id/galeria?fotoId=... — borra registro (y opcional: archivo).
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireProyectosApiAccess(request);
  if (!auth.ok) return NextResponse.json(errorResponse(auth.message), { status: auth.status });
  const { id: proyectoId } = await params;
  const fotoId = new URL(request.url).searchParams.get("fotoId");
  if (!fotoId) return NextResponse.json(errorResponse("Falta fotoId."), { status: 400 });

  const sb = await getChatServiceClientForEmpresa(auth.empresaId);
  // Leo el path antes de borrar la fila para eliminar el archivo del bucket.
  const { data: row } = await sb
    .from("proyecto_archivos")
    .select("storage_bucket, storage_path")
    .eq("empresa_id", auth.empresaId)
    .eq("proyecto_id", proyectoId)
    .eq("id", fotoId)
    .maybeSingle();

  const { error } = await sb
    .from("proyecto_archivos")
    .delete()
    .eq("empresa_id", auth.empresaId)
    .eq("id", fotoId);
  if (error) return NextResponse.json(errorResponse(error.message), { status: 500 });

  if (row?.storage_path) {
    await sb.storage
      .from(String(row.storage_bucket ?? "proyectos"))
      .remove([String(row.storage_path)])
      .catch(() => {});
  }
  return NextResponse.json(successResponse({ ok: true }));
}
