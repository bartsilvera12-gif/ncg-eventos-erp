/**
 * Catálogo de tipos de empleado (roles operativos).
 *
 * NCG construye su propia lista editable por empresa. Las semillas iniciales
 * (Obrero, Capataz, etc.) se insertan al primer acceso si no existen para
 * la empresa.
 */

import type { AppSupabaseClient } from "@/lib/supabase/schema";

export interface TipoEmpleadoRow {
  id: string;
  empresa_id: string;
  slug: string;
  nombre: string;
  activo: boolean;
  orden: number;
  es_sistema: boolean;
  created_at: string;
  updated_at: string;
}

const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const MAX_SLUG = 64;

const SEED_ROWS: { slug: string; nombre: string; orden: number }[] = [
  { slug: "obrero",        nombre: "Obrero",                 orden: 10 },
  { slug: "capataz",       nombre: "Capataz / Jefe de obra", orden: 20 },
  { slug: "jornalero",     nombre: "Jornalero",              orden: 30 },
  { slug: "soldador",      nombre: "Soldador",               orden: 40 },
  { slug: "montador",      nombre: "Montador",               orden: 50 },
  { slug: "tecnico",       nombre: "Técnico",                orden: 60 },
  { slug: "administrador", nombre: "Administrador",          orden: 70 },
  { slug: "vendedor",      nombre: "Vendedor",               orden: 80 },
  { slug: "cobrador",      nombre: "Cobrador",               orden: 90 },
  { slug: "chofer",        nombre: "Chofer",                 orden: 100 },
];

export const SLUGS_SISTEMA = SEED_ROWS.map((r) => r.slug);

const SEMILLAS_CACHE = new Map<string, number>();
const SEMILLAS_TTL_MS = 10 * 60 * 1000;

/** Asegura las semillas del catálogo para una empresa. Memoizada 10 min. */
export async function ensureSemillasTiposEmpleado(
  supabase: AppSupabaseClient,
  empresaId: string,
): Promise<void> {
  const cachedAt = SEMILLAS_CACHE.get(empresaId);
  const now = Date.now();
  if (cachedAt && now - cachedAt < SEMILLAS_TTL_MS) return;

  const { data: present, error } = await supabase
    .from("tipos_empleado_catalogo")
    .select("slug")
    .eq("empresa_id", empresaId)
    .in("slug", SLUGS_SISTEMA);
  if (error) {
    console.error("[tipos_empleado_catalogo] ensureSemillas", error.message);
    return;
  }
  const have = new Set((present ?? []).map((r: { slug: string }) => r.slug));
  for (const r of SEED_ROWS) {
    if (have.has(r.slug)) continue;
    const { error: eIns } = await supabase.from("tipos_empleado_catalogo").insert({
      empresa_id: empresaId,
      slug: r.slug,
      nombre: r.nombre,
      activo: true,
      es_sistema: true,
      orden: r.orden,
    });
    if (eIns) {
      const m = eIns.message.toLowerCase();
      if (m.includes("unique") || m.includes("duplicate")) {
        have.add(r.slug);
        continue;
      }
      console.error("[tipos_empleado_catalogo] insert", r.slug, eIns.message);
    } else {
      have.add(r.slug);
    }
  }
  SEMILLAS_CACHE.set(empresaId, now);
}

export function generarSlugDesdeNombre(nombre: string, existentes: Set<string>): string {
  const n = nombre
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, MAX_SLUG);
  let base = n || "tipo";
  if (!SLUG_RE.test(base)) base = "tipo";
  let candidato = base;
  let k = 2;
  while (existentes.has(candidato) && k < 5000) {
    candidato = `${base}-${k++}`.slice(0, MAX_SLUG);
  }
  return candidato;
}

export function normalizeSlug(s: string): string {
  return String(s ?? "").trim().toLowerCase();
}
