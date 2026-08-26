"use client";

import { useEffect, useState } from "react";
import Button from "@/components/ui/Button";
import { deleteRecurso, getRecursos, saveRecurso, updateRecurso } from "@/lib/eventos/storage";
import type { Recurso, TipoRecurso } from "@/lib/eventos/types";

const TIPOS: TipoRecurso[] = ["salon", "jardin", "terraza", "escenario", "otro"];
const inputClass =
  "rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#0EA5E9]";

export default function RecursosPanel() {
  const [lista, setLista] = useState<Recurso[]>([]);
  const [cargando, setCargando] = useState(true);
  const [form, setForm] = useState<{ nombre: string; tipo: TipoRecurso; capacidad: string }>({
    nombre: "",
    tipo: "salon",
    capacidad: "",
  });
  const [editando, setEditando] = useState<string | null>(null);

  const cargar = async () => {
    setCargando(true);
    setLista(await getRecursos());
    setCargando(false);
  };

  useEffect(() => {
    cargar();
  }, []);

  const onGuardar = async () => {
    if (!form.nombre.trim()) return;
    const payload = {
      nombre: form.nombre.trim(),
      tipo: form.tipo,
      capacidad: form.capacidad ? parseInt(form.capacidad) : null,
    };
    if (editando) await updateRecurso(editando, payload);
    else await saveRecurso(payload);
    setForm({ nombre: "", tipo: "salon", capacidad: "" });
    setEditando(null);
    await cargar();
  };

  const onEditar = (r: Recurso) => {
    setEditando(r.id);
    setForm({ nombre: r.nombre, tipo: r.tipo, capacidad: r.capacidad?.toString() ?? "" });
  };

  const onBorrar = async (id: string) => {
    if (!confirm("¿Eliminar recurso?")) return;
    await deleteRecurso(id);
    await cargar();
  };

  return (
    <div>
      <div className="grid grid-cols-1 gap-3 rounded-xl border border-slate-200 bg-white p-4 md:grid-cols-4">
        <input
          type="text"
          placeholder="Nombre"
          value={form.nombre}
          onChange={(e) => setForm((p) => ({ ...p, nombre: e.target.value }))}
          className={inputClass + " md:col-span-2"}
        />
        <select
          value={form.tipo}
          onChange={(e) => setForm((p) => ({ ...p, tipo: e.target.value as TipoRecurso }))}
          className={inputClass}
        >
          {TIPOS.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <input
          type="number"
          placeholder="Capacidad"
          value={form.capacidad}
          onChange={(e) => setForm((p) => ({ ...p, capacidad: e.target.value }))}
          className={inputClass}
        />
        <div className="md:col-span-4 flex justify-end gap-2">
          {editando && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                setEditando(null);
                setForm({ nombre: "", tipo: "salon", capacidad: "" });
              }}
            >
              Cancelar
            </Button>
          )}
          <Button variant="primary" size="sm" onClick={onGuardar}>
            {editando ? "Guardar cambios" : "+ Agregar"}
          </Button>
        </div>
      </div>

      <div className="mt-4 overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-gradient-to-r from-slate-50 via-teal-50/30 to-slate-50 text-left text-xs uppercase tracking-wider text-slate-600 border-b border-slate-200">
            <tr>
              <th className="px-4 py-3">Nombre</th>
              <th className="px-4 py-3">Tipo</th>
              <th className="px-4 py-3 text-right">Capacidad</th>
              <th className="px-4 py-3">Estado</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {cargando ? (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-slate-400">
                  Cargando…
                </td>
              </tr>
            ) : lista.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-slate-400">
                  Sin recursos cargados.
                </td>
              </tr>
            ) : (
              lista.map((r) => (
                <tr key={r.id} className="border-t border-slate-100">
                  <td className="px-4 py-3 font-medium text-slate-800">{r.nombre}</td>
                  <td className="px-4 py-3 text-slate-600 capitalize">{r.tipo}</td>
                  <td className="px-4 py-3 text-right text-slate-600">{r.capacidad ?? "—"}</td>
                  <td className="px-4 py-3 text-xs">{r.activo ? "activo" : "inactivo"}</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => onEditar(r)}
                      className="mr-2 text-xs text-[#0EA5E9] hover:underline"
                    >
                      Editar
                    </button>
                    <button
                      onClick={() => onBorrar(r.id)}
                      className="text-xs text-red-600 hover:underline"
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
