import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Instancia dedicada monocliente (NCG Cubiertas de Estructura Ligera).
 * Schema Ãºnico Postgres para catÃ¡logo + datos operativos.
 * Override opcional vÃ­a NEURA_CLIENT_SCHEMA si se reusa el repo para otro cliente.
 */
export const NEURA_CLIENT_SCHEMA: string =
  (typeof process !== "undefined" && process.env.NEURA_CLIENT_SCHEMA?.trim()) || "ncgconstructora";

/**
 * Schema Postgres principal de la app.
 * En instancia dedicada equivale a NEURA_CLIENT_SCHEMA.
 * Requiere en Supabase: Settings â†’ API â†’ "Exposed schemas" incluir este schema.
 */
export const SUPABASE_APP_SCHEMA: string = NEURA_CLIENT_SCHEMA;

/**
 * ResoluciÃ³n de schema operativo por empresa.
 * En instancia dedicada monocliente siempre devuelve el schema Ãºnico; el argumento se ignora.
 * Se mantiene la firma para compatibilidad con callers existentes.
 */
export function resolveEmpresaDataSchema(_dataSchema?: string | null): string {
  return NEURA_CLIENT_SCHEMA;
}

/**
 * Cliente Supabase con cualquier esquema PostgREST.
 * Con @supabase/supabase-js â‰¥2.99 los genÃ©ricos de `SupabaseClient` son varios y condicionales;
 * acotar alguno a `string` o `"public"` rompe la asignaciÃ³n entre instancias (p. ej. Vercel TS).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AppSupabaseClient = SupabaseClient<any, any, any, any, any>;

export const supabaseDbSchemaOption = {
  db: { schema: SUPABASE_APP_SCHEMA },
} as const;

/** Cliente service role estÃ¡ndar (API routes, webhooks, jobs). */
export const supabaseServiceRoleClientOptions = {
  auth: { autoRefreshToken: false, persistSession: false },
  ...supabaseDbSchemaOption,
} as const;
