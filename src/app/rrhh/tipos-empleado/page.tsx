"use client";

/**
 * RRHH · Asignación de tipo de empleado
 *
 * Entidad propia (tabla `asignaciones_tipo_empleado`). No toca `empleados`.
 * Cada asignación tiene:
 *   - descripción (texto libre, ej: nombre del empleado)
 *   - tipos[] (roles operativos)
 *   - sección / sucursal-obra
 *   - estado activo/inactivo
 *   - datos de chofer (sólo si marca tipo "chofer")
 *   - auditoría (creado/modificado por + fechas)
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

const inputClass =
  "w-full border border-slate-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-[#0EA5E9] focus:outline-none bg-white text-sm";
const labelClass = "block text-xs font-medium text-slate-600 mb-1.5";

const FORM_INICIAL = {
  descripcion: "",
  seccion: "",
  sucursal: "",
  activo: true,
  tipos: new Set<string>(),
  chofer_habilitacion: "",
  chofer_fecha_venc: "",
  chofer_km: "",
  chofer_observacion: "",
};

export default function AsignacionesTipoEmpleadoPage() {
  const [lista, setLista] = useState<Asignacion[]>([]);
  const [busqueda, setBusqueda] = useState("");
  const [loading, setLoading] = useState(true);
  const [editando, setEditando] = useState<Asignacion | null>(null);
  const [creando, setCreando] = useState(false);

  async function cargar() {
    setLoading(true);
    try {
      const r = await fetchWithSupabaseSession("/api/rrhh/asignaciones-tipo", { cache: "no-store" });
      const j = await r.json();
      if (j.success) setLista(j.data.asignaciones ?? []);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { void cargar(); }, []);

  const filtradas = useMemo(() => {
    const t = busqueda.trim().toLowerCase();
    if (!t) return lista;
    return lista.filter(
      (a) =>
        a.descripcion.toLowerCase().includes(t) ||
        String(a.codigo).includes(t) ||
        (a.tipos ?? []).some((tp) => (TIPOS_LABEL[tp] ?? tp).toLowerCase().includes(t)),
    );
  }, [lista, busqueda]);

  async function borrar(asig: Asignacion) {
    if (!confirm(`¿Eliminar la asignación de "${asig.descripcion}"?`)) return;
    const r = await fetchWithSupabaseSession(`/api/rrhh/asignaciones-tipo/${asig.id}`, { method: "DELETE" });
    const j = await r.json();
    if (j.success) void cargar();
    else alert(j.error ?? "No se pudo eliminar.");
  }

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
        {/* Barra superior */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-3">
          <div className="flex items-center gap-2 flex-1 min-w-[240px] max-w-md">
            <input
              type="text"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar por código, descripción o tipo…"
              className={inputClass}
            />
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-500">
              {filtradas.length} {filtradas.length === 1 ? "registro" : "registros"}
            </span>
            <button
              type="button"
              onClick={() => setCreando(true)}
              className="rounded-lg bg-[#104A4E] px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-[#0d3d40]"
            >
              + Crear
            </button>
          </div>
        </div>

        {/* Tabla */}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[920px] text-left text-sm">
            <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-5 py-3 w-20">Código</th>
                <th className="px-5 py-3">Descripción</th>
                <th className="px-5 py-3">Tipos</th>
                <th className="px-5 py-3">Estado</th>
                <th className="px-5 py-3">Registrado por</th>
                <th className="px-5 py-3">Modificado el</th>
                <th className="px-5 py-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="px-5 py-8 text-center text-slate-400">Cargando…</td></tr>
              ) : filtradas.length === 0 ? (
                <tr><td colSpan={7} className="px-5 py-8 text-center text-slate-400">
                  Sin asignaciones. Tocá &quot;+ Crear&quot; para registrar la primera.
                </td></tr>
              ) : (
                filtradas.map((a) => (
                  <tr key={a.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/50">
                    <td className="px-5 py-3 tabular-nums text-slate-500">{a.codigo}</td>
                    <td className="px-5 py-3 font-medium text-slate-800">{a.descripcion}</td>
                    <td className="px-5 py-3">
                      <div className="flex flex-wrap gap-1.5">
                        {(a.tipos ?? []).length === 0 ? (
                          <span className="text-xs text-slate-400">—</span>
                        ) : (
                          (a.tipos ?? []).map((t) => (
                            <span key={t} className="rounded-full bg-[#E4F5F4] px-2.5 py-0.5 text-[11px] font-medium text-[#104A4E]">
                              {TIPOS_LABEL[t] ?? t}
                            </span>
                          ))
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      {a.activo ? (
                        <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold uppercase text-emerald-700">Activo</span>
                      ) : (
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold uppercase text-slate-500">Inactivo</span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-xs text-slate-500">
                      {a.created_by_nombre || "—"}
                      <br />
                      <span className="text-slate-400">{new Date(a.created_at).toLocaleDateString("es-PY")}</span>
                    </td>
                    <td className="px-5 py-3 text-xs text-slate-500 tabular-nums">
                      {new Date(a.updated_at).toLocaleString("es-PY")}
                    </td>
                    <td className="px-5 py-3 text-right space-x-1">
                      <button
                        type="button"
                        onClick={() => setEditando(a)}
                        className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:border-[#4FAEB2] hover:text-[#104A4E]"
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        onClick={() => void borrar(a)}
                        className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 transition-colors hover:border-red-400 hover:bg-red-50"
                      >
                        Eliminar
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {(creando || editando) && (
        <FormModal
          asignacion={editando}
          onClose={() => { setEditando(null); setCreando(false); }}
          onSaved={() => { setEditando(null); setCreando(false); void cargar(); }}
        />
      )}
    </div>
  );
}

// ── Modal crear / editar ───────────────────────────────────────────────────────

function FormModal({
  asignacion,
  onClose,
  onSaved,
}: {
  asignacion: Asignacion | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const esEdicion = asignacion !== null;
  const [form, setForm] = useState(() => {
    if (!asignacion) return { ...FORM_INICIAL, tipos: new Set<string>() };
    return {
      descripcion: asignacion.descripcion,
      seccion: asignacion.seccion ?? "",
      sucursal: asignacion.sucursal ?? "",
      activo: asignacion.activo,
      tipos: new Set<string>(asignacion.tipos ?? []),
      chofer_habilitacion: asignacion.chofer_habilitacion ?? "",
      chofer_fecha_venc: asignacion.chofer_fecha_venc ?? "",
      chofer_km: asignacion.chofer_km != null ? String(asignacion.chofer_km) : "",
      chofer_observacion: asignacion.chofer_observacion ?? "",
    };
  });
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
    if (!form.descripcion.trim()) {
      setError("La descripción es obligatoria.");
      return;
    }
    setGuardando(true);
    try {
      const payload: Record<string, unknown> = {
        descripcion: form.descripcion.trim(),
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
              {esEdicion ? `Editar · Código ${asignacion!.codigo}` : "Nueva asignación"}
            </p>
            <h2 className="text-lg font-semibold text-slate-900">
              {esEdicion ? asignacion!.descripcion : "Crear asignación de tipo"}
            </h2>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600" aria-label="Cerrar">✕</button>
        </div>

        <div className="max-h-[70vh] space-y-6 overflow-y-auto px-6 py-5">
          {/* Datos básicos */}
          <section className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-widest text-slate-400">Datos</h3>
            <div>
              <label className={labelClass}>Descripción <span className="text-red-500">*</span></label>
              <input
                type="text"
                value={form.descripcion}
                onChange={(e) => setForm((p) => ({ ...p, descripcion: e.target.value }))}
                placeholder="Ej: Juan Pérez — Capataz"
                className={inputClass}
              />
            </div>
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
              ¿Inactivo?
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
            {guardando ? "Guardando…" : esEdicion ? "Aplicar cambios" : "Crear"}
          </button>
        </div>
      </div>
    </div>
  );
}
