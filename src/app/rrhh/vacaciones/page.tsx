"use client";

import { useCallback, useEffect, useState } from "react";
import PageHeader from "@/components/ui/PageHeader";
import { fetchWithSupabaseSession } from "@/lib/api/fetch-with-supabase-session";

export const dynamic = "force-dynamic";

type Empleado = { id: string; nombre: string; cargo: string | null };
type Solicitud = {
  id: string;
  empleado_id: string;
  empleado_nombre: string | null;
  empleado_cargo: string | null;
  fecha_desde: string;
  fecha_hasta: string;
  dias: number;
  estado: "pendiente" | "aprobada" | "rechazada";
  observacion: string | null;
  aprobado_at: string | null;
};

function fmtFecha(iso: string): string {
  try { return new Date(iso).toLocaleDateString("es-PY"); } catch { return iso.slice(0, 10); }
}

export default function VacacionesPage() {
  const [empleados, setEmpleados] = useState<Empleado[]>([]);
  const [solicitudes, setSolicitudes] = useState<Solicitud[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [form, setForm] = useState({
    empleado_id: "",
    fecha_desde: new Date().toISOString().slice(0, 10),
    fecha_hasta: new Date().toISOString().slice(0, 10),
    observacion: "",
  });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [rE, rS] = await Promise.all([
        fetchWithSupabaseSession("/api/rrhh/empleados", { cache: "no-store" }),
        fetchWithSupabaseSession("/api/rrhh/vacaciones", { cache: "no-store" }),
      ]);
      const jE = (await rE.json().catch(() => ({}))) as { success?: boolean; data?: { empleados?: Empleado[] } };
      const jS = (await rS.json().catch(() => ({}))) as { success?: boolean; data?: { solicitudes?: Solicitud[] }; error?: string };
      if (rE.ok && jE.success) setEmpleados(jE.data?.empleados ?? []);
      if (rS.ok && jS.success) { setSolicitudes(jS.data?.solicitudes ?? []); setErr(null); }
      else setErr(jS.error ?? "No se pudieron cargar las solicitudes");
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.empleado_id) return;
    setSaving(true);
    try {
      const r = await fetchWithSupabaseSession("/api/rrhh/vacaciones", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const j = (await r.json().catch(() => ({}))) as { success?: boolean; error?: string };
      if (r.ok && j.success) {
        setForm({ ...form, empleado_id: "", observacion: "" });
        await load();
      } else {
        setErr(j.error ?? "No se pudo guardar");
      }
    } finally { setSaving(false); }
  }

  async function cambiarEstado(id: string, estado: "aprobada" | "rechazada") {
    const r = await fetchWithSupabaseSession(`/api/rrhh/vacaciones/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ estado }),
    });
    const j = (await r.json().catch(() => ({}))) as { success?: boolean; error?: string };
    if (!r.ok || !j.success) {
      setErr(j.error ?? "No se pudo cambiar estado");
      return;
    }
    await load();
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="NCG · RRHH"
        title="Vacaciones"
        description="Solicitudes y aprobaciones de vacaciones por empleado."
        backHref="/rrhh"
        backLabel="RRHH"
      />

      {err && <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">{err}</div>}

      {empleados.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
          Cargá primero empleados desde <a href="/rrhh/empleados" className="font-medium text-[#3F8E91] underline">RRHH → Empleados</a>.
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="rounded-xl border border-slate-200 bg-white p-4">
          <h3 className="text-sm font-semibold text-slate-700">Nueva solicitud</h3>
          <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-4">
            <div className="md:col-span-2">
              <label className={lblCls}>Empleado</label>
              <select className={inputCls} value={form.empleado_id} required
                onChange={(e) => setForm({ ...form, empleado_id: e.target.value })}>
                <option value="">Seleccionar…</option>
                {empleados.map((e) => (
                  <option key={e.id} value={e.id}>{e.nombre}{e.cargo ? ` — ${e.cargo}` : ""}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={lblCls}>Desde</label>
              <input type="date" className={inputCls} value={form.fecha_desde}
                onChange={(e) => setForm({ ...form, fecha_desde: e.target.value })} />
            </div>
            <div>
              <label className={lblCls}>Hasta</label>
              <input type="date" className={inputCls} value={form.fecha_hasta} min={form.fecha_desde}
                onChange={(e) => setForm({ ...form, fecha_hasta: e.target.value })} />
            </div>
          </div>
          <div className="mt-3">
            <label className={lblCls}>Observación</label>
            <input className={inputCls} value={form.observacion}
              placeholder="Ej. Vacaciones anuales, motivo personal"
              onChange={(e) => setForm({ ...form, observacion: e.target.value })} />
          </div>
          <div className="mt-3 flex justify-end">
            <button type="submit" disabled={saving}
              className="rounded-lg bg-[#4FAEB2] px-3 py-2 text-sm font-medium text-white disabled:opacity-50">
              {saving ? "Guardando…" : "Solicitar"}
            </button>
          </div>
        </form>
      )}

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full min-w-[820px] text-left text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="px-4 py-3 font-semibold">Empleado</th>
              <th className="px-4 py-3 font-semibold hidden md:table-cell">Cargo</th>
              <th className="px-4 py-3 font-semibold">Desde</th>
              <th className="px-4 py-3 font-semibold">Hasta</th>
              <th className="px-4 py-3 font-semibold text-right">Días</th>
              <th className="px-4 py-3 font-semibold">Estado</th>
              <th className="px-4 py-3 font-semibold text-right">Acción</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr><td colSpan={7} className="py-10 text-center text-gray-400">Cargando…</td></tr>
            ) : solicitudes.length === 0 ? (
              <tr><td colSpan={7} className="py-10 text-center text-gray-400">Sin solicitudes</td></tr>
            ) : (
              solicitudes.map((s) => (
                <tr key={s.id} className="hover:bg-[#4FAEB2]/[0.04]">
                  <td className="px-4 py-2.5 font-medium text-gray-800">{s.empleado_nombre ?? "—"}</td>
                  <td className="px-4 py-2.5 text-gray-500 hidden md:table-cell">{s.empleado_cargo ?? "—"}</td>
                  <td className="px-4 py-2.5 text-gray-600 text-xs tabular-nums">{fmtFecha(s.fecha_desde)}</td>
                  <td className="px-4 py-2.5 text-gray-600 text-xs tabular-nums">{fmtFecha(s.fecha_hasta)}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums font-semibold text-gray-800">{s.dias}</td>
                  <td className="px-4 py-2.5"><EstadoBadge estado={s.estado} /></td>
                  <td className="px-4 py-2.5 text-right">
                    {s.estado === "pendiente" ? (
                      <div className="flex justify-end gap-2">
                        <button onClick={() => void cambiarEstado(s.id, "aprobada")}
                          className="text-xs text-emerald-700 hover:underline">aprobar</button>
                        <button onClick={() => void cambiarEstado(s.id, "rechazada")}
                          className="text-xs text-red-700 hover:underline">rechazar</button>
                      </div>
                    ) : <span className="text-xs text-slate-400">—</span>}
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

function EstadoBadge({ estado }: { estado: "pendiente" | "aprobada" | "rechazada" }) {
  const cfg = {
    pendiente: { bg: "bg-amber-50",   text: "text-amber-700",   label: "Pendiente" },
    aprobada:  { bg: "bg-emerald-50", text: "text-emerald-700", label: "Aprobada" },
    rechazada: { bg: "bg-red-50",     text: "text-red-700",     label: "Rechazada" },
  }[estado];
  return (
    <span className={`rounded-full ${cfg.bg} px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${cfg.text}`}>
      {cfg.label}
    </span>
  );
}

const inputCls = "w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none transition focus:border-[#4FAEB2]/50 focus:ring-2 focus:ring-[#4FAEB2]/30";
const lblCls = "block text-xs font-medium text-slate-600 mb-1";
