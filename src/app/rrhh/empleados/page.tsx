"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import PageHeader from "@/components/ui/PageHeader";
import MontoInput from "@/components/ui/MontoInput";
import { fetchWithSupabaseSession } from "@/lib/api/fetch-with-supabase-session";

export const dynamic = "force-dynamic";

type Empleado = {
  id: string;
  nombre: string;
  documento: string | null;
  tipo_documento: string | null;
  fecha_nacimiento: string | null;
  lugar_nacimiento: string | null;
  nacionalidad: string | null;
  estado_civil: string | null;
  grupo_sanguineo: string | null;
  direccion: string | null;
  email: string | null;
  telefono: string | null;
  cargo: string | null;
  fecha_ingreso: string | null;
  fecha_baja: string | null;
  tipo_empleado: string | null;
  tipo_periodo: string | null;
  tipos_empleado: string[] | null;
  sucursal: string | null;
  chofer_habilitacion: string | null;
  chofer_fecha_venc: string | null;
  chofer_km: number | null;
  chofer_observacion: string | null;
  departamento: string | null;
  seccion: string | null;
  supervisor: string | null;
  salario_base: number;
  salario_complementario: number;
  costo_hora: number;
  banco: string | null;
  numero_cuenta: string | null;
  cobrar_con_cheque: boolean;
  excluir_liquidaciones: boolean;
  activo: boolean;
};

const FORM_INICIAL = {
  nombre: "",
  tipo_documento: "DNI",
  documento: "",
  fecha_nacimiento: "",
  lugar_nacimiento: "",
  nacionalidad: "Española",
  estado_civil: "",
  grupo_sanguineo: "",
  direccion: "",
  email: "",
  telefono: "",
  cargo: "",
  fecha_ingreso: "",
  fecha_baja: "",
  tipo_empleado: "CONTRATADO",
  tipo_periodo: "mensual",
  tipos_empleado: [] as string[],
  sucursal: "",
  chofer_habilitacion: "",
  chofer_fecha_venc: "",
  chofer_km: "",
  chofer_observacion: "",
  departamento: "",
  seccion: "",
  supervisor: "",
  salario_base: "",
  salario_complementario: "",
  costo_hora: "",
  banco: "",
  numero_cuenta: "",
  cobrar_con_cheque: false,
  excluir_liquidaciones: false,
};

const ESTADO_CIVIL_OPTS = ["soltero/a", "casado/a", "divorciado/a", "viudo/a", "unión libre"];
const GRUPO_SANG_OPTS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];
const TIPO_DOC_OPTS = ["DNI", "NIE", "NIF", "Pasaporte", "Otro"];
const TIPO_EMP_OPTS = ["CONTRATADO", "PERMANENTE", "JORNALERO", "PASANTE"];
const TIPO_PERIODO_OPTS = [
  { value: "mensual",   label: "Mensual" },
  { value: "quincenal", label: "Quincenal" },
  { value: "semanal",   label: "Semanal" },
  { value: "jornal",    label: "Jornal" },
];

