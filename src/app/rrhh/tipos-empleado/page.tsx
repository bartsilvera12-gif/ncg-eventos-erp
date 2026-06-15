"use client";

/**
 * RRHH · Asignación de tipo de empleado
 *
 * CRUD para asignar a cada empleado de NCG uno o varios "tipos" (roles
 * operativos), datos de sección/sucursal y, si marca "Chofer", los datos
 * del permiso de conducir. Reemplaza el viejo "Asignación de tipos" de la
 * distribuidora con un alcance adecuado a una constructora.
 */

import { useEffect, useMemo, useState } from "react";
import PageHeader from "@/components/ui/PageHeader";
import { fetchWithSupabaseSession } from "@/lib/api/fetch-with-supabase-session";

// ── Catálogo de tipos disponibles ──────────────────────────────────────────────
// Orden importa porque va a verse en la lista de checkboxes.
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

// ── Tipos ──────────────────────────────────────────────────────────────────────

interface EmpleadoRow {
  id: string;
  nombre: string;
  cargo: string | null;
  seccion: string | null;
  sucursal: string | null;
  activo: boolean;
  tipos: string[] | null;
  chofer_habilitacion: string | null;
  chofer_fecha_venc: string | null;
  chofer_km: number | null;
  chofer_observacion: string | null;
  created_at: string;
  updated_at: string;
  // Estos campos los rellenamos si el back los devuelve; por ahora se muestran
  // como "—".
  created_by_nombre?: string | null;
  updated_by_nombre?: string | null;
}

// ── Estilos ────────────────────────────────────────────────────────────────────

const inputClass =
  "w-full border border-slate-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-[#0EA5E9] focus:outline-none bg-white text-sm";
const labelClass = "block text-xs font-medium text-slate-600 mb-1.5";

// ── Componente principal ───────────────────────────────────────────────────────

