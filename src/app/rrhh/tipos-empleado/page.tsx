"use client";

/**
 * RRHH · Asignación de tipo de empleado
 *
 * La tabla muestra TODOS los empleados activos de la empresa. A cada uno se
 * le asigna su tipo (uno o varios roles). La asignación se guarda en la
 * tabla independiente `asignaciones_tipo_empleado`, vinculada por
 * empleado_id. Si todavía no existe asignación para un empleado, la fila
 * sigue apareciendo pero con "— Sin asignar —".
 *
 * No hay "+ Crear" porque las filas son los empleados; lo único que se
 * gestiona acá es la asignación de tipo.
 */

import { useEffect, useMemo, useState } from "react";
import PageHeader from "@/components/ui/PageHeader";
import { fetchWithSupabaseSession } from "@/lib/api/fetch-with-supabase-session";

const TIPOS_DISPONIBLES = [
  { value: "obrero",        label: "Obrero" },
  { value: "capataz",       label: "Capataz / Jefe de obra" },
  { value: "jornalero",     label: "Jornalero" },
  { value: "soldador",      label: "Soldador" },
  { value: "montador",      label: "Montador" },
  { value: "tecnico",       label: "Técnico" },
  { value: "administrador", label: "Administrador" },
  { value: "vendedor",      label: "Vendedor" },
  { value: "cobrador",      label: "Cobrador" },
  { value: "chofer",        label: "Chofer" },
] as const;

const TIPOS_LABEL = Object.fromEntries(TIPOS_DISPONIBLES.map((t) => [t.value, t.label]));

interface Empleado {
  id: string;
  nombre: string;
  cargo: string | null;
  activo: boolean;
}

interface Asignacion {
  id: string;
  codigo: number;
  descripcion: string;
  empleado_id: string | null;
  tipos: string[] | null;
  seccion: string | null;
  sucursal: string | null;
  activo: boolean;
  chofer_habilitacion: string | null;
  chofer_fecha_venc: string | null;
  chofer_km: number | null;
  chofer_observacion: string | null;
  created_at: string;
  updated_at: string;
  created_by_nombre: string | null;
  updated_by_nombre: string | null;
}

/** Fila de la tabla: empleado + su asignación (si existe). */
interface Fila {
  empleado: Empleado;
  asignacion: Asignacion | null;
}

const inputClass =
  "w-full border border-slate-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-[#0EA5E9] focus:outline-none bg-white text-sm";
const labelClass = "block text-xs font-medium text-slate-600 mb-1.5";

