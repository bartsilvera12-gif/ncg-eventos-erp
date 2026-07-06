import { NextRequest, NextResponse } from "next/server";
import { getTenantSupabaseFromAuth } from "@/lib/supabase/tenant-api";
import { fetchDataSchemaForEmpresaId } from "@/lib/supabase/empresa-data-schema";
import { successResponse, errorResponse } from "@/lib/api/response";
import { API_ERRORS } from "@/lib/api/errors";
import {
  listAlquileres,
  insertAlquiler,
  type InsertAlquilerItemInput,
} from "@/lib/alquileres/server/alquileres-pg";

const ESTADOS_OK = ["reservado", "activo", "finalizado", "anulado"] as const;
const UNIDADES_OK = ["hora", "dia"] as const;

function parseItems(raw: unknown): InsertAlquilerItemInput[] | string {
  if (!Array.isArray(raw) || raw.length === 0) return "Agregá al menos un producto al alquiler.";
  const out: InsertAlquilerItemInput[] = [];
  for (const x of raw) {
    if (!x || typeof x !== "object") return "Línea de alquiler inválida.";
    const r = x as Record<string, unknown>;
    const producto_id = String(r.producto_id ?? "").trim();
    if (!producto_id) return "Cada línea debe tener un producto.";
    const cantidad = Number(r.cantidad) || 0;
    if (cantidad <= 0) return "La cantidad de cada línea debe ser mayor a 0.";
    const cantidad_unidades = Number(r.cantidad_unidades) || 0;
    if (cantidad_unidades <= 0) return "La duración (horas/días) debe ser mayor a 0.";
    const tarifa_unitaria = Number(r.tarifa_unitaria) || 0;
    if (tarifa_unitaria < 0) return "La tarifa no puede ser negativa.";
    const unidadRaw = String(r.unidad ?? "");
    const unidad = (UNIDADES_OK as readonly string[]).includes(unidadRaw)
      ? (unidadRaw as "hora" | "dia")
      : "dia";
    out.push({
      producto_id,
      producto_nombre: String(r.producto_nombre ?? ""),
      cantidad,
      unidad,
      cantidad_unidades,
      tarifa_unitaria,
    });
  }
  return out;
}

export async function GET(request: NextRequest) {
  try {
    const ctx = await getTenantSupabaseFromAuth(request);
    if (!ctx) return NextResponse.json(errorResponse(API_ERRORS.UNAUTHORIZED), { status: 401 });
    const schema = await fetchDataSchemaForEmpresaId(ctx.auth.empresa_id);
    const rows = await listAlquileres(schema, ctx.auth.empresa_id);
    return NextResponse.json(successResponse({ alquileres: rows }));
  } catch (err) {
    console.error("[/api/alquileres GET]", err instanceof Error ? err.message : err);
    return NextResponse.json(errorResponse("No se pudieron cargar los alquileres."), { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const ctx = await getTenantSupabaseFromAuth(request);
    if (!ctx) return NextResponse.json(errorResponse(API_ERRORS.UNAUTHORIZED), { status: 401 });
    const empresaId = ctx.auth.empresa_id;
    const schema = await fetchDataSchemaForEmpresaId(empresaId);

    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;

    const cliente_id = String(body.cliente_id ?? "").trim();
    if (!cliente_id) {
      return NextResponse.json(errorResponse("Falta el cliente."), { status: 400 });
    }
    const fecha_inicio = String(body.fecha_inicio ?? "").trim();
    const fecha_fin = String(body.fecha_fin ?? "").trim();
    if (!fecha_inicio || !fecha_fin) {
      return NextResponse.json(errorResponse("Faltan las fechas del alquiler."), { status: 400 });
    }
    if (new Date(fecha_fin).getTime() < new Date(fecha_inicio).getTime()) {
      return NextResponse.json(errorResponse("La fecha fin no puede ser anterior al inicio."), { status: 400 });
    }
    const estadoRaw = String(body.estado ?? "reservado");
    const estado = (ESTADOS_OK as readonly string[]).includes(estadoRaw)
      ? (estadoRaw as "reservado" | "activo" | "finalizado" | "anulado")
      : "reservado";

    const itemsParsed = parseItems(body.items);
    if (typeof itemsParsed === "string") {
      return NextResponse.json(errorResponse(itemsParsed), { status: 400 });
    }

    try {
      const out = await insertAlquiler(schema, empresaId, {
        cliente_id,
        fecha_inicio,
        fecha_fin,
        estado,
        observaciones: typeof body.observaciones === "string" ? body.observaciones : null,
        items: itemsParsed,
      });
      return NextResponse.json(successResponse({ alquiler: out.alquiler, items: out.items }));
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      const code = (e as { code?: string })?.code;
      const detail = (e as { detail?: string })?.detail;
      console.error("[/api/alquileres POST]", { schema, empresaId, msg, code, detail });
      if (code === "23503") {
        return NextResponse.json(
          errorResponse("Cliente o producto inválido."),
          { status: 400 }
        );
      }
      if (code === "23514") {
        return NextResponse.json(
          errorResponse(`Restricción de la base no aceptó el valor: ${detail || msg || "ver logs"}`),
          { status: 400 }
        );
      }
      if (code === "42703" || code === "42P01") {
        return NextResponse.json(
          errorResponse(`Tabla o columna inexistente: ${msg}. ¿Corriste la migración de alquileres?`),
          { status: 500 }
        );
      }
      const diag = [code, msg].filter(Boolean).join(" — ");
      return NextResponse.json(
        errorResponse(`No se pudo guardar el alquiler. ${diag || "Revisá los datos."}`),
        { status: 500 }
      );
    }
  } catch (err) {
    console.error("[/api/alquileres POST] outer", err instanceof Error ? err.message : err);
    return NextResponse.json(errorResponse("No se pudo guardar el alquiler."), { status: 500 });
  }
}
