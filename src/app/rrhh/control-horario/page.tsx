"use client";

import { useCallback, useEffect, useState } from "react";
import PageHeader from "@/components/ui/PageHeader";
import { fetchWithSupabaseSession } from "@/lib/api/fetch-with-supabase-session";

export const dynamic = "force-dynamic";

type Empleado = { id: string; nombre: string; cargo: string | null };
type Fichaje = {
  id: string;
  empleado_id: string;
  empleado_nombre: string | null;
  empleado_cargo: string | null;
  fecha: string;
  hora_entrada: string | null;
  hora_salida: string | null;
  horas: number;
  observacion: string | null;
};

function fmtFecha(iso: string): string {
  try { return new Date(iso).toLocaleDateString("es-PY"); } catch { return iso.slice(0, 10); }
}

export default function ControlHorarioPage() {
  const [empleados, setEmpleados] = useState<Empleado[]>([]);
  const [fichajes, setFichajes] = useState<Fichaje[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [form, setForm] = useState({
    empleado_id: "",
    fecha: new Date().toISOString().slice(0, 10),
    hora_entrada: "08:00",
    hora_salida: "17:00",
    observacion: "",
  });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [rE, rF] = await Promise.all([
        fetchWithSupabaseSession("/api/rrhh/empleados", { cache: "no-store" }),
        fetchWithSupabaseSession("/api/rrhh/fichajes", { cache: "no-store" }),
      ]);
      const jE = (await rE.json().catch(() => ({}))) as { success?: boolean; data?: { empleados?: Empleado[] } };
      const jF = (await rF.json().catch(() => ({}))) as { success?: boolean; data?: { fichajes?: Fichaje[] }; error?: string };
      if (rE.ok && jE.success) setEmpleados(jE.data?.empleados ?? []);
      if (rF.ok && jF.success) { setFichajes(jF.data?.fichajes ?? []); setErr(null); }
      else setErr(jF.error ?? "No se pudieron cargar los fichajes");
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.empleado_id) return;
    setSaving(true);
    try {
      const r = await fetchWithSupabaseSession("/api/rrhh/fichajes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const j = (await r.json().catch(() => ({}))) as { success?: boolean; error?: string };
      if (r.ok && j.success) {
        setForm({ ...form, empleado_id: "", observacion: "" });
        await load();
      } else {
        setErr(j.error ?? "No se pudo guardar el fichaje");
      }
    } finally { setSaving(false); }
  }

  const totalHoras = fichajes.reduce((acc, f) => acc + Number(f.horas), 0);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="NCG · RRHH"
        title="Control horario"
        description="Registro de entrada y salida diaria. Las horas se calculan automáticamente."
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
          <h3 className="text-sm font-semibold text-slate-700">Registrar fichaje</h3>
          <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-5">
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
              <label className={lblCls}>Fecha</label>
              <input type="date" className={inputCls} value={form.fecha}
                onChange={(e) => setForm({ ...form, fecha: e.target.value })} />
            </div>
            <div>
              <label className={lblCls}>Entrada</label>
              <input type="time" className={inputCls} value={form.hora_entrada}
                onChange={(e) => setForm({ ...form, hora_entrada: e.target.value })} />
            </div>
            <div>
              <label className={lblCls}>Salida</label>
              <input type="time" className={inputCls} value={form.hora_salida}
                onChange={(e) => setForm({ ...form, hora_salida: e.target.value })} />
            </div>
          </div>
          <div className="mt-3">
            <label className={lblCls}>Observación</label>
            <input className={inputCls} value={form.observacion}
              placeholder="Ej. ½ jornada, turno noche"
              onChange={(e) => setForm({ ...form, observacion: e.target.value })} />
          </div>
          <p className="mt-2 text-xs text-slate-500">
            Si ya existe un fichaje del empleado para esa fecha, se actualiza (no duplica).
          </p>
          <div className="mt-3 flex justify-end">
            <button type="submit" disabled={saving}
              className="rounded-lg bg-[#4FAEB2] px-3 py-2 text-sm font-medium text-white disabled:opacity-50">
              {saving ? "Guardando…" : "Guardar fichaje"}
            </button>
          </div>
        </form>
      )}

      <div className="rounded-xl border border-slate-200 bg-white">
        <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-slate-200 px-4 py-3">
          <h3 className="text-sm font-semibold text-slate-700">Últimos 30 días</h3>
          <span className="text-xs text-slate-500">Total horas registradas: <strong className="tabular-nums text-slate-800">{totalHoras.toFixed(1)}</strong></span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="px-4 py-3 font-semibold">Fecha</th>
                <th className="px-4 py-3 font-semibold">Empleado</th>
                <th className="px-4 py-3 font-semibold hidden md:table-cell">Cargo</th>
                <th className="px-4 py-3 font-semibold">Entrada</th>
                <th className="px-4 py-3 font-semibold">Salida</th>
                <th className="px-4 py-3 font-semibold text-right">Horas</th>
                <th className="px-4 py-3 font-semibold hidden lg:table-cell">Obs.</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan={7} className="py-10 text-center text-gray-400">Cargando…</td></tr>
              ) : fichajes.length === 0 ? (
                <tr><td colSpan={7} className="py-10 text-center text-gray-400">Sin fichajes registrados</td></tr>
              ) : (
                fichajes.map((f) => (
                  <tr key={f.id} className="hover:bg-[#4FAEB2]/[0.04]">
                    <td className="px-4 py-2.5 text-gray-600 text-xs tabular-nums">{fmtFecha(f.fecha)}</td>
                    <td className="px-4 py-2.5 font-medium text-gray-800">{f.empleado_nombre ?? "—"}</td>
                    <td className="px-4 py-2.5 text-gray-500 hidden md:table-cell">{f.empleado_cargo ?? "—"}</td>
                    <td className="px-4 py-2.5 text-gray-700 tabular-nums">{f.hora_entrada ?? "—"}</td>
                    <td className="px-4 py-2.5 text-gray-700 tabular-nums">{f.hora_salida ?? "—"}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums font-semibold text-gray-800">{Number(f.horas).toFixed(1)}</td>
                    <td className="px-4 py-2.5 text-gray-500 text-xs hidden lg:table-cell">{f.observacion ?? "—"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

const inputCls = "w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none transition focus:border-[#4FAEB2]/50 focus:ring-2 focus:ring-[#4FAEB2]/30";
const lblCls = "block text-xs font-medium text-slate-600 mb-1";