export default function TiposEmpleadoPage() {
  const [empleados, setEmpleados] = useState<EmpleadoRow[]>([]);
  const [busqueda, setBusqueda] = useState("");
  const [loading, setLoading] = useState(true);
  const [editandoId, setEditandoId] = useState<string | null>(null);

  async function cargar() {
    setLoading(true);
    try {
      const r = await fetchWithSupabaseSession("/api/rrhh/empleados", { cache: "no-store" });
      const j = await r.json();
      if (j.success) setEmpleados(j.data.empleados ?? []);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { void cargar(); }, []);

  const lista = useMemo(() => {
    const t = busqueda.trim().toLowerCase();
    if (!t) return empleados;
    return empleados.filter(
      (e) => e.nombre.toLowerCase().includes(t) || (e.cargo ?? "").toLowerCase().includes(t),
    );
  }, [empleados, busqueda]);

  const editando = empleados.find((e) => e.id === editandoId) ?? null;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="NCG · Personal"
        title="Asignación de tipo de empleado"
        description="Definí qué rol cumple cada empleado en la operación: obra, comercial, administración o conducción. Un empleado puede tener más de un tipo."
        backHref="/rrhh"
        backLabel="Recursos Humanos"
      />

      <div className="bg-white border border-slate-200 rounded-xl shadow-sm">
        {/* Barra superior */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-3">
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar por nombre o cargo…"
              className={`${inputClass} max-w-sm`}
            />
          </div>
          <span className="text-xs text-slate-500">
            {lista.length} {lista.length === 1 ? "empleado" : "empleados"}
          </span>
        </div>

        {/* Tabla */}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-left text-sm">
            <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-5 py-3">Empleado</th>
                <th className="px-5 py-3">Tipos asignados</th>
                <th className="px-5 py-3">Sección / Sucursal</th>
                <th className="px-5 py-3">Estado</th>
                <th className="px-5 py-3">Última modificación</th>
                <th className="px-5 py-3 text-right">Acción</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} className="px-5 py-8 text-center text-slate-400">Cargando…</td></tr>
              ) : lista.length === 0 ? (
                <tr><td colSpan={6} className="px-5 py-8 text-center text-slate-400">Sin resultados.</td></tr>
              ) : (
                lista.map((e) => (
                  <tr key={e.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/50">
                    <td className="px-5 py-3 font-medium text-slate-800">
                      {e.nombre}
                      {e.cargo && <span className="ml-2 text-xs text-slate-400">{e.cargo}</span>}
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex flex-wrap gap-1.5">
                        {(e.tipos ?? []).length === 0 ? (
                          <span className="text-xs text-slate-400">— Sin asignar —</span>
                        ) : (
                          (e.tipos ?? []).map((t) => (
                            <span
                              key={t}
                              className="rounded-full bg-[#E4F5F4] px-2.5 py-0.5 text-[11px] font-medium text-[#104A4E]"
                            >
                              {TIPOS_LABEL[t] ?? t}
                            </span>
                          ))
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-3 text-xs text-slate-600">
                      {[e.seccion, e.sucursal].filter(Boolean).join(" · ") || "—"}
                    </td>
                    <td className="px-5 py-3">
                      {e.activo ? (
                        <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold uppercase text-emerald-700">Activo</span>
                      ) : (
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold uppercase text-slate-500">Inactivo</span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-xs text-slate-500 tabular-nums">
                      {new Date(e.updated_at).toLocaleDateString("es-PY")}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => setEditandoId(e.id)}
                        className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:border-[#4FAEB2] hover:text-[#104A4E]"
                      >
                        Editar
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
        <EditModal
          empleado={editando}
          onClose={() => setEditandoId(null)}
          onSaved={() => { setEditandoId(null); void cargar(); }}
        />
      )}
    </div>
  );
}

// ── Modal de edición ───────────────────────────────────────────────────────────

function EditModal({
  empleado,
  onClose,
  onSaved,
}: {
  empleado: EmpleadoRow;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    seccion: empleado.seccion ?? "",
    sucursal: empleado.sucursal ?? "",
    activo: empleado.activo,
    tipos: new Set<string>(empleado.tipos ?? []),
    chofer_habilitacion: empleado.chofer_habilitacion ?? "",
    chofer_fecha_venc: empleado.chofer_fecha_venc ?? "",
    chofer_km: empleado.chofer_km != null ? String(empleado.chofer_km) : "",
    chofer_observacion: empleado.chofer_observacion ?? "",
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
    setGuardando(true);
    setError(null);
    try {
      const payload: Record<string, unknown> = {
        seccion: form.seccion.trim() || null,
        sucursal: form.sucursal.trim() || null,
        activo: form.activo,
        tipos: Array.from(form.tipos),
      };
      if (tieneChofer) {
        payload.chofer_habilitacion = form.chofer_habilitacion.trim() || null;
        payload.chofer_fecha_venc = form.chofer_fecha_venc || null;
        payload.chofer_km = form.chofer_km ? Number(form.chofer_km) : 0;
        payload.chofer_observacion = form.chofer_observacion.trim() || null;
      } else {
        // Limpiar datos de chofer si destildaron el tipo.
        payload.chofer_habilitacion = null;
        payload.chofer_fecha_venc = null;
        payload.chofer_km = 0;
        payload.chofer_observacion = null;
      }
      const r = await fetchWithSupabaseSession(`/api/rrhh/empleados/${empleado.id}`, {
        method: "PATCH",
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
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Detalles</p>
            <h2 className="text-lg font-semibold text-slate-900">{empleado.nombre}</h2>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600" aria-label="Cerrar">
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="max-h-[70vh] space-y-6 overflow-y-auto px-6 py-5">
          {/* Asignación */}
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
              ¿Inactivo?
            </label>
          </section>

          {/* Tipos */}
          <section className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-widest text-slate-400">Tipos</h3>
            <p className="text-xs text-slate-500">Marcá todos los roles que cumple este empleado.</p>
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

          {/* Chofer — sólo si marca chofer */}
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

          {/* Auditoría */}
          <section className="space-y-2 border-t border-slate-100 pt-4">
            <h3 className="text-xs font-semibold uppercase tracking-widest text-slate-400">Auditoría</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-slate-600">
              <div>
                <p className="font-semibold text-slate-500">Registrado el</p>
                <p>{new Date(empleado.created_at).toLocaleString("es-PY")}</p>
              </div>
              <div>
                <p className="font-semibold text-slate-500">Última modificación</p>
                <p>{new Date(empleado.updated_at).toLocaleString("es-PY")}</p>
              </div>
            </div>
          </section>

          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
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
            {guardando ? "Guardando…" : "Aplicar cambios"}
          </button>
        </div>
      </div>
    </div>
  );
}