export default function AsignacionesTipoEmpleadoPage() {
  const [empleados, setEmpleados] = useState<Empleado[]>([]);
  const [asignaciones, setAsignaciones] = useState<Asignacion[]>([]);
  const [busqueda, setBusqueda] = useState("");
  const [loading, setLoading] = useState(true);
  const [editando, setEditando] = useState<Fila | null>(null);
  const [creandoLibre, setCreandoLibre] = useState(false);

  async function cargar() {
    setLoading(true);
    try {
      const [rE, rA] = await Promise.all([
        fetchWithSupabaseSession("/api/rrhh/empleados", { cache: "no-store" }),
        fetchWithSupabaseSession("/api/rrhh/asignaciones-tipo", { cache: "no-store" }),
      ]);
      const jE = await rE.json();
      const jA = await rA.json();
      if (jE.success) setEmpleados(jE.data.empleados ?? []);
      if (jA.success) setAsignaciones(jA.data.asignaciones ?? []);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { void cargar(); }, []);

  /** Une cada empleado con su asignación (si existe). */
  const filas = useMemo<Fila[]>(() => {
    const porEmpleado = new Map<string, Asignacion>();
    for (const a of asignaciones) {
      if (a.empleado_id) porEmpleado.set(a.empleado_id, a);
    }
    return empleados.map((e) => ({ empleado: e, asignacion: porEmpleado.get(e.id) ?? null }));
  }, [empleados, asignaciones]);

  const filtradas = useMemo(() => {
    const t = busqueda.trim().toLowerCase();
    if (!t) return filas;
    return filas.filter(
      (f) =>
        f.empleado.nombre.toLowerCase().includes(t) ||
        (f.empleado.cargo ?? "").toLowerCase().includes(t) ||
        (f.asignacion?.tipos ?? []).some((tp) => (TIPOS_LABEL[tp] ?? tp).toLowerCase().includes(t)),
    );
  }, [filas, busqueda]);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="NCG · Personal"
        title="Asignación de tipo de empleado"
        description="Definí qué rol cumple cada empleado en la operación (obra, comercial, administración, conducción). Una misma persona puede tener más de un tipo."
        backHref="/rrhh"
        backLabel="Recursos Humanos"
      />

      <div className="bg-white border border-slate-200 rounded-xl shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-3">
          <div className="flex items-center gap-2 flex-1 min-w-[240px] max-w-md">
            <input
              type="text"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar por nombre, cargo o tipo…"
              className={inputClass}
            />
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-500">
              {filtradas.length} de {empleados.length} empleados
            </span>
            <button
              type="button"
              onClick={() => setCreandoLibre(true)}
              className="rounded-lg bg-[#104A4E] px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-[#0d3d40]"
            >
              + Crear
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-left text-sm">
            <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-5 py-3">Empleado</th>
                <th className="px-5 py-3">Tipos asignados</th>
                <th className="px-5 py-3">Sección / Sucursal</th>
                <th className="px-5 py-3">Última modificación</th>
                <th className="px-5 py-3 text-right">Acción</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={5} className="px-5 py-8 text-center text-slate-400">Cargando…</td></tr>
              ) : filtradas.length === 0 ? (
                <tr><td colSpan={5} className="px-5 py-8 text-center text-slate-400">
                  {empleados.length === 0
                    ? "Todavía no hay empleados. Cargá primero el alta en /rrhh/empleados."
                    : "Sin resultados."}
                </td></tr>
              ) : (
                filtradas.map((f) => (
                  <tr key={f.empleado.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/50">
                    <td className="px-5 py-3">
                      <div className="font-medium text-slate-800">{f.empleado.nombre}</div>
                      {f.empleado.cargo && (
                        <div className="text-xs text-slate-400">{f.empleado.cargo}</div>
                      )}
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex flex-wrap gap-1.5">
                        {!f.asignacion || (f.asignacion.tipos ?? []).length === 0 ? (
                          <span className="text-xs text-slate-400">— Sin asignar —</span>
                        ) : (
                          (f.asignacion.tipos ?? []).map((t) => (
                            <span key={t} className="rounded-full bg-[#E4F5F4] px-2.5 py-0.5 text-[11px] font-medium text-[#104A4E]">
                              {TIPOS_LABEL[t] ?? t}
                            </span>
                          ))
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-3 text-xs text-slate-600">
                      {[f.asignacion?.seccion, f.asignacion?.sucursal].filter(Boolean).join(" · ") || "—"}
                    </td>
                    <td className="px-5 py-3 text-xs text-slate-500 tabular-nums">
                      {f.asignacion
                        ? new Date(f.asignacion.updated_at).toLocaleDateString("es-PY")
                        : "—"}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => setEditando(f)}
                        className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:border-[#4FAEB2] hover:text-[#104A4E]"
                      >
                        {f.asignacion ? "Editar" : "Asignar"}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {editando && (
        <FormModal
          empleado={editando.empleado}
          asignacion={editando.asignacion}
          onClose={() => setEditando(null)}
          onSaved={() => { setEditando(null); void cargar(); }}
        />
      )}
      {creandoLibre && (
        <FormModal
          empleado={null}
          asignacion={null}
          onClose={() => setCreandoLibre(false)}
          onSaved={() => { setCreandoLibre(false); void cargar(); }}
        />
      )}
    </div>
  );
}

// ── Modal de asignación / edición ──────────────────────────────────────────────

function FormModal({
  empleado,
  asignacion,
  onClose,
  onSaved,
}: {
  empleado: Empleado | null;
  asignacion: Asignacion | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const esEdicion = asignacion !== null;
  const esCreacionLibre = empleado === null && asignacion === null;
  const [descripcion, setDescripcion] = useState(asignacion?.descripcion ?? "");
  const [form, setForm] = useState(() => ({
    seccion: asignacion?.seccion ?? "",
    sucursal: asignacion?.sucursal ?? "",
    activo: asignacion?.activo ?? true,
    tipos: new Set<string>(asignacion?.tipos ?? []),
    chofer_habilitacion: asignacion?.chofer_habilitacion ?? "",
    chofer_fecha_venc: asignacion?.chofer_fecha_venc ?? "",
    chofer_km: asignacion?.chofer_km != null ? String(asignacion.chofer_km) : "",
    chofer_observacion: asignacion?.chofer_observacion ?? "",
  }));
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const tieneChofer = form.tipos.has("chofer");

  function toggleTipo(value: string) {
    setForm((p) => {
      const next = new Set(p.tipos);
      if (next.has(value)) next.delete(value);
      else next.add(value);
      return { ...p, tipos: next };
    });
  }

  async function guardar() {
    setError(null);
    const desc = esCreacionLibre ? descripcion.trim() : empleado?.nombre ?? "";
    if (!desc) {
      setError("La descripción es obligatoria.");
      return;
    }
    setGuardando(true);
    try {
      const payload: Record<string, unknown> = {
        descripcion: desc,
        empleado_id: empleado?.id ?? null,
        seccion: form.seccion.trim() || null,
        sucursal: form.sucursal.trim() || null,
        activo: form.activo,
        tipos: Array.from(form.tipos),
        chofer_habilitacion: tieneChofer ? form.chofer_habilitacion.trim() || null : null,
        chofer_fecha_venc:   tieneChofer ? form.chofer_fecha_venc || null : null,
        chofer_km:           tieneChofer && form.chofer_km ? Number(form.chofer_km) : 0,
        chofer_observacion:  tieneChofer ? form.chofer_observacion.trim() || null : null,
      };
      const url = esEdicion
        ? `/api/rrhh/asignaciones-tipo/${asignacion!.id}`
        : "/api/rrhh/asignaciones-tipo";
      const r = await fetchWithSupabaseSession(url, {
        method: esEdicion ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const j = await r.json();
      if (!r.ok || !j.success) {
        setError(j.error ?? `Error ${r.status}`);
        return;
      }
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error de red");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
      <div className="w-full max-w-3xl rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              {esEdicion
                ? `Editar asignación · Código ${asignacion!.codigo}`
                : esCreacionLibre
                  ? "Nueva asignación"
                  : "Asignar tipo"}
            </p>
            <h2 className="text-lg font-semibold text-slate-900">
              {esCreacionLibre ? "Crear asignación de tipo" : empleado?.nombre}
            </h2>
            {empleado?.cargo && <p className="text-xs text-slate-400">{empleado.cargo}</p>}
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600" aria-label="Cerrar">✕</button>
        </div>

        <div className="max-h-[70vh] space-y-6 overflow-y-auto px-6 py-5">
          {/* Descripción libre (sólo al crear sin empleado vinculado) */}
          {esCreacionLibre && (
            <section className="space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-widest text-slate-400">Datos</h3>
              <div>
                <label className={labelClass}>Descripción <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  value={descripcion}
                  onChange={(e) => setDescripcion(e.target.value)}
                  placeholder="Ej: Juan Pérez — Capataz externo"
                  className={inputClass}
                />
                <p className="mt-1 text-[11px] text-slate-400">
                  Para asignar a un empleado ya cargado, cerrá este modal y tocá &quot;Asignar&quot; en su fila.
                </p>
              </div>
            </section>
          )}

          {/* Sección/Sucursal */}
          <section className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-widest text-slate-400">Asignación</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Sección</label>
                <input
                  type="text"
                  value={form.seccion}
                  onChange={(e) => setForm((p) => ({ ...p, seccion: e.target.value }))}
                  placeholder="Ej: Producción / Administración"
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>Sucursal / Obra</label>
                <input
                  type="text"
                  value={form.sucursal}
                  onChange={(e) => setForm((p) => ({ ...p, sucursal: e.target.value }))}
                  placeholder="Ej: Casa Central / Obra Pérez"
                  className={inputClass}
                />
              </div>
            </div>
            <label className="inline-flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={!form.activo}
                onChange={(e) => setForm((p) => ({ ...p, activo: !e.target.checked }))}
                className="h-4 w-4 rounded border-slate-300 text-[#104A4E] focus:ring-[#4FAEB2]"
              />
              ¿Asignación inactiva?
            </label>
          </section>

          {/* Tipos */}
          <section className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-widest text-slate-400">Tipos</h3>
            <p className="text-xs text-slate-500">Marcá todos los roles que cumple.</p>
            <div className="overflow-hidden rounded-lg border border-slate-200">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="w-12 px-4 py-2 text-center">Ind.</th>
                    <th className="px-4 py-2 text-left">Descripción</th>
                  </tr>
                </thead>
                <tbody>
                  {TIPOS_DISPONIBLES.map((t) => (
                    <tr key={t.value} className="border-t border-slate-100">
                      <td className="px-4 py-2 text-center">
                        <input
                          type="checkbox"
                          checked={form.tipos.has(t.value)}
                          onChange={() => toggleTipo(t.value)}
                          className="h-4 w-4 rounded border-slate-300 text-[#104A4E] focus:ring-[#4FAEB2]"
                        />
                      </td>
                      <td className="px-4 py-2 text-slate-700">{t.label}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {tieneChofer && (
            <section className="space-y-3 rounded-lg border border-amber-200 bg-amber-50/30 p-4">
              <h3 className="text-xs font-semibold uppercase tracking-widest text-amber-700">Datos de Chofer</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Habilitación N°</label>
                  <input
                    type="text"
                    value={form.chofer_habilitacion}
                    onChange={(e) => setForm((p) => ({ ...p, chofer_habilitacion: e.target.value }))}
                    placeholder="Ej: B-12345678"
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>Fecha de vencimiento</label>
                  <input
                    type="date"
                    value={form.chofer_fecha_venc}
                    onChange={(e) => setForm((p) => ({ ...p, chofer_fecha_venc: e.target.value }))}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>Kilómetros acumulados</label>
                  <input
                    type="number"
                    min={0}
                    value={form.chofer_km}
                    onChange={(e) => setForm((p) => ({ ...p, chofer_km: e.target.value }))}
                    placeholder="Ej: 25400"
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>Observación</label>
                  <input
                    type="text"
                    value={form.chofer_observacion}
                    onChange={(e) => setForm((p) => ({ ...p, chofer_observacion: e.target.value }))}
                    placeholder="Notas internas"
                    className={inputClass}
                  />
                </div>
              </div>
            </section>
          )}

          {esEdicion && (
            <section className="space-y-2 border-t border-slate-100 pt-4">
              <h3 className="text-xs font-semibold uppercase tracking-widest text-slate-400">Auditoría</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-slate-600">
                <div>
                  <p className="font-semibold text-slate-500">Registrado por</p>
                  <p>{asignacion!.created_by_nombre || "—"}</p>
                  <p className="text-slate-400">{new Date(asignacion!.created_at).toLocaleString("es-PY")}</p>
                </div>
                <div>
                  <p className="font-semibold text-slate-500">Modificado por</p>
                  <p>{asignacion!.updated_by_nombre || "—"}</p>
                  <p className="text-slate-400">{new Date(asignacion!.updated_at).toLocaleString("es-PY")}</p>
                </div>
              </div>
            </section>
          )}

          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {error}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-slate-100 bg-slate-50/50 px-6 py-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={guardar}
            disabled={guardando}
            className="rounded-lg bg-[#104A4E] px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-[#0d3d40] disabled:opacity-50"
          >
            {guardando ? "Guardando…" : esEdicion ? "Aplicar cambios" : "Asignar"}
          </button>
        </div>
      </div>
    </div>
  );
}
