"use client";

/**
 * CRUD inline reusable de catálogos simples por empresa.
 * Sirve para tipos de empleado, departamentos, sucursales, etc.
 * Espera del endpoint el shape estándar { tipos: Row[] }.
 */

import { useEffect, useState } from "react";
import { fetchWithSupabaseSession } from "@/lib/api/fetch-with-supabase-session";

export interface CatalogoRow {
  id: string;
  slug: string;
  nombre: string;
  activo: boolean;
  orden: number;
  es_sistema: boolean;
}

interface Props {
  /** Endpoint base sin trailing slash, p.ej. "/api/rrhh/tipos-empleado-catalogo". */
  endpointBase: string;
  /** Singular en minúsculas, p.ej. "tipo de empleado". */
  singular: string;
  /** Placeholder del input de creación, p.ej. "Encofrador". */
  placeholderCrear: string;
}

const inputClass =
  "w-full border border-slate-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-[#0EA5E9] focus:outline-none bg-white text-sm";

export default function CatalogoEditor({ endpointBase, singular, placeholderCrear }: Props) {
  const [filas, setFilas] = useState<CatalogoRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nuevo, setNuevo] = useState("");

  async function cargar() {
    setLoading(true);
    setError(null);
    try {
      const r = await fetchWithSupabaseSession(`${endpointBase}?all=1`, { cache: "no-store" });
      const j = await r.json();
      if (j.success) setFilas(j.data.tipos ?? []);
      else setError(j.error ?? "Error al cargar");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error de red");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { void cargar(); }, [endpointBase]);

  async function actualizar(id: string, patch: Partial<{ nombre: string; activo: boolean; orden: number }>) {
    const r = await fetchWithSupabaseSession(`${endpointBase}/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    const j = await r.json();
    if (!j.success) alert(j.error ?? "No se pudo guardar");
    void cargar();
  }

  async function borrar(t: CatalogoRow) {
    if (t.es_sistema) return;
    if (!confirm(`¿Eliminar "${t.nombre}"? Esta acción no se puede deshacer.`)) return;
    const r = await fetchWithSupabaseSession(`${endpointBase}/${t.id}`, { method: "DELETE" });
    const j = await r.json();
    if (!j.success) alert(j.error ?? "No se pudo eliminar");
    void cargar();
  }

  async function crear() {
    const nombre = nuevo.trim();
    if (!nombre) return;
    const r = await fetchWithSupabaseSession(endpointBase, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nombre }),
    });
    const j = await r.json();
    if (!j.success) {
      alert(j.error ?? "No se pudo crear");
      return;
    }
    setNuevo("");
    void cargar();
  }

  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-sm">
      <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 px-5 py-3">
        <input
          type="text"
          value={nuevo}
          onChange={(e) => setNuevo(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") void crear(); }}
          placeholder={`Nuevo ${singular} (ej: ${placeholderCrear})`}
          className={`${inputClass} flex-1 max-w-md`}
        />
        <button
          type="button"
          onClick={crear}
          disabled={!nuevo.trim()}
          className="rounded-lg bg-[#104A4E] px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-[#0d3d40] disabled:opacity-40"
        >
          + Agregar
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wider text-slate-500">
            <tr>
              <th className="px-5 py-3 w-24">Orden</th>
              <th className="px-5 py-3">Nombre</th>
              <th className="px-5 py-3">Identificador</th>
              <th className="px-5 py-3">Estado</th>
              <th className="px-5 py-3 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} className="px-5 py-8 text-center text-slate-400">Cargando…</td></tr>
            ) : error ? (
              <tr><td colSpan={5} className="px-5 py-8 text-center text-red-600">{error}</td></tr>
            ) : filas.length === 0 ? (
              <tr><td colSpan={5} className="px-5 py-8 text-center text-slate-400">Sin {singular}s.</td></tr>
            ) : (
              filas.map((t) => (
                <tr key={t.id} className="border-b border-slate-100 last:border-0">
                  <td className="px-5 py-3">
                    <input
                      type="number"
                      defaultValue={t.orden}
                      onBlur={(e) => {
                        const n = Number(e.target.value);
                        if (Number.isFinite(n) && n !== t.orden) void actualizar(t.id, { orden: n });
                      }}
                      className="w-20 rounded border border-slate-200 px-2 py-1 text-sm"
                    />
                  </td>
                  <td className="px-5 py-3">
                    <input
                      type="text"
                      defaultValue={t.nombre}
                      onBlur={(e) => {
                        const v = e.target.value.trim();
                        if (v && v !== t.nombre) void actualizar(t.id, { nombre: v });
                      }}
                      className="w-full max-w-sm rounded border border-slate-200 px-2 py-1 text-sm"
                    />
                    {t.es_sistema && (
                      <span className="ml-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400">Sistema</span>
                    )}
                  </td>
                  <td className="px-5 py-3 font-mono text-xs text-slate-500">{t.slug}</td>
                  <td className="px-5 py-3">
                    <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                      <input
                        type="checkbox"
                        checked={t.activo}
                        onChange={(e) => void actualizar(t.id, { activo: e.target.checked })}
                        className="h-4 w-4 rounded border-slate-300 text-[#104A4E] focus:ring-[#4FAEB2]"
                      />
                      {t.activo ? "Activo" : "Inactivo"}
                    </label>
                  </td>
                  <td className="px-5 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => void borrar(t)}
                      disabled={t.es_sistema}
                      title={t.es_sistema ? "Los registros del sistema no se eliminan, solo se desactivan" : "Eliminar"}
                      className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 transition-colors hover:border-red-400 hover:bg-red-50 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-300 disabled:hover:bg-transparent"
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
  );
}
