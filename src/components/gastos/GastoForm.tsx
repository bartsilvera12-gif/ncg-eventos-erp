"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createGasto, updateGasto } from "@/lib/gastos/actions";
import MontoInput from "@/components/ui/MontoInput";
import { getEventos } from "@/lib/eventos/storage";
import { supabase } from "@/lib/supabase";
import type { Gasto, GastoInput } from "@/lib/gastos/actions";
import type { Evento } from "@/lib/eventos/types";

const fLabel = "block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1";
const fInput =
  "w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0EA5E9] bg-white";

type Props = {
  gasto?: Gasto | null;
  onSuccess?: () => void;
};

export default function GastoForm({ gasto, onSuccess }: Props) {
  const router = useRouter();
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState<GastoInput>({
    categoria: gasto?.categoria ?? "",
    descripcion: gasto?.descripcion ?? "",
    monto: gasto?.monto ?? 0,
    tipo: gasto?.tipo ?? "variable",
    recurrente: gasto?.recurrente ?? false,
    frecuencia: gasto?.frecuencia ?? "",
    fecha: gasto?.fecha ?? new Date().toISOString().slice(0, 10),
    proyecto_id: gasto?.proyecto_id ?? null,
    comprobante_path: gasto?.comprobante_path ?? null,
    comprobante_nombre: gasto?.comprobante_nombre ?? null,
    comprobante_mime: gasto?.comprobante_mime ?? null,
  });

  const [eventos, setEventos] = useState<Evento[]>([]);
  const [subiendoComp, setSubiendoComp] = useState(false);
  const [compError, setCompError] = useState<string | null>(null);

  // Carga lazy de eventos para el dropdown (solo el primer render).
  useEffect(() => {
    let cancel = false;
    getEventos()
      .then((d) => {
        if (!cancel) setEventos(d);
      })
      .catch(() => {});
    return () => {
      cancel = true;
    };
  }, []);

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) {
    const { name, value, type } = e.target;
    if (type === "checkbox") {
      setForm((prev) => ({ ...prev, recurrente: (e.target as HTMLInputElement).checked }));
    } else if (name === "proyecto_id") {
      setForm((prev) => ({ ...prev, proyecto_id: value || null }));
    } else if (name !== "monto") {
      const normalized = ["categoria", "descripcion", "frecuencia"].includes(name) ? value.toUpperCase() : value;
      setForm((prev) => ({ ...prev, [name]: normalized }));
    }
  }

  async function handleComprobante(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setCompError(null);
    setSubiendoComp(true);
    try {
      const ext = file.name.split(".").pop() ?? "bin";
      const path = `gastos/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("gastos")
        .upload(path, file, { cacheControl: "3600", upsert: false });
      if (upErr) throw upErr;
      setForm((prev) => ({
        ...prev,
        comprobante_path: path,
        comprobante_nombre: file.name,
        comprobante_mime: file.type,
      }));
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error al subir";
      setCompError(msg + " (¿existe el bucket 'gastos'?)");
    } finally {
      setSubiendoComp(false);
    }
  }

  function quitarComprobante() {
    setForm((prev) => ({
      ...prev,
      comprobante_path: null,
      comprobante_nombre: null,
      comprobante_mime: null,
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (form.monto <= 0) {
      return setError("El monto debe ser mayor a 0.");
    }

    setGuardando(true);

    try {
      if (gasto) {
        await updateGasto(gasto.id, form);
      } else {
        await createGasto(form);
      }
      onSuccess?.();
      router.push("/gastos");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error al guardar");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-2xl">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
          {error}
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
        <div className="flex items-center gap-2 mb-5 pb-2 border-b border-slate-200">
          <span className="text-base">📋</span>
          <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider">
            Datos del gasto
          </h3>
        </div>
        <div className="space-y-4">
          <div>
            <label className={fLabel}>Categoría</label>
            <input
              type="text"
              name="categoria"
              value={form.categoria}
              onChange={handleChange}
              placeholder="Ej: Servicios, Alquiler, Salarios"
              className={fInput}
            />
          </div>
          <div>
            <label className={fLabel}>Descripción</label>
            <textarea
              name="descripcion"
              value={form.descripcion}
              onChange={handleChange}
              placeholder="Descripción del gasto"
              className={fInput}
              rows={2}
            />
          </div>
          <div>
            <label className={fLabel}>Monto (€) *</label>
            <MontoInput
              value={form.monto}
              onChange={(n) => setForm((prev) => ({ ...prev, monto: n }))}
              placeholder="0"
              className={fInput}
              required
            />
          </div>
          <div>
            <label className={fLabel}>Tipo</label>
            <select
              name="tipo"
              value={form.tipo}
              onChange={handleChange}
              className={fInput}
            >
              <option value="variable">Variable</option>
              <option value="fijo">Fijo</option>
            </select>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="recurrente"
              name="recurrente"
              checked={form.recurrente}
              onChange={handleChange}
              className="rounded border-slate-300 text-[#0EA5E9] focus:ring-[#0EA5E9]"
            />
            <label htmlFor="recurrente" className="text-sm text-slate-700">
              Gasto recurrente
            </label>
          </div>
          {form.recurrente && (
            <div>
              <label className={fLabel}>Frecuencia</label>
              <input
                type="text"
                name="frecuencia"
                value={form.frecuencia ?? ""}
                onChange={handleChange}
                placeholder="Ej: Mensual, Semanal"
                className={fInput}
              />
            </div>
          )}
          <div>
            <label className={fLabel}>Fecha *</label>
            <input
              type="date"
              name="fecha"
              value={form.fecha}
              onChange={handleChange}
              className={fInput}
              required
            />
          </div>

          {/* Evento asociado (opcional) — el gasto queda imputado al evento
              para el cálculo de rentabilidad. */}
          <div>
            <label className={fLabel}>Evento asociado (opcional)</label>
            <select
              name="proyecto_id"
              value={form.proyecto_id ?? ""}
              onChange={handleChange}
              className={fInput}
            >
              <option value="">Sin evento</option>
              {eventos.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.titulo}
                  {e.fecha_evento ? ` — ${e.fecha_evento}` : ""}
                </option>
              ))}
            </select>
          </div>

          {/* Comprobante (opcional) — sube al bucket 'gastos' de Supabase Storage. */}
          <div>
            <label className={fLabel}>Comprobante (opcional)</label>
            {form.comprobante_path ? (
              <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
                <span className="truncate text-slate-700">
                  📎 {form.comprobante_nombre ?? form.comprobante_path}
                </span>
                <button
                  type="button"
                  onClick={quitarComprobante}
                  className="ml-2 text-xs text-red-600 hover:underline"
                >
                  Quitar
                </button>
              </div>
            ) : (
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50">
                {subiendoComp ? "Subiendo…" : "Subir archivo"}
                <input
                  type="file"
                  accept="image/*,application/pdf"
                  className="hidden"
                  disabled={subiendoComp}
                  onChange={handleComprobante}
                />
              </label>
            )}
            {compError && (
              <p className="mt-1 text-xs text-red-600">{compError}</p>
            )}
          </div>
        </div>
      </div>

      <div className="flex gap-4">
        <button
          type="submit"
          disabled={guardando}
          className="bg-[#0EA5E9] hover:bg-[#0284C7] text-white text-sm font-semibold px-6 py-2.5 rounded-lg transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {guardando ? "Guardando…" : gasto ? "Guardar cambios" : "Crear gasto"}
        </button>
        <button
          type="button"
          onClick={() => router.push("/gastos")}
          className="border border-slate-200 text-sm px-6 py-2.5 rounded-lg hover:bg-slate-50 transition-colors"
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}