function fmtGs(n: number): string {
  return `€ ${n.toLocaleString("es-PY", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

export default function EmpleadosPage() {
  const [empleados, setEmpleados] = useState<Empleado[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editando, setEditando] = useState<Empleado | null>(null);
  const [verInactivos, setVerInactivos] = useState(false);

  const [form, setForm] = useState(FORM_INICIAL);

  const activos = empleados.filter((e) => e.activo);
  const inactivos = empleados.filter((e) => !e.activo);
  const empleadosFiltrados = verInactivos ? inactivos : activos;

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

  async function toggleActivo(emp: Empleado) {
    const r = await fetchWithSupabaseSession(`/api/rrhh/empleados/${emp.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ activo: !emp.activo }),
    });
    const j = (await r.json().catch(() => ({}))) as { success?: boolean; error?: string };
    if (!r.ok || !j.success) {
      setErr(j.error ?? "No se pudo cambiar el estado");
      return;
    }
    await load();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.nombre.trim()) return;
    setSaving(true);
    try {
      const r = await fetchWithSupabaseSession("/api/rrhh/empleados", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, nombre: form.nombre.trim() }),
      });
      const j = (await r.json().catch(() => ({}))) as { success?: boolean; error?: string };
      if (r.ok && j.success) {
        setForm(FORM_INICIAL);
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
        <form onSubmit={handleSubmit} className="space-y-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <EmpleadoFormFields
            form={form}
            setForm={setForm}
            supervisores={activos.map((e) => e.nombre)}
          />
          <div className="flex justify-end gap-2 border-t border-slate-200 pt-4">
            <button type="button" onClick={() => setShowForm(false)}
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm">Cancelar</button>
            <button type="submit" disabled={saving}
              className="rounded-lg bg-[#4FAEB2] px-3 py-2 text-sm font-medium text-white disabled:opacity-50">
              {saving ? "Guardando…" : "Crear empleado"}
            </button>
          </div>
        </form>
      )}

      {/* Tabs Activos / Inactivos */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-1">
        <button type="button"
          onClick={() => setVerInactivos(false)}
          className={`relative -mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
            !verInactivos
              ? "border-[#4FAEB2] text-[#3F8E91]"
              : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          Activos
          <span className={`ml-2 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
            !verInactivos ? "bg-[#E5F4F4] text-[#3F8E91]" : "bg-slate-100 text-slate-500"
          }`}>{activos.length}</span>
        </button>
        <button type="button"
          onClick={() => setVerInactivos(true)}
          className={`relative -mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
            verInactivos
              ? "border-amber-500 text-amber-700"
              : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          Desactivados
          <span className={`ml-2 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
            verInactivos ? "bg-amber-50 text-amber-700" : "bg-slate-100 text-slate-500"
          }`}>{inactivos.length}</span>
        </button>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full min-w-[860px] text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-slate-600">
              <th className="px-5 py-3 font-semibold">Nombre</th>
              <th className="px-5 py-3 font-semibold hidden md:table-cell">Cargo</th>
              <th className="px-5 py-3 font-semibold hidden lg:table-cell">Documento</th>
              <th className="px-5 py-3 font-semibold text-right">Salario base</th>
              <th className="px-5 py-3 font-semibold text-right hidden md:table-cell">Complementario</th>
              <th className="px-5 py-3 font-semibold text-right">Salario total</th>
              <th className="px-5 py-3 font-semibold">Estado</th>
              <th className="px-5 py-3 font-semibold text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {loading ? (
              <tr><td colSpan={8} className="py-10 text-center text-gray-400">Cargando…</td></tr>
            ) : empleadosFiltrados.length === 0 ? (
              <tr><td colSpan={8} className="py-10 text-center text-gray-400">
                {verInactivos ? "No hay empleados desactivados" : "No hay empleados activos"}
              </td></tr>
            ) : (
              empleadosFiltrados.map((e) => (
                <tr key={e.id} className={`hover:bg-[#4FAEB2]/[0.04] ${!e.activo ? "opacity-70" : ""}`}>
                  <td className="px-5 py-3.5 font-medium text-gray-800">{e.nombre}</td>
                  <td className="px-5 py-3.5 text-gray-600 hidden md:table-cell">{e.cargo ?? "—"}</td>
                  <td className="px-5 py-3.5 text-gray-500 hidden lg:table-cell">{e.documento ?? "—"}</td>
                  <td className="px-5 py-3.5 text-right tabular-nums text-gray-700">{fmtGs(e.salario_base)}</td>
                  <td className="px-5 py-3.5 text-right tabular-nums text-gray-500 hidden md:table-cell">{fmtGs(e.salario_complementario ?? 0)}</td>
                  <td className="px-5 py-3.5 text-right tabular-nums font-semibold text-gray-900">{fmtGs(e.salario_base + (e.salario_complementario ?? 0))}</td>
                  <td className="px-5 py-3.5">
                    {e.activo ? (
                      <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">Activo</span>
                    ) : (
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">Inactivo</span>
                    )}
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    <div className="flex justify-end gap-3">
                      <button type="button" onClick={() => setEditando(e)}
                        className="text-xs font-medium text-[#3F8E91] hover:text-[#2F6F72] underline">
                        editar
                      </button>
                      <button type="button" onClick={() => void toggleActivo(e)}
                        className={`text-xs font-medium underline ${e.activo ? "text-amber-700 hover:text-amber-900" : "text-emerald-700 hover:text-emerald-900"}`}>
                        {e.activo ? "desactivar" : "activar"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {editando && (
        <EditarEmpleadoModal
          empleado={editando}
          supervisores={activos.filter((e) => e.id !== editando.id).map((e) => e.nombre)}
          onClose={() => setEditando(null)}
          onSaved={async () => { setEditando(null); await load(); }}
        />
      )}

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

type FormEmpleado = typeof FORM_INICIAL & { activo?: boolean };

function empleadoToForm(e: Empleado): FormEmpleado {
  return {
    nombre: e.nombre,
    tipo_documento: e.tipo_documento ?? "DNI",
    documento: e.documento ?? "",
    fecha_nacimiento: e.fecha_nacimiento ?? "",
    lugar_nacimiento: e.lugar_nacimiento ?? "",
    nacionalidad: e.nacionalidad ?? "Española",
    estado_civil: e.estado_civil ?? "",
    grupo_sanguineo: e.grupo_sanguineo ?? "",
    direccion: e.direccion ?? "",
    email: e.email ?? "",
    telefono: e.telefono ?? "",
    cargo: e.cargo ?? "",
    fecha_ingreso: e.fecha_ingreso ?? "",
    fecha_baja: e.fecha_baja ?? "",
    tipo_empleado: e.tipo_empleado ?? "CONTRATADO",
    tipo_periodo: e.tipo_periodo ?? "mensual",
    tipos_empleado: Array.isArray(e.tipos_empleado) ? e.tipos_empleado : [],
    sucursal: e.sucursal ?? "",
    chofer_habilitacion: e.chofer_habilitacion ?? "",
    chofer_fecha_venc: e.chofer_fecha_venc ?? "",
    chofer_km: e.chofer_km != null ? String(e.chofer_km) : "",
    chofer_observacion: e.chofer_observacion ?? "",
    departamento: e.departamento ?? "",
    seccion: e.seccion ?? "",
    supervisor: e.supervisor ?? "",
    salario_base: String(e.salario_base ?? 0),
    salario_complementario: String(e.salario_complementario ?? 0),
    costo_hora: String(e.costo_hora ?? 0),
    banco: e.banco ?? "",
    numero_cuenta: e.numero_cuenta ?? "",
    cobrar_con_cheque: !!e.cobrar_con_cheque,
    excluir_liquidaciones: !!e.excluir_liquidaciones,
    activo: e.activo,
  };
}

function EditarEmpleadoModal({
  empleado, supervisores = [], onClose, onSaved,
}: {
  empleado: Empleado;
  supervisores?: string[];
  onClose: () => void;
  onSaved: () => void | Promise<void>;
}) {
  const [form, setForm] = useState<FormEmpleado>(() => empleadoToForm(empleado));
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.nombre.trim()) return;
    setSaving(true);
    setErr(null);
    try {
      const r = await fetchWithSupabaseSession(`/api/rrhh/empleados/${empleado.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, nombre: form.nombre.trim() }),
      });
      const j = (await r.json().catch(() => ({}))) as { success?: boolean; error?: string };
      if (!r.ok || !j.success) {
        setErr(j.error ?? "No se pudo actualizar");
        return;
      }
      await onSaved();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" onClick={onClose}>
      <div className="w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white px-5 py-4">
          <h2 className="text-base font-semibold text-slate-900">Editar empleado</h2>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-700">✕</button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-6 p-5">
          {err && <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">{err}</div>}
          <EmpleadoFormFields form={form} setForm={setForm} editMode supervisores={supervisores} />
          <div className="flex justify-end gap-2 border-t border-slate-200 pt-4">
            <button type="button" onClick={onClose}
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm">Cancelar</button>
            <button type="submit" disabled={saving}
              className="rounded-lg bg-[#4FAEB2] px-3 py-2 text-sm font-medium text-white disabled:opacity-50">
              {saving ? "Guardando…" : "Guardar cambios"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Section({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500">{titulo}</h3>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">{children}</div>
    </section>
  );
}

/**
 * Selector de Departamento. Lee del catálogo configurable
 * (/api/rrhh/departamentos-catalogo). Conserva valores libres viejos:
 * si el `value` actual no está en el catálogo, lo muestra como opción
 * adicional para no perderlo silenciosamente.
 */
function DepartamentoSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [opts, setOpts] = useState<{ slug: string; nombre: string }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancel = false;
    setLoading(true);
    fetchWithSupabaseSession("/api/rrhh/departamentos-catalogo", { cache: "no-store" })
      .then((r) => r.json())
      .then((j: { success?: boolean; data?: { tipos?: { slug: string; nombre: string; activo: boolean; orden: number }[] } }) => {
        if (cancel) return;
        const list = (j.data?.tipos ?? [])
          .filter((t) => t.activo)
          .sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0))
          .map((t) => ({ slug: t.slug, nombre: t.nombre }));
        setOpts(list);
      })
      .catch(() => { /* tolerante */ })
      .finally(() => { if (!cancel) setLoading(false); });
    return () => { cancel = true; };
  }, []);

  // Reconciliar value libre: si el value es un nombre que no está en el catálogo,
  // lo mostramos como opción "huerfana" para que el usuario lo vea y pueda elegir
  // un departamento del catálogo sin perderlo por accidente.
  const valueEnCatalogo = !value || opts.some((o) => o.nombre === value);

  return (
    <select
      className={inputCls}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={loading}
    >
      <option value="">{loading ? "Cargando…" : "— Sin departamento —"}</option>
      {opts.map((o) => (
        <option key={o.slug} value={o.nombre}>{o.nombre}</option>
      ))}
      {!valueEnCatalogo && (
        <option value={value}>{value} (no en catálogo)</option>
      )}
    </select>
  );
}

/**
 * Combo de supervisor: input editable + dropdown filtrable.
 * Reemplaza el <datalist> nativo (poco confiable y no se abre al focus).
 * Acepta nombres libres (no obliga a elegir de la lista).
 */
function SupervisorPicker({
  value, onChange, opciones,
}: {
  value: string;
  onChange: (v: string) => void;
  opciones: string[];
}) {
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  const sugerencias = useMemo(() => {
    const q = value.trim().toLowerCase();
    if (!q) return opciones.slice(0, 12);
    return opciones.filter((n) => n.toLowerCase().includes(q)).slice(0, 12);
  }, [value, opciones]);

  return (
    <div ref={boxRef} className="relative">
      <input
        className={inputCls}
        value={value}
        onChange={(e) => { onChange(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        placeholder="Buscar empleado…"
        autoComplete="off"
      />
      {open && (sugerencias.length > 0 || value.trim().length > 0) && (
        <div className="absolute left-0 right-0 top-full z-20 mt-1 max-h-56 overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-lg">
          {sugerencias.length === 0 ? (
            <div className="px-3 py-2 text-xs text-slate-400">Sin coincidencias. Se guardará &quot;{value.trim()}&quot;.</div>
          ) : (
            sugerencias.map((nombre) => (
              <button
                key={nombre}
                type="button"
                onMouseDown={(e) => { e.preventDefault(); onChange(nombre); setOpen(false); }}
                className="block w-full px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
              >
                {nombre}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

function EmpleadoFormFields({
  form, setForm, editMode = false, supervisores = [],
}: {
  form: FormEmpleado;
  setForm: React.Dispatch<React.SetStateAction<FormEmpleado>>;
  editMode?: boolean;
  /** Nombres de empleados activos para el autocompletado de "Supervisor inmediato". */
  supervisores?: string[];
}) {
  function set<K extends keyof FormEmpleado>(k: K, v: FormEmpleado[K]) {
    setForm((s) => ({ ...s, [k]: v }));
  }
  return (
    <>
      <Section titulo="Datos personales">
        <Field label="Nombre completo" required>
          <input className={inputCls} value={form.nombre}
            onChange={(e) => set("nombre", e.target.value)} required />
        </Field>
        <Field label="Tipo de documento">
          <select className={inputCls} value={form.tipo_documento}
            onChange={(e) => set("tipo_documento", e.target.value)}>
            {TIPO_DOC_OPTS.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
        </Field>
        <Field label="Nro. documento">
          <input className={inputCls} value={form.documento}
            onChange={(e) => set("documento", e.target.value)} />
        </Field>
        <Field label="Fecha de nacimiento">
          <input type="date" className={inputCls} value={form.fecha_nacimiento}
            onChange={(e) => set("fecha_nacimiento", e.target.value)} />
        </Field>
        <Field label="Lugar de nacimiento">
          <input className={inputCls} value={form.lugar_nacimiento}
            onChange={(e) => set("lugar_nacimiento", e.target.value)} placeholder="Ej. Asunción" />
        </Field>
        <Field label="Nacionalidad">
          <input className={inputCls} value={form.nacionalidad}
            onChange={(e) => set("nacionalidad", e.target.value)} />
        </Field>
        <Field label="Estado civil">
          <select className={inputCls} value={form.estado_civil}
            onChange={(e) => set("estado_civil", e.target.value)}>
            <option value="">—</option>
            {ESTADO_CIVIL_OPTS.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
        </Field>
        <Field label="Grupo sanguíneo">
          <select className={inputCls} value={form.grupo_sanguineo}
            onChange={(e) => set("grupo_sanguineo", e.target.value)}>
            <option value="">—</option>
            {GRUPO_SANG_OPTS.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
        </Field>
      </Section>

      <Section titulo="Contacto">
        <Field label="Teléfono">
          <input className={inputCls} value={form.telefono}
            onChange={(e) => set("telefono", e.target.value)} placeholder="0981 000 000" />
        </Field>
        <Field label="E-mail">
          <input type="email" className={inputCls} value={form.email}
            onChange={(e) => set("email", e.target.value)} />
        </Field>
        <Field label="Dirección">
          <input className={inputCls} value={form.direccion}
            onChange={(e) => set("direccion", e.target.value)} />
        </Field>
      </Section>

      <Section titulo="Datos laborales">
        <Field label="Cargo">
          <input className={inputCls} value={form.cargo} placeholder="Ej. Albañil, Encargado, Soldador"
            onChange={(e) => set("cargo", e.target.value)} />
        </Field>
        <Field label="Tipo de contratación">
          <select className={inputCls} value={form.tipo_empleado}
            onChange={(e) => set("tipo_empleado", e.target.value)}>
            {TIPO_EMP_OPTS.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
        </Field>
        <Field label="Tipo de período">
          <select className={inputCls} value={form.tipo_periodo}
            onChange={(e) => set("tipo_periodo", e.target.value)}>
            {TIPO_PERIODO_OPTS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </Field>
        <Field label="Fecha de ingreso">
          <input type="date" className={inputCls} value={form.fecha_ingreso}
            onChange={(e) => set("fecha_ingreso", e.target.value)} />
        </Field>
        <Field label="Fecha de baja" hint="Dejá vacío si sigue activo.">
          <input type="date" className={inputCls} value={form.fecha_baja}
            onChange={(e) => set("fecha_baja", e.target.value)} />
        </Field>
        <Field label="Supervisor inmediato" hint="Buscá o escribí un nombre nuevo.">
          <SupervisorPicker
            value={form.supervisor}
            onChange={(v) => set("supervisor", v)}
            opciones={supervisores}
          />
        </Field>
        <Field label="Departamento" hint="Editá el listado en Configuración · Empleados.">
          <DepartamentoSelect
            value={form.departamento}
            onChange={(v) => set("departamento", v)}
          />
        </Field>
        <Field label="Sección / Equipo">
          <input className={inputCls} value={form.seccion}
            onChange={(e) => set("seccion", e.target.value)} placeholder="Ej. Cuadrilla A" />
        </Field>
      </Section>

      <TiposEmpleadoSection form={form} setForm={setForm} />

      <Section titulo="Compensación">
        <Field label="Salario base (€)">
          <MontoInput className={inputCls} decimals value={form.salario_base}
            onChange={(n) => set("salario_base", String(n))} placeholder="0" />
        </Field>
        <Field label="Salario complementario (€)" hint="Bonos, antigüedad, etc.">
          <MontoInput className={inputCls} decimals value={form.salario_complementario}
            onChange={(n) => set("salario_complementario", String(n))} placeholder="0" />
        </Field>
        <Field label="Costo por hora (€)" hint="Se usa para imputar mano de obra a las obras.">
          <MontoInput className={inputCls} decimals value={form.costo_hora}
            onChange={(n) => set("costo_hora", String(n))} placeholder="0" />
        </Field>
      </Section>

      <Section titulo="Bancario">
        <Field label="Banco">
          <input className={inputCls} value={form.banco}
            onChange={(e) => set("banco", e.target.value)} placeholder="Ej. Continental, Itaú" />
        </Field>
        <Field label="Nro. de cuenta">
          <input className={inputCls} value={form.numero_cuenta}
            onChange={(e) => set("numero_cuenta", e.target.value)} />
        </Field>
        <div className="md:col-span-2">
          <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
            <input type="checkbox" checked={form.cobrar_con_cheque}
              onChange={(e) => set("cobrar_con_cheque", e.target.checked)}
              className="h-4 w-4 rounded border-slate-300" />
            Cobra con cheque
          </label>
        </div>
      </Section>

      <Section titulo="Estado">
        {editMode && (
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
              <input type="checkbox" checked={!!form.activo}
                onChange={(e) => set("activo", e.target.checked)}
                className="h-4 w-4 rounded border-slate-300" />
              Empleado activo
            </label>
            <p className="ml-6 mt-1 text-xs text-slate-500">
              Los inactivos no aparecen en asignación a obras ni en nómina.
            </p>
          </div>
        )}
        <div>
          <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
            <input type="checkbox" checked={form.excluir_liquidaciones}
              onChange={(e) => set("excluir_liquidaciones", e.target.checked)}
              className="h-4 w-4 rounded border-slate-300" />
            Excluir de liquidaciones
          </label>
          <p className="ml-6 mt-1 text-xs text-slate-500">
            No suma al total devengado de la nómina mensual.
          </p>
        </div>
      </Section>
    </>
  );
}

// ── Sección "Tipos de empleado" + datos chofer ────────────────────────────
type TipoCat = { slug: string; nombre: string; activo: boolean; orden: number };

function TiposEmpleadoSection({
  form, setForm,
}: {
  form: FormEmpleado;
  setForm: React.Dispatch<React.SetStateAction<FormEmpleado>>;
}) {
  const [catalogo, setCatalogo] = useState<TipoCat[]>([]);
  const [loadingCat, setLoadingCat] = useState(true);
  const seleccionados = form.tipos_empleado ?? [];
  const esChofer = seleccionados.includes("chofer");

  useEffect(() => {
    let cancel = false;
    setLoadingCat(true);
    fetchWithSupabaseSession("/api/rrhh/tipos-empleado-catalogo", { cache: "no-store" })
      .then((r) => r.json())
      .then((j: { success?: boolean; data?: { tipos?: TipoCat[] } }) => {
        if (cancel) return;
        const tipos = (j.data?.tipos ?? []).filter((t) => t.activo);
        tipos.sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0));
        setCatalogo(tipos);
      })
      .catch(() => { /* tolerante: el form sigue, solo no muestra opciones */ })
      .finally(() => { if (!cancel) setLoadingCat(false); });
    return () => { cancel = true; };
  }, []);

  function toggle(slug: string) {
    setForm((s) => {
      const cur = s.tipos_empleado ?? [];
      const next = cur.includes(slug) ? cur.filter((x) => x !== slug) : [...cur, slug];
      return { ...s, tipos_empleado: next };
    });
  }

  function setField<K extends keyof FormEmpleado>(k: K, v: FormEmpleado[K]) {
    setForm((s) => ({ ...s, [k]: v }));
  }

  return (
    <section>
      <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Tipo(s) de empleado</h3>
      <p className="-mt-2 mb-3 text-xs text-slate-500">
        Roles operativos del empleado. Editá el catálogo en <Link href="/configuracion/tipos-empleado" className="underline">Configuración · Tipos de empleado</Link>.
      </p>
      {loadingCat ? (
        <p className="text-xs text-slate-400">Cargando catálogo…</p>
      ) : catalogo.length === 0 ? (
        <p className="text-xs text-slate-500">No hay tipos en el catálogo. Creá los roles desde Configuración.</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {catalogo.map((t) => {
            const sel = seleccionados.includes(t.slug);
            return (
              <button
                key={t.slug}
                type="button"
                onClick={() => toggle(t.slug)}
                className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                  sel
                    ? "border-[#4FAEB2] bg-[#4FAEB2]/10 text-[#3F8E91]"
                    : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                }`}
              >
                {sel ? "✓ " : ""}{t.nombre}
              </button>
            );
          })}
        </div>
      )}

      <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Field label="Sucursal" hint="Sucursal o sede donde trabaja el empleado.">
          <input className={inputCls} value={form.sucursal}
            onChange={(e) => setField("sucursal", e.target.value)} placeholder="Ej. Madrid Centro" />
        </Field>
      </div>

      {esChofer && (
        <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
          <h4 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Datos de chofer</h4>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            <Field label="Habilitación / carnet">
              <input className={inputCls} value={form.chofer_habilitacion}
                onChange={(e) => setField("chofer_habilitacion", e.target.value)} placeholder="Ej. C1 + CAP" />
            </Field>
            <Field label="Vencimiento">
              <input type="date" className={inputCls} value={form.chofer_fecha_venc}
                onChange={(e) => setField("chofer_fecha_venc", e.target.value)} />
            </Field>
            <Field label="Km" hint="Último km registrado.">
              <input type="number" className={inputCls} value={form.chofer_km}
                onChange={(e) => setField("chofer_km", e.target.value)} placeholder="0" />
            </Field>
            <div className="md:col-span-2 lg:col-span-3">
              <Field label="Observaciones">
                <textarea className={inputCls} rows={2} value={form.chofer_observacion}
                  onChange={(e) => setField("chofer_observacion", e.target.value)} />
              </Field>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
