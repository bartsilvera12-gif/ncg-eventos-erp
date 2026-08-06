import { NextResponse } from "next/server";
import { getChatServiceClientForEmpresa } from "@/app/api/chat/_chat-service-client";
import { errorResponse, successResponse } from "@/lib/api/response";
import { requireProyectosApiAccess } from "@/lib/proyectos/proyectos-auth";

const TIPOS_OK = new Set(["salon", "jardin", "terraza", "escenario", "otro"]);

export async function GET(request: Request) {
  const auth = await requireProyectosApiAccess(request);
  if (!auth.ok) return NextResponse.json(errorResponse(auth.message), { status: auth.status });

  const sb = await getChatServiceClientForEmpresa(auth.empresaId);
  const { data, error } = await sb
    .from("recursos")
    .select("*")
    .eq("empresa_id", auth.empresaId)
    .order("nombre", { ascending: true });
  if (error) return NextResponse.json(errorResponse(error.message), { status: 500 });
  return NextResponse.json(successResponse({ recursos: data ?? [] }));
}

export async function POST(request: Request) {
  const auth = await requireProyectosApiAccess(request);
  if (!auth.ok) return NextResponse.json(errorResponse(auth.message), { status: auth.status });

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const nombre = String(body.nombre ?? "").trim();
  if (!nombre) return NextResponse.json(errorResponse("El nombre es obligatorio."), { status: 400 });

  const tipoRaw = String(body.tipo ?? "salon");
  const tipo = TIPOS_OK.has(tipoRaw) ? tipoRaw : "salon";
  const capacidad =
    typeof body.capacidad === "number" && body.capacidad > 0
      ? Math.floor(body.capacidad)
      : null;

  const sb = await getChatServiceClientForEmpresa(auth.empresaId);
  const { data, error } = await sb
    .from("recursos")
    .insert({
      empresa_id: auth.empresaId,
      nombre,
      tipo,
      capacidad,
      descripcion: typeof body.descripcion === "string" ? body.descripcion : null,
      activo: body.activo !== false,
    })
    .select()
    .single();
  if (error) return NextResponse.json(errorResponse(error.message), { status: 500 });
  return NextResponse.json(successResponse({ recurso: data }));
}
