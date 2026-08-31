"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import MontoInput from "@/components/ui/MontoInput";
import PageHeader from "@/components/ui/PageHeader";
import { getProductos } from "@/lib/inventario/storage";
import { fetchWithSupabaseSession } from "@/lib/api/fetch-with-supabase-session";
import type { Producto, TipoMovimiento, OrigenMovimiento } from "@/lib/inventario/types";

type EventoLite = { id: string; titulo: string };

export default function NuevoMovimientoPage() {
  const router = useRouter();
  const [productos, setProductos] = useState<Producto[]>([]);
  const [eventos, setEventos] = useState<EventoLite[]>([]);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    producto_id: "",
    tipo: "ENTRADA" as TipoMovimiento,
    cantidad: "",
    costo_unitario: "",
    origen: "compra" as OrigenMovimiento,
    proyecto_id: "",
  });

  useEffect(() => {
    let cancelled = false;
    getProductos().then((data) => {
      if (!cancelled) setProductos(data);
    });
    // Cargar eventos activos para el selector (opcional). En NCG Eventos los
    // 'proyectos' son eventos (bodas, cumpleaños, corporativos…).
    fetch("/api/eventos", { credentials: "include", cache: "no-store" })
      .then((r) => r.json())
      .then((j: { success?: boolean; data?: { eventos?: { id: string; titulo: string }[] } }) => {
        if (!cancelled && j.success) {
          const arr = j.data?.eventos ?? [];
          setEventos(arr.map((p) => ({ id: p.id, titulo: p.titulo })));
        }
      })
      .catch(() => { /* sin eventos: el select queda vacío */ });
    return () => { cancelled = true; };
  }, []);

  function handleProductoChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const id = e.target.value;
    const producto = productos.find((p) => p.id === id);
    setForm((prev) => ({
      ...prev,
      producto_id: id,
      costo_unitario: producto ? String(producto.costo_promedio) : "",
    }));
  }

  function handleChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  function handleTipoChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const tipo = e.target.value as TipoMovimiento;
    const origenSugerido: OrigenMovimiento =
      tipo === "ENTRADA" ? "compra" : tipo === "SALIDA" ? "venta" : "ajuste_manual";
    setForm((prev) => ({ ...prev, tipo, origen: origenSugerido }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const productoSeleccionado = productos.find((p) => p.id === form.producto_id);
    if (!productoSeleccionado) {
      setError("Elegí un producto de la lista.");
      return;
    }
    const rawCant = parseFloat(form.cantidad);
    if (!Number.isFinite(rawCant) || rawCant === 0) {
      setError("La cantidad no puede quedar vacía ni ser 0.");
      return;
    }

    const cantidadNum = form.tipo === "AJUSTE" ? rawCant : Math.abs(rawCant);

    setGuardando(true);
    try {
      const r = await fetchWithSupabaseSession("/api/inventario/movimientos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          producto_id: productoSeleccionado.id,
          tipo: form.tipo,
          cantidad: cantidadNum,
          costo_unitario: parseFloat(form.costo_unitario) || 0,
          origen: form.origen,
          proyecto_id: form.proyecto_id || null,
        }),
      });
      const j = (await r.json().catch(() => ({}))) as { success?: boolean; error?: string };
      if (r.ok && j.success) {
        router.push("/inventario/movimientos");
      } else {
        setError(j.error ?? `Error ${r.status}: no se pudo guardar el movimiento.`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado al guardar.");
    } finally {
      setGuardando(false);
    }
  }

  const productoSeleccionado = productos.find((p) => p.id === form.producto_id);

  const inputClass =
    "w-full border border-gray-300 rounded-lg px-4 py-3 outline-none focus:border-gray-500 transition-colors text-sm";
  const labelClass = "block text-sm font-medium text-gray-700 mb-2";

  return (
    <div className="space-y-8">

      <PageHeader
        eyebrow="NCG · Stock"
        title="Nuevo movimiento"
        description="Registra una entrada, salida o ajuste de stock"
        backHref="/inventario/movimientos"
        backLabel="Movimientos"
      />

      <div className="bg-white rounded-xl shadow-sm ring-1 ring-[#4FAEB2]/10 border border-slate-200 p-6 max-w-2xl">
        <form className="space-y-6" onSubmit={handleSubmit}>

          {/* Producto */}
          <div>
            <label className={labelClass}>Producto</label>
            <select
              name="producto_id"
              value={form.producto_id}
              onChange={handleProductoChange}
              className={inputClass}
              required
            >
              <option value="">Seleccionar producto...</option>
              {productos.map((p) => (
                <option key={p.id} value={String(p.id)}>
                  {p.nombre} — {p.sku} (stock actual: {p.stock_actual})
                </option>
              ))}
            </select>
          </div>

          {/* Tipo + Origen */}
          <div className="grid grid-cols-2 gap-6">
            <div>
              <label className={labelClass}>Tipo de movimiento</label>
              <select
                name="tipo"
                value={form.tipo}
                onChange={handleTipoChange}
                className={inputClass}
              >
                <option value="ENTRADA">ENTRADA — aumenta stock</option>
                <option value="SALIDA">SALIDA — disminuye stock</option>
                <option value="AJUSTE">AJUSTE — corrección manual</option>
              </select>
            </div>

            <div>
              <label className={labelClass}>Origen</label>
              <select
                name="origen"
                value={form.origen}
                onChange={handleChange}
                className={inputClass}
              >
                <option value="compra">Compra</option>
                <option value="venta">Venta</option>
                <option value="ajuste_manual">Ajuste manual</option>
              </select>
            </div>
          </div>

          {/* Evento al que se imputa el movimiento (opcional, recomendado en
              SALIDAS para que el costo y materiales se sumen por evento). */}
          <div>
            <label className={labelClass}>
              Evento
              {form.tipo === "SALIDA" && (
                <span className="ml-2 text-xs text-amber-600 font-normal">
                  (recomendado para imputar materiales al evento)
                </span>
              )}
            </label>
            <select
              name="proyecto_id"
              value={form.proyecto_id}
              onChange={handleChange}
              className={inputClass}
            >
              <option value="">Sin evento asociado</option>
              {eventos.map((p) => (
                <option key={p.id} value={p.id}>{p.titulo}</option>
              ))}
            </select>
          </div>

          {/* Cantidad + Costo unitario */}
          <div className="grid grid-cols-2 gap-6">
            <div>
              <label className={labelClass}>
                Cantidad
                {form.tipo === "AJUSTE" && (
                  <span className="ml-2 text-xs text-gray-400 font-normal">
                    (negativo para disminuir)
                  </span>
                )}
              </label>
              <input
                type="number"
                name="cantidad"
                value={form.cantidad}
                onChange={handleChange}
                placeholder={form.tipo === "AJUSTE" ? "Ej: -3 o +5" : "Ej: 10"}
                className={inputClass}
                step="1"
                required
              />
            </div>

            <div>
              <label className={labelClass}>Costo unitario (€)</label>
              <MontoInput
                value={form.costo_unitario}
                onChange={(n) => setForm((prev) => ({ ...prev, costo_unitario: String(n) }))}
                placeholder="Ej: 35000"
                className={inputClass}
                decimals
                required
              />
            </div>
          </div>

          {/* Nota de fecha automática */}
          <p className="text-xs text-gray-400">
            La fecha y hora del movimiento se registrarán automáticamente al guardar.
          </p>

          {/* Vista previa del impacto en stock */}
          {productoSeleccionado && form.cantidad !== "" && (
            <div className="rounded-lg border border-gray-200 p-4 bg-gray-50 text-sm space-y-1">
              <p className="font-medium text-gray-700 mb-2">Vista previa del impacto</p>
              <div className="flex justify-between text-gray-600">
                <span>Stock actual</span>
                <span className="font-semibold tabular-nums">
                  {productoSeleccionado.stock_actual} uds.
                </span>
              </div>
              <div className="flex justify-between text-gray-600">
                <span>Movimiento ({form.tipo})</span>
                <span className={`font-semibold tabular-nums ${
                  form.tipo === "ENTRADA"
                    ? "text-green-600"
                    : form.tipo === "SALIDA"
                    ? "text-red-600"
                    : "text-yellow-600"
                }`}>
                  {form.tipo === "ENTRADA" ? "+" : form.tipo === "SALIDA" ? "−" : ""}
                  {form.tipo !== "AJUSTE"
                    ? Math.abs(parseFloat(form.cantidad) || 0)
                    : parseFloat(form.cantidad) || 0}{" "}
                  uds.
                </span>
              </div>
              <div className="border-t pt-2 flex justify-between font-semibold text-gray-800">
                <span>Stock resultante</span>
                <span className="tabular-nums">
                  {Math.max(
                    0,
                    form.tipo === "ENTRADA"
                      ? productoSeleccionado.stock_actual + Math.abs(parseFloat(form.cantidad) || 0)
                      : form.tipo === "SALIDA"
                      ? productoSeleccionado.stock_actual - Math.abs(parseFloat(form.cantidad) || 0)
                      : productoSeleccionado.stock_actual + (parseFloat(form.cantidad) || 0)
                  )}{" "}
                  uds.
                </span>
              </div>
            </div>
          )}

          {/* Error visible */}
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}

          {/* Acciones */}
          <div className="flex gap-4 pt-2">
            <button
              type="submit"
              disabled={guardando}
              className="bg-gray-900 text-white px-5 py-3 rounded-lg text-sm hover:bg-gray-700 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {guardando ? "Guardando…" : "Guardar movimiento"}
            </button>
            <button
              type="button"
              onClick={() => router.push("/inventario/movimientos")}
              disabled={guardando}
              className="border border-gray-300 px-5 py-3 rounded-lg text-sm hover:bg-gray-50 transition-colors disabled:opacity-60"
            >
              Cancelar
            </button>
          </div>

        </form>
      </div>

    </div>
  );
}
