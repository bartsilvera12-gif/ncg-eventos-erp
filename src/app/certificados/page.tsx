"use client";

import { useEffect, useState } from "react";
import PageHeader from "@/components/ui/PageHeader";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import {
  deleteCertificado,
  getCertificados,
  saveCertificado,
} from "@/lib/certificados/storage";
import {
  estadoVencimiento,
  type CategoriaCertificado,
  type Certificado,
} from "@/lib/certificados/types";
import { supabase } from "@/lib/supabase";

const CATEGORIAS: CategoriaCertificado[] = [
  "habilitacion", "seguro", "certificado", "licencia",
  "permiso", "contrato", "otro",
];
const inputClass =
  "rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#0EA5E9]";

interface FormState {
  nombre: string;
  categoria: CategoriaCertificado;
  emitido_por: string;
  numero: string;
  fecha_emision: string;
  fecha_vencimiento: string;
  alerta_dias_antes: string;
  descripcion: string;
}
const initial: FormState = {
  nombre: "",
  categoria: "otro",
  emitido_por: "",
  numero: "",
  fecha_emision: "",
  fecha_vencimiento: "",
  alerta_dias_antes: "30",
  descripcion: "",
};

function fmtFecha(iso?: string | null) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("es-PY");
  } catch {
    return iso;
  }
}

interface ArchivoDraft {
  storage_path: string;
  nombre: string;
  mime: string;
  tamano: number;
}

