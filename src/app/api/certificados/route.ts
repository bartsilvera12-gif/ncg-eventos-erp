import { NextResponse } from "next/server";
import { getChatServiceClientForEmpresa } from "@/app/api/chat/_chat-service-client";
import { errorResponse, successResponse } from "@/lib/api/response";
import { requireProyectosApiAccess } from "@/lib/proyectos/proyectos-auth";

const CATEGORIAS_OK = new Set([
  "habilitacion", "seguro", "certificado", "licencia",
  "permiso", "contrato", "otro",
]);

export async function GET(request: Request) {
  const auth = await requireProyectosApiAccess(request);
  if (!auth.ok) return NextResponse.json(errorResponse(auth.message), { status: auth.status });

  const sb = await getChatServiceClientForEmpresa(auth.empresaId);
  const { data, error } = await sb
    .from("certificados_empresa")
    .select("*")
    .eq("empresa_id", auth.empresaId)
    .order("fecha_vencimiento", { ascending: true, nullsFirst: false });
  if (error) return NextResponse.json(errorResponse(error.message), { status: 500 });
  return NextResponse.json(successResponse({ certificados: data ?? [] }));
}

export async function POST(request: Request) {
  const auth = await requireProyectosApiAccess(request);
  if (!auth.ok) return NextResponse.json(errorResponse(auth.message), { status: auth.status });

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const nombre = String(body.nombre ?? "").trim();
  if (!nombre)
    return NextResponse.json(errorResponse("El nombre es obligatorio."), { status: 400 });

  const catRaw = String(body.categoria ?? "otro");
  const categoria = CATEGORIAS_OK.has(catRaw) ? catRaw : "otro";

  const sb = await getChatServiceClientForEmpresa(auth.empresaId);
  const { data, error } = await sb
    .from("certificados_empresa")
    .insert({
      empresa_id: auth.empresaId,
      nombre,
      categoria,
      descripcion: typeof body.descripcion === "string" ? body.descripcion : null,
      emitido_por: typeof body.emitido_por === "string" ? body.emitido_por : null,
      numero: typeof body.numero === "string" ? body.numero : null,
      fecha_emision: typeof body.fecha_emision === "string" ? body.fecha_emision : null,
      fecha_vencimiento: typeof body.fecha_vencimiento === "string" ? body.fecha_vencimiento : null,
      alerta_dias_antes:
        typeof body.alerta_dias_antes === "number" && body.alerta_dias_antes > 0
          ? Math.floor(body.alerta_dias_antes)
          : 30,
      storage_path: typeof body.storage_path === "string" ? body.storage_path : null,
      archivo_nombre: typeof body.archivo_nombre === "string" ? body.archivo_nombre : null,
      archivo_mime: typeof body.archivo_mime === "string" ? body.archivo_mime : null,
      archivo_tamano:
        typeof body.archivo_tamano === "number" ? body.archivo_tamano : null,
      observaciones: typeof body.observaciones === "string" ? body.observaciones : null,
      activo: body.activo !== false,
    })
    .select()
    .single();
  if (error) return NextResponse.json(errorResponse(error.message), { status: 500 });
  return NextResponse.json(successResponse({ certificado: data }));
}
