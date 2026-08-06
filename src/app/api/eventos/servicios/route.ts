import { NextResponse } from "next/server";
import { getChatServiceClientForEmpresa } from "@/app/api/chat/_chat-service-client";
import { errorResponse, successResponse } from "@/lib/api/response";
import { requireProyectosApiAccess } from "@/lib/proyectos/proyectos-auth";

const CATEGORIAS_OK = new Set([
  "catering", "decoracion", "musica", "fotografia", "animacion",
  "mobiliario", "iluminacion", "seguridad", "transporte", "extra",
]);

export async function GET(request: Request) {
  const auth = await requireProyectosApiAccess(request);
  if (!auth.ok) return NextResponse.json(errorResponse(auth.message), { status: auth.status });

  const sp = new URL(request.url).searchParams;
  const categoria = sp.get("categoria");
  const sb = await getChatServiceClientForEmpresa(auth.empresaId);
  let q = sb.from("servicios_catalogo").select("*").eq("empresa_id", auth.empresaId).order("nombre");
  if (categoria && CATEGORIAS_OK.has(categoria)) q = q.eq("categoria", categoria);
  const { data, error } = await q;
  if (error) return NextResponse.json(errorResponse(error.message), { status: 500 });
  return NextResponse.json(successResponse({ servicios: data ?? [] }));
}

export async function POST(request: Request) {
  const auth = await requireProyectosApiAccess(request);
  if (!auth.ok) return NextResponse.json(errorResponse(auth.message), { status: auth.status });

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const nombre = String(body.nombre ?? "").trim();
  if (!nombre) return NextResponse.json(errorResponse("El nombre es obligatorio."), { status: 400 });
  const categoriaRaw = String(body.categoria ?? "extra");
  const categoria = CATEGORIAS_OK.has(categoriaRaw) ? categoriaRaw : "extra";

  const sb = await getChatServiceClientForEmpresa(auth.empresaId);
  const { data, error } = await sb
    .from("servicios_catalogo")
    .insert({
      empresa_id: auth.empresaId,
      nombre,
      categoria,
      descripcion: typeof body.descripcion === "string" ? body.descripcion : null,
      precio_base: typeof body.precio_base === "number" ? body.precio_base : 0,
      unidad: typeof body.unidad === "string" ? body.unidad : "unidad",
      activo: body.activo !== false,
    })
    .select()
    .single();
  if (error) return NextResponse.json(errorResponse(error.message), { status: 500 });
  return NextResponse.json(successResponse({ servicio: data }));
}
