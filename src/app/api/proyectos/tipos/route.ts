import { NextResponse } from "next/server";
import { getChatServiceClientForEmpresa } from "@/app/api/chat/_chat-service-client";
import { errorResponse, successResponse } from "@/lib/api/response";
import { requireProyectosApiAccess } from "@/lib/proyectos/proyectos-auth";

function slugify(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 32);
}

/** Lista tipos de proyecto del tenant (incluye inactivos, para configuración). */
export async function GET(request: Request) {
  const auth = await requireProyectosApiAccess(request);
  if (!auth.ok) return NextResponse.json(errorResponse(auth.message), { status: auth.status });

  try {
    const sb = await getChatServiceClientForEmpresa(auth.empresaId);
    const sp = new URL(request.url).searchParams;
    const incluirInactivos = sp.get("incluir_inactivos") === "1";

    let q = sb
      .from("proyecto_tipos")
      .select("id, nombre, codigo, descripcion, activo")
      .eq("empresa_id", auth.empresaId)
      .order("nombre", { ascending: true });
    if (!incluirInactivos) q = q.eq("activo", true);

    const { data, error } = await q;
    if (error) return NextResponse.json(errorResponse(error.message), { status: 400 });
    return NextResponse.json(successResponse(data ?? []));
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error";
    return NextResponse.json(errorResponse(msg), { status: 500 });
  }
}

/** Crea un tipo de proyecto. Body: { nombre, descripcion?, codigo? } */
export async function POST(request: Request) {
  const auth = await requireProyectosApiAccess(request);
  if (!auth.ok) return NextResponse.json(errorResponse(auth.message), { status: auth.status });

  try {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const nombre = String(body.nombre ?? "").trim();
    if (!nombre) return NextResponse.json(errorResponse("Falta nombre"), { status: 400 });
    const codigo = body.codigo ? slugify(String(body.codigo)) : slugify(nombre);
    if (!codigo) return NextResponse.json(errorResponse("Código inválido"), { status: 400 });

    const sb = await getChatServiceClientForEmpresa(auth.empresaId);
    const { data, error } = await sb
      .from("proyecto_tipos")
      .insert([{
        empresa_id: auth.empresaId,
        nombre,
        codigo,
        descripcion: body.descripcion ? String(body.descripcion).trim() : null,
        activo: true,
      }])
      .select("id, nombre, codigo, descripcion, activo")
      .single();
    if (error) return NextResponse.json(errorResponse(error.message), { status: 400 });
    return NextResponse.json(successResponse(data));
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error";
    return NextResponse.json(errorResponse(msg), { status: 500 });
  }
}
