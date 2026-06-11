import { NextRequest, NextResponse } from "next/server";
import { getTenantSupabaseFromAuth } from "@/lib/supabase/tenant-api";
import { successResponse, errorResponse } from "@/lib/api/response";
import { API_ERRORS } from "@/lib/api/errors";

/**
 * GET /api/reportes/personal-por-obra
 *
 * Resumen consolidado de mano de obra por obra:
 *   - Total horas y costo MO por obra
 *   - Detalle por empleado dentro de cada obra
 */
function num(v: unknown): number {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
}

export async function GET(request: NextRequest) {
  try {
    const ctx = await getTenantSupabaseFromAuth(request);
    if (!ctx) return NextResponse.json(errorResponse(API_ERRORS.UNAUTHORIZED), { status: 401 });
    const empresaId = ctx.auth.empresa_id;

    const { data, error } = await ctx.supabase
      .from("empleado_asignaciones")
      .select("empleado_id, proyecto_id, horas, costo_total, empleados:empleado_id(nombre, cargo), proyectos:proyecto_id(titulo)")
      .eq("empresa_id", empresaId);

    if (error) return NextResponse.json(errorResponse(error.message), { status: 400 });

    type Det = { empleado_nombre: string; empleado_cargo: string | null; horas: number; costo: number };
    type Obra = { proyecto_id: string; titulo: string; total_horas: number; total_costo: number; empleados: Map<string, Det> };

    const porObra = new Map<string, Obra>();

    for (const r of (data ?? []) as Array<Record<string, unknown>>) {
      const proyId = r.proyecto_id as string;
      const empId = r.empleado_id as string;
      const hs = num(r.horas);
      const cs = num(r.costo_total);
      const proyectos = r.proyectos as { titulo?: string } | { titulo?: string }[] | null;
      const proy = Array.isArray(proyectos) ? proyectos[0] : proyectos;
      const empleados = r.empleados as { nombre?: string; cargo?: string | null } | { nombre?: string; cargo?: string | null }[] | null;
      const emp = Array.isArray(empleados) ? empleados[0] : empleados;

      let obra = porObra.get(proyId);
      if (!obra) {
        obra = {
          proyecto_id: proyId,
          titulo: proy?.titulo ?? "Obra sin nombre",
          total_horas: 0,
          total_costo: 0,
          empleados: new Map(),
        };
        porObra.set(proyId, obra);
      }
      obra.total_horas += hs;
      obra.total_costo += cs;

      const detExistente = obra.empleados.get(empId);
      if (detExistente) {
        detExistente.horas += hs;
        detExistente.costo += cs;
      } else {
        obra.empleados.set(empId, {
          empleado_nombre: emp?.nombre ?? "Empleado sin nombre",
          empleado_cargo: emp?.cargo ?? null,
          horas: hs,
          costo: cs,
        });
      }
    }

    const obras = Array.from(porObra.values()).map((o) => ({
      proyecto_id: o.proyecto_id,
      titulo: o.titulo,
      total_horas: o.total_horas,
      total_costo: o.total_costo,
      empleados: Array.from(o.empleados.values())
        .sort((a, b) => b.costo - a.costo),
    })).sort((a, b) => b.total_costo - a.total_costo);

    const totales = obras.reduce(
      (acc, o) => ({ horas: acc.horas + o.total_horas, costo: acc.costo + o.total_costo }),
      { horas: 0, costo: 0 }
    );

    return NextResponse.json(successResponse({ obras, totales, cantidad: obras.length }));
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error";
    return NextResponse.json(errorResponse(msg), { status: 500 });
  }
}