export default function CertificadosPage() {
  const [lista, setLista] = useState<Certificado[]>([]);
  const [cargando, setCargando] = useState(true);
  const [form, setForm] = useState<FormState>(initial);
  const [archivo, setArchivo] = useState<ArchivoDraft | null>(null);
  const [subiendo, setSubiendo] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [mostrarForm, setMostrarForm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cargar = async () => {
    setCargando(true);
    setLista(await getCertificados());
    setCargando(false);
  };

  useEffect(() => {
    cargar();
  }, []);

  const onSubirArchivo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadError(null);
    setSubiendo(true);
    try {
      const ext = file.name.split(".").pop() ?? "bin";
      const path = `certificados/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("certificados")
        .upload(path, file, { cacheControl: "3600", upsert: false });
      if (upErr) throw upErr;
      setArchivo({
        storage_path: path,
        nombre: file.name,
        mime: file.type,
        tamano: file.size,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error al subir";
      setUploadError(msg + " (¿existe el bucket 'certificados' en Supabase Storage?)");
    } finally {
      setSubiendo(false);
    }
  };

  const onGuardar = async () => {
    setError(null);
    if (!form.nombre.trim()) return setError("Cargá el nombre.");
    const c = await saveCertificado({
      nombre: form.nombre.trim(),
      categoria: form.categoria,
      emitido_por: form.emitido_por || null,
      numero: form.numero || null,
      fecha_emision: form.fecha_emision || null,
      fecha_vencimiento: form.fecha_vencimiento || null,
      alerta_dias_antes: parseInt(form.alerta_dias_antes) || 30,
      descripcion: form.descripcion || null,
      storage_path: archivo?.storage_path ?? null,
      archivo_nombre: archivo?.nombre ?? null,
      archivo_mime: archivo?.mime ?? null,
      archivo_tamano: archivo?.tamano ?? null,
    });
    if (!c) return setError("No se pudo guardar.");
    setForm(initial);
    setArchivo(null);
    setMostrarForm(false);
    await cargar();
  };

  const descargarArchivo = async (c: Certificado) => {
    if (!c.storage_path) return;
    const bucket = c.storage_bucket ?? "certificados";
    const { data, error: sErr } = await supabase.storage
      .from(bucket)
      .createSignedUrl(c.storage_path, 60);
    if (sErr || !data?.signedUrl) return;
    window.open(data.signedUrl, "_blank");
  };

  const porVencer = lista.filter((c) => estadoVencimiento(c) === "por_vencer");
  const vencidos = lista.filter((c) => estadoVencimiento(c) === "vencido");

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-8 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <PageHeader
          eyebrow="NCG · Empresa"
          title="Certificados y permisos"
          description="Habilitaciones, seguros, licencias y permisos de la empresa. Alerta antes del vencimiento."
          actions={
            <Button
              variant="primary"
              size="sm"
              onClick={() => setMostrarForm((v) => !v)}
            >
              {mostrarForm ? "Cerrar" : "+ Nuevo"}
            </Button>
          }
        />

        {(porVencer.length > 0 || vencidos.length > 0) && (
          <div className="mt-4 flex flex-wrap gap-2">
            {vencidos.length > 0 && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                <strong>{vencidos.length}</strong> vencido{vencidos.length > 1 ? "s" : ""}
              </div>
            )}
            {porVencer.length > 0 && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
                <strong>{porVencer.length}</strong> por vencer
              </div>
            )}
          </div>
        )}

        {mostrarForm && (
          <div className="mt-4 space-y-3 rounded-xl border border-slate-200 bg-white p-4">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <input
                type="text"
                placeholder="Nombre del certificado"
                value={form.nombre}
                onChange={(e) => setForm((p) => ({ ...p, nombre: e.target.value }))}
                className={inputClass + " md:col-span-2"}
              />
              <select
                value={form.categoria}
                onChange={(e) =>
                  setForm((p) => ({ ...p, categoria: e.target.value as CategoriaCertificado }))
                }
                className={inputClass}
              >
                {CATEGORIAS.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>

              <input
                type="text"
                placeholder="Emitido por"
                value={form.emitido_por}
                onChange={(e) => setForm((p) => ({ ...p, emitido_por: e.target.value }))}
                className={inputClass}
              />
              <input
                type="text"
                placeholder="Nº certificado"
                value={form.numero}
                onChange={(e) => setForm((p) => ({ ...p, numero: e.target.value }))}
                className={inputClass}
              />
              <input
                type="number"
                min={1}
                placeholder="Alerta N días antes"
                value={form.alerta_dias_antes}
                onChange={(e) => setForm((p) => ({ ...p, alerta_dias_antes: e.target.value }))}
                className={inputClass}
              />

              <label className="flex flex-col gap-1 text-xs text-slate-500">
                Emisión
                <input
                  type="date"
                  value={form.fecha_emision}
                  onChange={(e) => setForm((p) => ({ ...p, fecha_emision: e.target.value }))}
                  className={inputClass}
                />
              </label>
              <label className="flex flex-col gap-1 text-xs text-slate-500">
                Vencimiento
                <input
                  type="date"
                  value={form.fecha_vencimiento}
                  onChange={(e) => setForm((p) => ({ ...p, fecha_vencimiento: e.target.value }))}
                  className={inputClass}
                />
              </label>
              <textarea
                placeholder="Observaciones"
                value={form.descripcion}
                onChange={(e) => setForm((p) => ({ ...p, descripcion: e.target.value }))}
                className={inputClass + " md:col-span-3"}
                rows={2}
              />

              {/* Archivo adjunto opcional. Se sube al bucket 'certificados' de
                  Supabase Storage; el registro en DB guarda solo la ruta. */}
              <div className="md:col-span-3">
                <p className="mb-1 text-xs font-medium uppercase tracking-wider text-slate-500">
                  Archivo adjunto (opcional)
                </p>
                {archivo ? (
                  <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
                    <span className="truncate text-slate-700">📎 {archivo.nombre}</span>
                    <button
                      type="button"
                      onClick={() => setArchivo(null)}
                      className="ml-2 text-xs text-red-600 hover:underline"
                    >
                      Quitar
                    </button>
                  </div>
                ) : (
                  <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50">
                    {subiendo ? "Subiendo…" : "Subir archivo (PDF/imagen)"}
                    <input
                      type="file"
                      accept="image/*,application/pdf"
                      className="hidden"
                      disabled={subiendo}
                      onChange={onSubirArchivo}
                    />
                  </label>
                )}
                {uploadError && (
                  <p className="mt-1 text-xs text-red-600">{uploadError}</p>
                )}
              </div>
            </div>

            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                {error}
              </div>
            )}

            <div className="flex justify-end gap-2">
              <Button variant="secondary" size="sm" onClick={() => setMostrarForm(false)}>
                Cancelar
              </Button>
              <Button variant="primary" size="sm" onClick={onGuardar}>
                Guardar
              </Button>
            </div>
          </div>
        )}

        <div className="mt-4 overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-gradient-to-r from-slate-50 via-teal-50/30 to-slate-50 text-left text-xs uppercase tracking-wider text-slate-600 border-b border-slate-200">
              <tr>
                <th className="px-4 py-3">Nombre</th>
                <th className="px-4 py-3">Categoría</th>
                <th className="px-4 py-3">Emitido por</th>
                <th className="px-4 py-3">Emisión</th>
                <th className="px-4 py-3">Vencimiento</th>
                <th className="px-4 py-3">Estado</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {cargando ? (
                <tr>
                  <td colSpan={7} className="px-4 py-6 text-center text-slate-400">
                    Cargando…
                  </td>
                </tr>
              ) : lista.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-6 text-center text-slate-400">
                    Sin certificados cargados.
                  </td>
                </tr>
              ) : (
                lista.map((c) => {
                  const estado = estadoVencimiento(c);
                  const tone: "neutral" | "success" | "warning" | "danger" =
                    estado === "vencido"
                      ? "danger"
                      : estado === "por_vencer"
                      ? "warning"
                      : estado === "vigente"
                      ? "success"
                      : "neutral";
                  return (
                    <tr key={c.id} className="border-t border-slate-100">
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-800">{c.nombre}</div>
                        {c.numero && (
                          <div className="text-xs text-slate-400">Nº {c.numero}</div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <Badge tone="primary">{c.categoria}</Badge>
                      </td>
                      <td className="px-4 py-3 text-slate-600">{c.emitido_por ?? "—"}</td>
                      <td className="px-4 py-3 text-slate-600">{fmtFecha(c.fecha_emision)}</td>
                      <td className="px-4 py-3 text-slate-600">{fmtFecha(c.fecha_vencimiento)}</td>
                      <td className="px-4 py-3">
                        <Badge tone={tone}>
                          {estado === "sin_fecha"
                            ? "sin fecha"
                            : estado.replace("_", " ")}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-right">
                        {c.storage_path && (
                          <button
                            onClick={() => descargarArchivo(c)}
                            className="mr-2 text-xs text-[#0EA5E9] hover:underline"
                          >
                            Ver archivo
                          </button>
                        )}
                        <button
                          onClick={async () => {
                            if (!confirm("¿Eliminar certificado?")) return;
                            await deleteCertificado(c.id);
                            await cargar();
                          }}
                          className="text-xs text-red-600 hover:underline"
                        >
                          Eliminar
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
