"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import PageHeader from "@/components/ui/PageHeader";
import { fetchWithSupabaseSession } from "@/lib/api/fetch-with-supabase-session";

export const dynamic = "force-dynamic";

type Empleado = {
  id: string;
  nombre: string;
  documento: string | null;
  cargo: string | null;
  salario_base: number;
  costo_hora: number;
  activo: boolean;
  fecha_ingreso: string | null;
};

function fmtGs(n: number): string {
  return `Gs. ${Math.round(n).toLocaleString("es-PY")}`;
}

export default function EmpleadosPage() {
  const [empleados, setEmpleados] = useState<Empleado[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    nombre: "",
    documento: "",
    cargo: "",
    salario_base: "",
    costo_hora: "",
    fecha_ingreso: "",
  });

  async function load() {
    setLoading(true);
    try {
      const r = await fetchWithSupabaseSession("/api/rrhh/empleados", { cache: "no-store" });
      const j = (await r.json().catch(() => ({}))) as { success?: boolean; data?: { empleados?: Empleado[] }; error?: string };
      if (r.ok && j.success) {
        setEmpleados(j.data?.empleados ?? []);
        setErr(null);
      } else {
        setErr(j.error ?? "No se pudieron cargar los empleados");
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.nombre.trim()) return;
    setSaving(true);
    try {
      const r = await fetchWithSupabaseSession("/api/rrhh/empleados", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nombre: form.nombre.trim(),
          documento: form.documento.trim() || undefined,
          cargo: form.cargo.trim() || undefined,
          salario_base: Number(form.salario_base) || 0,
          costo_hora: Number(form.costo_hora) || 0,
          fecha_ingreso: form.fecha_ingreso || undefined,
        }),
      });
      const j = (await r.json().catch(() => ({}))) as { success?: boolean; error?: string };
      if (r.ok && j.success) {
        setForm({ nombre: "", documento: "", cargo: "", salario_base: "", costo_hora: "", fecha_ingreso: "" });
        setShowForm(false);
        await load();
      } else {
        setErr(j.error ?? "No se pudo crear el empleado");
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="NCG · RRHH"
        title="Empleados"
        description="Personal de la constructora. El costo por hora se usa para imputar mano de obra a las obras."
        backHref="/rrhh"
        backLabel="RRHH"
        actions={
          <button
            type="button"
            onClick={() => setShowForm((s) => !s)}
            className="inline-flex items-center gap-2 rounded-lg bg-[#4FAEB2] px-3 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-[#3F8E91]"
          >
            <span className="text-lg leading-none">+</span> {showForm ? "Cerrar" : "Nuevo empleado"}
          </button>
        }
      />

      {err ? <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">{err}</div> : null}

      {showForm && (
        <form onSubmit={handleSubmit} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Field label="Nombre" required>
              <input className={inputCls} value={form.nombre}
                onChange={(e) => setForm({ ...form, nombre: e.target.value })} required />
            </Field>
            <Field label="Documento (CI / RUC)">
              <input className={inputCls} value={form.documento}
                onChange={(e) => setForm({ ...form, documento: e.target.value })} />
            </Field>
            <Field label="Cargo">
              <input className={inputCls} value={form.cargo} placeholder="Ej. Albañil, Encargado, Soldador"
                onChange={(e) => setForm({ ...form, cargo: e.target.value })} />
            </Field>
            <Field label="Fecha de ingreso">
              <input type="date" className={inputCls} value={form.fecha_ingreso}
                onChange={(e) => setForm({ ...form, fecha_ingreso: e.target.value })} />
            </Field>
            <Field label="Salario base (Gs.)">
              <input type="number" inputMode="numeric" className={inputCls} value={form.salario_base}
                onChange={(e) => setForm({ ...form, salario_base: e.target.value })} />
            </Field>
            <Field label="Costo por hora (Gs.)" hint="Se usa para calcular costo de obra automáticamente.">
              <input type="number" inputMode="numeric" className={inputCls} value={form.costo_hora}
                onChange={(e) => setForm({ ...form, costo_hora: e.target.value })} />
            </Field>
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <button type="button" onClick={() => setShowForm(false)}
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm">Cancelar</button>
            <button type="submit" disabled={saving}
              className="rounded-lg bg-[#4FAEB2] px-3 py-2 text-sm font-medium text-white disabled:opacity-50">
              {saving ? "Guardando…" : "Crear empleado"}
            </button>
          </div>
        </form>
      )}

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-slate-600">
              <th className="px-5 py-3 font-semibold">Nombre</th>
              <th className="px-5 py-3 font-semibold hidden md:table-cell">Cargo</th>
              <th className="px-5 py-3 font-semibold hidden lg:table-cell">Documento</th>
              <th className="px-5 py-3 font-semibold text-right">Salario base</th>
              <th className="px-5 py-3 font-semibold text-right">Costo/h</th>
              <th className="px-5 py-3 font-semibold">Estado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {loading ? (
              <tr><td colSpan={6} className="py-10 text-center text-gray-400">Cargando…</td></tr>
            ) : empleados.length === 0 ? (
              <tr><td colSpan={6} className="py-10 text-center text-gray-400">No hay empleados registrados</td></tr>
            ) : (
              empleados.map((e) => (
                <tr key={e.id} className="hover:bg-[#4FAEB2]/[0.04]">
                  <td className="px-5 py-3.5 font-medium text-gray-800">{e.nombre}</td>
                  <td className="px-5 py-3.5 text-gray-600 hidden md:table-cell">{e.cargo ?? "—"}</td>
                  <td className="px-5 py-3.5 text-gray-500 hidden lg:table-cell">{e.documento ?? "—"}</td>
                  <td className="px-5 py-3.5 text-right tabular-nums text-gray-700">{fmtGs(e.salario_base)}</td>
                  <td className="px-5 py-3.5 text-right tabular-nums text-gray-700">{fmtGs(e.costo_hora)}</td>
                  <td className="px-5 py-3.5">
                    {e.activo ? (
                      <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">Activo</span>
                    ) : (
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">Inactivo</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-slate-500">
        Para asignar un empleado a una obra y registrar horas trabajadas, andá a la obra y abrí el tab <Link href="/dashboard/proyectos" className="underline">Personal</Link>.
      </p>
    </div>
  );
}

const inputCls = "w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none transition focus:border-[#4FAEB2]/50 focus:ring-2 focus:ring-[#4FAEB2]/30";

function Field({ label, hint, required, children }: { label: string; hint?: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1.5">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      {children}
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
    </div>
  );
}
