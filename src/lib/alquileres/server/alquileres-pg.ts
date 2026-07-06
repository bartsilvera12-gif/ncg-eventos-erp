/**
 * PG directo para Alquileres (módulo eventos). Mismo patrón que compras-pg /
 * productos-pg: pool singleton + queries parametrizadas + identifier escape.
 *
 * insertAlquiler corre en transacción:
 *   1) inserta cabecera `alquileres` con total provisional 0
 *   2) inserta cada `alquiler_items` con subtotal = cantidad × cantidad_unidades × tarifa_unitaria
 *   3) actualiza total de la cabecera = Σ subtotales
 *
 * Los alquileres NO impactan stock: las unidades vuelven al inventario al
 * finalizar. (Si en el futuro querés bloquear stock, agregar movimiento
 * ASIGNACION/DEVOLUCION acá.)
 */
import { getChatPostgresPool, quoteSchemaTable } from "@/lib/supabase/chat-pg-pool";
import { assertAllowedChatDataSchema } from "@/lib/supabase/chat-data-schema";

function pool() {
  const p = getChatPostgresPool();
  if (!p) throw new Error("Pool no disponible.");
  return p;
}

export interface AlquilerRow {
  id: string;
  empresa_id: string;
  cliente_id: string;
  cliente_nombre?: string | null;
  fecha_inicio: string;
  fecha_fin: string;
  estado: string;
  total: string | number;
  observaciones: string | null;
  created_at: string;
  updated_at: string;
  items_count?: number;
}

export interface AlquilerItemRow {
  id: string;
  alquiler_id: string;
  empresa_id: string;
  producto_id: string;
  producto_nombre: string;
  cantidad: string | number;
  unidad: string;
  cantidad_unidades: string | number;
  tarifa_unitaria: string | number;
  subtotal: string | number;
  created_at: string;
}

export interface InsertAlquilerItemInput {
  producto_id: string;
  producto_nombre: string;
  cantidad: number;
  unidad: "hora" | "dia";
  cantidad_unidades: number;
  tarifa_unitaria: number;
}

export interface InsertAlquilerInput {
  cliente_id: string;
  fecha_inicio: string;
  fecha_fin: string;
  estado?: "reservado" | "activo" | "finalizado" | "anulado";
  observaciones?: string | null;
  items: InsertAlquilerItemInput[];
}

// ── Listado ──────────────────────────────────────────────────────────────────

export async function listAlquileres(
  schemaRaw: string,
  empresaId: string
): Promise<AlquilerRow[]> {
  const schema = assertAllowedChatDataSchema(schemaRaw);
  const tAlq = quoteSchemaTable(schema, "alquileres");
  const tCli = quoteSchemaTable(schema, "clientes");
  const tItems = quoteSchemaTable(schema, "alquiler_items");
  const { rows } = await pool().query<AlquilerRow>(
    `SELECT a.id, a.empresa_id, a.cliente_id,
            COALESCE(NULLIF(c.empresa,''), c.nombre_contacto) AS cliente_nombre,
            a.fecha_inicio, a.fecha_fin, a.estado, a.total, a.observaciones,
            a.created_at, a.updated_at,
            (SELECT count(*) FROM ${tItems} ai WHERE ai.alquiler_id = a.id)::int AS items_count
       FROM ${tAlq} a
       LEFT JOIN ${tCli} c ON c.id = a.cliente_id
      WHERE a.empresa_id = $1::uuid
      ORDER BY a.fecha_inicio DESC
      LIMIT 500`,
    [empresaId]
  );
  return rows;
}

// ── Detalle ──────────────────────────────────────────────────────────────────

export async function getAlquilerById(
  schemaRaw: string,
  empresaId: string,
  alquilerId: string
): Promise<AlquilerRow | null> {
  const schema = assertAllowedChatDataSchema(schemaRaw);
  const tAlq = quoteSchemaTable(schema, "alquileres");
  const tCli = quoteSchemaTable(schema, "clientes");
  const { rows } = await pool().query<AlquilerRow>(
    `SELECT a.id, a.empresa_id, a.cliente_id,
            COALESCE(NULLIF(c.empresa,''), c.nombre_contacto) AS cliente_nombre,
            a.fecha_inicio, a.fecha_fin, a.estado, a.total, a.observaciones,
            a.created_at, a.updated_at
       FROM ${tAlq} a
       LEFT JOIN ${tCli} c ON c.id = a.cliente_id
      WHERE a.id = $1::uuid AND a.empresa_id = $2::uuid
      LIMIT 1`,
    [alquilerId, empresaId]
  );
  return rows[0] ?? null;
}

