/**
 * Catálogo de departamentos del empleado.
 *
 * Mismo patrón que tipos-empleado-catalogo: seed editable, slug único por
 * empresa, no-sistema borrables, sistema solo desactivables.
 */

import type { AppSupabaseClient } from "@/lib/supabase/schema";

export interface DepartamentoRow {
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
  { slug: "operaciones",    nombre: "Operaciones",    orden: 10 },
  { slug: "administracion", nombre: "Administración", orden: 20 },
  { slug: "comercial",      nombre: "Comercial",      orden: 30 },
  { slug: "tecnico",        nombre: "Técnico",        orden: 40 },
  { slug: "rrhh",           nombre: "RRHH",           orden: 50 },
];

export const SLUGS_SISTEMA = SEED_ROWS.map((r) => r.slug);

const SEMILLAS_CACHE = new Map<string, number>();
const SEMILLAS_TTL_MS = 10 * 60 * 1000;

export async function ensureSemillasDepartamentos(
  supabase: AppSupabaseClient,
  empresaId: string,
): Promise<void> {
  const cachedAt = SEMILLAS_CACHE.get(empresaId);
  const now = Date.now();
  if (cachedAt && now - cachedAt < SEMILLAS_TTL_MS) return;

  const { data: present, error } = await supabase
    .from("departamentos_catalogo")
    .select("slug")
    .eq("empresa_id", empresaId)
    .in("slug", SLUGS_SISTEMA);
  if (error) {
    console.error("[departamentos_catalogo] ensureSemillas", error.message);
    return;
  }
  const have = new Set((present ?? []).map((r: { slug: string }) => r.slug));
  for (const r of SEED_ROWS) {
    if (have.has(r.slug)) continue;
    const { error: eIns } = await supabase.from("departamentos_catalogo").insert({
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
      console.error("[departamentos_catalogo] insert", r.slug, eIns.message);
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
  let base = n || "departamento";
  if (!SLUG_RE.test(base)) base = "departamento";
  let candidato = base;
  let k = 2;
  while (existentes.has(candidato) && k < 5000) {
    candidato = `${base}-${k++}`.slice(0, MAX_SLUG);
  }
  return candidato;
}