export async function listAlquilerItems(
  schemaRaw: string,
  empresaId: string,
  alquilerId: string
): Promise<AlquilerItemRow[]> {
  const schema = assertAllowedChatDataSchema(schemaRaw);
  const t = quoteSchemaTable(schema, "alquiler_items");
  const { rows } = await pool().query<AlquilerItemRow>(
    `SELECT id, alquiler_id, empresa_id, producto_id, producto_nombre,
            cantidad, unidad, cantidad_unidades, tarifa_unitaria, subtotal, created_at
       FROM ${t}
      WHERE alquiler_id = $1::uuid AND empresa_id = $2::uuid
      ORDER BY created_at ASC`,
    [alquilerId, empresaId]
  );
  return rows;
}

// ── Insert (transacción) ─────────────────────────────────────────────────────

export interface InsertAlquilerOutput {
  alquiler: AlquilerRow;
  items: AlquilerItemRow[];
}

export async function insertAlquiler(
  schemaRaw: string,
  empresaId: string,
  input: InsertAlquilerInput
): Promise<InsertAlquilerOutput> {
  const schema = assertAllowedChatDataSchema(schemaRaw);
  const tAlq = quoteSchemaTable(schema, "alquileres");
  const tItems = quoteSchemaTable(schema, "alquiler_items");
  const tCli = quoteSchemaTable(schema, "clientes");

  const estado = input.estado ?? "reservado";
  const client = await pool().connect();
  try {
    await client.query("BEGIN");

    const ins = await client.query<{ id: string }>(
      `INSERT INTO ${tAlq}
         (empresa_id, cliente_id, fecha_inicio, fecha_fin, estado, total, observaciones)
       VALUES ($1::uuid, $2::uuid, $3::timestamptz, $4::timestamptz, $5, 0, $6)
       RETURNING id`,
      [
        empresaId,
        input.cliente_id,
        input.fecha_inicio,
        input.fecha_fin,
        estado,
        input.observaciones ?? null,
      ]
    );
    const alquilerId = ins.rows[0].id;

    let total = 0;
    for (const it of input.items) {
      const subtotal = round2(it.cantidad * it.cantidad_unidades * it.tarifa_unitaria);
      total += subtotal;
      await client.query(
        `INSERT INTO ${tItems}
           (empresa_id, alquiler_id, producto_id, producto_nombre,
            cantidad, unidad, cantidad_unidades, tarifa_unitaria, subtotal)
         VALUES ($1::uuid, $2::uuid, $3::uuid, $4, $5, $6, $7, $8, $9)`,
        [
          empresaId,
          alquilerId,
          it.producto_id,
          it.producto_nombre,
          it.cantidad,
          it.unidad,
          it.cantidad_unidades,
          it.tarifa_unitaria,
          subtotal,
        ]
      );
    }
    total = round2(total);

    await client.query(
      `UPDATE ${tAlq}
          SET total = $1, updated_at = now()
        WHERE id = $2::uuid AND empresa_id = $3::uuid`,
      [total, alquilerId, empresaId]
    );

    await client.query("COMMIT");

    // Lectura final con join a clientes (fuera de tx para reusar el pool).
    const cab = await pool().query<AlquilerRow>(
      `SELECT a.id, a.empresa_id, a.cliente_id,
              COALESCE(NULLIF(c.empresa,''), c.nombre_contacto) AS cliente_nombre,
              a.fecha_inicio, a.fecha_fin, a.estado, a.total, a.observaciones,
              a.created_at, a.updated_at
         FROM ${tAlq} a
         LEFT JOIN ${tCli} c ON c.id = a.cliente_id
        WHERE a.id = $1::uuid`,
      [alquilerId]
    );
    const items = await listAlquilerItems(schema, empresaId, alquilerId);
    return { alquiler: cab.rows[0], items };
  } catch (e) {
    await client.query("ROLLBACK").catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}

// ── Recupero por producto ────────────────────────────────────────────────────

export interface RecuperoRow {
  producto_id: string;
  costo_total_invertido: string | number;
  ingreso_real_alquiler: string | number;
  porcentaje_recuperado: string | number;
  monto_faltante: string | number;
}

export async function getRecuperoProducto(
  schemaRaw: string,
  productoId: string
): Promise<RecuperoRow | null> {
  const schema = assertAllowedChatDataSchema(schemaRaw);
  // La función vive en el schema del tenant. Comilla manual segura porque
  // assertAllowedChatDataSchema valida contra allowlist.
  const fn = `"${schema}".recupero_producto`;
  const { rows } = await pool().query<RecuperoRow>(
    `SELECT * FROM ${fn}($1::uuid)`,
    [productoId]
  );
  return rows[0] ?? null;
}

// ── Actualizar estado ────────────────────────────────────────────────────────

export async function updateAlquilerEstado(
  schemaRaw: string,
  empresaId: string,
  alquilerId: string,
  estado: "reservado" | "activo" | "finalizado" | "anulado"
): Promise<void> {
  const schema = assertAllowedChatDataSchema(schemaRaw);
  const t = quoteSchemaTable(schema, "alquileres");
  await pool().query(
    `UPDATE ${t} SET estado = $1, updated_at = now()
      WHERE id = $2::uuid AND empresa_id = $3::uuid`,
    [estado, alquilerId, empresaId]
  );
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
