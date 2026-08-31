"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { getMovimientos } from "@/lib/inventario/storage";
import PageHeader from "@/components/ui/PageHeader";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { fetchWithSupabaseSession } from "@/lib/api/fetch-with-supabase-session";
import type { MovimientoInventario, TipoMovimiento, OrigenMovimiento } from "@/lib/inventario/types";


const origenLabel: Record<OrigenMovimiento, string> = {
  compra: "Compra",
  venta: "Venta",
  ajuste_manual: "Ajuste manual",
  inventario_inicial: "Inventario inicial",
};

const MOTIVO_LABEL: Record<string, string> = {
  uso_obra: "Uso en obra",
  consumo_interno: "Consumo interno",
  rotura: "Rotura / pérdida",
  ajuste: "Ajuste de inventario",
  entrega_cuadrilla: "Entrega a cuadrilla",
  transferencia_vehiculo: "Transferencia a vehículo",
};

const origenBadge: Record<OrigenMovimiento, string> = {
  compra: "bg-blue-50 text-blue-600",
  venta: "bg-purple-50 text-purple-600",
  ajuste_manual: "bg-gray-100 text-gray-600",
  inventario_inicial: "bg-orange-50 text-orange-600",
};

function formatGs(valor: number) {
  return `€ ${valor.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatFecha(iso: string) {
  try {
    const d = new Date(iso);
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const yyyy = d.getFullYear();
    const hh = String(d.getHours()).padStart(2, "0");
    const min = String(d.getMinutes()).padStart(2, "0");
    return `${dd}/${mm}/${yyyy}, ${hh}:${min}`;
  } catch {
    return iso;
  }
}

const inputFilterClass =
  "border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-gray-400 transition-colors bg-white";

export default function MovimientosPage() {
  const searchParams = useSearchParams();
  const productoFiltro = searchParams?.get("producto") ?? "";
  const [todos, setTodos] = useState<MovimientoInventario[]>([]);

  // Filtros
  const [busqueda, setBusqueda] = useState("");
  const [filtroTipo, setFiltroTipo] = useState<TipoMovimiento | "">("");
  const [filtroOrigen, setFiltroOrigen] = useState<OrigenMovimiento | "">("");
  const [fechaDesde, setFechaDesde] = useState("");  // "YYYY-MM-DD"
  const [fechaHasta, setFechaHasta] = useState(""); // "YYYY-MM-DD"
  const [movAEliminar, setMovAEliminar] = useState<MovimientoInventario | null>(null);
  const [eliminando, setEliminando] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    getMovimientos().then((data) => {
      if (!cancelled) setTodos(data);
    });
    return () => { cancelled = true; };
  }, [refreshKey]);

  async function eliminarMovimiento() {
    if (!movAEliminar) return;
    setEliminando(true);
    try {
      const r = await fetchWithSupabaseSession(`/api/inventario/movimientos/${movAEliminar.id}`, {
        method: "DELETE",
      });
      const j = (await r.json().catch(() => ({}))) as { success?: boolean; error?: string };
      if (r.ok && j.success) {
        setTodos((prev) => prev.filter((x) => x.id !== movAEliminar.id));
        setMovAEliminar(null);
        setRefreshKey((k) => k + 1);
      } else {
        window.alert(j.error ?? `Error ${r.status}`);
      }
    } finally {
      setEliminando(false);
    }
  }

  const filtrados = todos.filter((m) => {
    const texto = busqueda.toLowerCase();
    const coincideTexto =
      texto === "" ||
      m.producto_nombre.toLowerCase().includes(texto) ||
      m.producto_sku.toLowerCase().includes(texto);
    const coincideTipo = filtroTipo === "" || m.tipo === filtroTipo;
    const coincideOrigen = filtroOrigen === "" || m.origen === filtroOrigen;
    const coincideProducto = productoFiltro === "" || m.producto_id === productoFiltro;

    // Compara solo la parte de fecha (YYYY-MM-DD) del ISO string del movimiento
    const fechaMov = m.fecha.slice(0, 10); // "YYYY-MM-DD"
    const coincideDesde = fechaDesde === "" || fechaMov >= fechaDesde;
    const coincideHasta = fechaHasta === "" || fechaMov <= fechaHasta;

    return coincideTexto && coincideTipo && coincideOrigen && coincideProducto && coincideDesde && coincideHasta;
  });
  const nombreProductoFiltrado = productoFiltro
    ? todos.find((m) => m.producto_id === productoFiltro)?.producto_nombre ?? null
    : null;

  return (
    <div className="space-y-8">

      <PageHeader
        eyebrow="NCG · Stock"
        title="Movimientos de inventario"
        description="Registro de entradas, salidas y ajustes de stock"
        actions={
          <Button href="/inventario/movimientos/nuevo" variant="secondary" size="sm">
            <span aria-hidden>+</span> Nuevo movimiento
          </Button>
        }
      />

      <div className="bg-white border border-slate-200 rounded-xl shadow-sm ring-1 ring-[#4FAEB2]/10 p-6">

        {/* Header */}
        <div className="flex items-center gap-3 mb-5 flex-wrap">
          <h2 className="text-base font-semibold text-slate-800">Historial</h2>
          <span className="text-sm text-gray-400">
            {filtrados.length} de {todos.length} registros
          </span>
          {productoFiltro && (
            <span className="inline-flex items-center gap-2 rounded-full border border-[#4FAEB2]/30 bg-[#E5F4F4] px-3 py-1 text-xs font-medium text-[#3F8E91]">
              Filtrando: {nombreProductoFiltrado ?? "producto"}
              <Button href="/inventario/movimientos" variant="ghost" size="sm">Quitar</Button>
            </span>
          )}
        </div>

        {/* Filtros — una sola línea en desktop; apilan en mobile */}
        <div className="flex flex-col md:flex-row md:flex-wrap md:items-end gap-3 mb-5 pb-5 border-b border-gray-100">
          <input
            type="text"
            placeholder="Buscar por producto o SKU..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className={`${inputFilterClass} md:flex-1 md:min-w-48`}
          />
          <select
            value={filtroTipo}
            onChange={(e) => setFiltroTipo(e.target.value as TipoMovimiento | "")}
            className={inputFilterClass}
          >
            <option value="">Todos los tipos</option>
            <option value="ENTRADA">ENTRADA</option>
            <option value="SALIDA">SALIDA</option>
            <option value="AJUSTE">AJUSTE</option>
            <option value="ASIGNACION">ASIGNACIÓN</option>
            <option value="DEVOLUCION">DEVOLUCIÓN</option>
            <option value="BAJA">BAJA</option>
            <option value="MANTENIMIENTO_FIN">FIN MANT.</option>
          </select>
          <select
            value={filtroOrigen}
            onChange={(e) => setFiltroOrigen(e.target.value as OrigenMovimiento | "")}
            className={inputFilterClass}
          >
            <option value="">Todos los orígenes</option>
            <option value="compra">Compra</option>
            <option value="venta">Venta</option>
            <option value="ajuste_manual">Ajuste manual</option>
          </select>
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-400 whitespace-nowrap">Desde</label>
            <input
              type="date"
              value={fechaDesde}
              onChange={(e) => setFechaDesde(e.target.value)}
              max={fechaHasta || undefined}
              className={`${inputFilterClass} w-full`}
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-400 whitespace-nowrap">Hasta</label>
            <input
              type="date"
              value={fechaHasta}
              onChange={(e) => setFechaHasta(e.target.value)}
              min={fechaDesde || undefined}
              className={`${inputFilterClass} w-full`}
            />
          </div>
          {(busqueda || filtroTipo || filtroOrigen || fechaDesde || fechaHasta) && (
            <button
              onClick={() => {
                setBusqueda("");
                setFiltroTipo("");
                setFiltroOrigen("");
                setFechaDesde("");
                setFechaHasta("");
              }}
              className="text-sm text-gray-400 hover:text-gray-600 transition-colors px-2 self-start md:self-auto"
            >
              Limpiar filtros
            </button>
          )}
        </div>

        {/* Tabla — min-w activa el scroll horizontal en mobile;
            SKU, Origen, Usuario se ocultan en pantallas chicas. */}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1100px] sm:min-w-0 text-left text-sm">
            <thead>
              <tr className="border-b text-gray-500">
                <th className="py-3 pr-4 font-medium">Producto</th>
                <th className="py-3 pr-4 font-medium hidden md:table-cell">SKU</th>
                <th className="py-3 pr-4 font-medium">Tipo</th>
                <th className="py-3 pr-4 font-medium text-right">Cantidad</th>
                <th className="py-3 pr-4 font-medium text-right hidden lg:table-cell">Costo unit.</th>
                <th className="py-3 pr-4 font-medium text-right hidden lg:table-cell">Costo total</th>
                <th className="py-3 pr-4 font-medium hidden md:table-cell">Origen</th>
                <th className="py-3 pr-4 font-medium hidden lg:table-cell">Motivo</th>
                <th className="py-3 pr-4 font-medium hidden lg:table-cell">Evento</th>
                <th className="py-3 pr-4 font-medium hidden lg:table-cell">Usuario</th>
                <th className="py-3 pr-4 font-medium">Fecha</th>
                <th className="py-3 font-medium text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filtrados.length === 0 ? (
                <tr>
                  <td colSpan={12} className="py-12 text-center text-gray-400">
                    {todos.length === 0
                      ? "No hay movimientos registrados"
                      : "Ningún movimiento coincide con los filtros"}
                  </td>
                </tr>
              ) : (
                filtrados.map((m) => {
                  const signo =
                    m.tipo === "ENTRADA" ? "+"
                    : m.tipo === "SALIDA" || m.tipo === "BAJA" ? "−"
                    : m.cantidad >= 0 ? "+" : "";
                  const cantidadColor =
                    m.tipo === "ENTRADA" || m.tipo === "DEVOLUCION" || m.tipo === "MANTENIMIENTO_FIN" ? "text-green-600"
                    : m.tipo === "SALIDA" || m.tipo === "BAJA" ? "text-red-600"
                    : m.tipo === "ASIGNACION" ? "text-sky-700"
                    : "text-yellow-600";
                  const tipoLabel =
                    m.tipo === "ASIGNACION" ? "ASIGNACIÓN"
                    : m.tipo === "DEVOLUCION" ? "DEVOLUCIÓN"
                    : m.tipo === "MANTENIMIENTO_FIN" ? "FIN MANT."
                    : m.tipo;
                  const tipoTone: "success" | "danger" | "warning" | "primary" | "info" =
                    m.tipo === "ENTRADA" || m.tipo === "DEVOLUCION" || m.tipo === "MANTENIMIENTO_FIN" ? "success"
                    : m.tipo === "SALIDA" || m.tipo === "BAJA" ? "danger"
                    : m.tipo === "ASIGNACION" ? "info"
                    : "warning";

                  return (
                    <tr key={m.id} className="border-b last:border-0 hover:bg-gray-50">
                      <td className="py-4 pr-4 font-medium text-gray-800">{m.producto_nombre}</td>
                      <td className="py-4 pr-4 text-gray-500 font-mono hidden md:table-cell">{m.producto_sku}</td>
                      <td className="py-4 pr-4">
                        <Badge tone={tipoTone}>
                          {tipoLabel}
                        </Badge>
                      </td>
                      <td className={`py-4 pr-4 text-right font-semibold tabular-nums ${cantidadColor}`}>
                        {signo}{Math.abs(m.cantidad)}
                      </td>
                      <td className="py-4 pr-4 text-right text-gray-700 tabular-nums hidden lg:table-cell">
                        {formatGs(m.costo_unitario)}
                      </td>
                      <td className="py-4 pr-4 text-right text-gray-800 font-semibold tabular-nums hidden lg:table-cell">
                        {formatGs(Math.abs(m.cantidad) * m.costo_unitario)}
                      </td>
                      <td className="py-4 pr-4 hidden md:table-cell">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${origenBadge[m.origen]}`}>
                          {origenLabel[m.origen]}
                        </span>
                      </td>
                      <td className="py-4 pr-4 text-gray-700 text-xs hidden lg:table-cell">
                        {m.motivo ? (MOTIVO_LABEL[m.motivo] ?? m.motivo)
                          : m.motivo_baja ? `Baja: ${m.motivo_baja}`
                          : m.estado_devolucion ? `Dev: ${m.estado_devolucion}`
                          : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="py-4 pr-4 text-gray-700 text-xs hidden lg:table-cell">
                        {m.proyecto_titulo ?? <span className="text-gray-300">—</span>}
                      </td>
                      <td className="py-4 pr-4 text-gray-600 text-xs hidden lg:table-cell">
                        {m.usuario_nombre ?? <span className="text-gray-300">—</span>}
                      </td>
                      <td className="py-4 pr-4 text-gray-500 text-xs tabular-nums">
                        {formatFecha(m.fecha)}
                      </td>
                      <td className="py-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Link
                            href={`/inventario/movimientos/${m.id}/editar`}
                            className="group/act inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-600 shadow-sm transition-all hover:-translate-y-0.5 hover:border-slate-300 hover:bg-slate-50 hover:text-slate-800 hover:shadow-md"
                            title="Editar movimiento"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5 transition-transform group-hover/act:scale-110">
                              <path d="m5.433 13.917 1.262-3.155A4 4 0 0 1 7.58 9.42l6.92-6.918a2.121 2.121 0 0 1 3 3l-6.92 6.918c-.383.383-.84.685-1.343.886l-3.154 1.262a.5.5 0 0 1-.65-.65Z" />
                              <path d="M3.5 5.75c0-.69.56-1.25 1.25-1.25H10A.75.75 0 0 0 10 3H4.75A2.75 2.75 0 0 0 2 5.75v9.5A2.75 2.75 0 0 0 4.75 18h9.5A2.75 2.75 0 0 0 17 15.25V10a.75.75 0 0 0-1.5 0v5.25c0 .69-.56 1.25-1.25 1.25h-9.5c-.69 0-1.25-.56-1.25-1.25v-9.5Z" />
                            </svg>
                            Editar
                          </Link>
                          <button
                            type="button"
                            onClick={() => setMovAEliminar(m)}
                            className="group/act inline-flex items-center gap-1 rounded-lg border border-red-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-red-600 shadow-sm transition-all hover:-translate-y-0.5 hover:border-red-300 hover:bg-red-50 hover:text-red-700 hover:shadow-md"
                            title="Eliminar movimiento"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5 transition-transform group-hover/act:scale-110">
                              <path fillRule="evenodd" d="M8.75 1A2.75 2.75 0 0 0 6 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 1 0 .23 1.482l.149-.022.841 10.518A2.75 2.75 0 0 0 7.596 19h4.807a2.75 2.75 0 0 0 2.742-2.53l.841-10.52.149.023a.75.75 0 0 0 .23-1.482A41.03 41.03 0 0 0 14 4.193V3.75A2.75 2.75 0 0 0 11.25 1h-2.5ZM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4Z" clipRule="evenodd" />
                            </svg>
                            Eliminar
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

      </div>

      <ConfirmDialog
        open={movAEliminar !== null}
        title="Eliminar movimiento"
        message={
          movAEliminar ? (
            <>
              ¿Eliminar el movimiento de <span className="font-semibold">{movAEliminar.producto_nombre}</span> ({movAEliminar.tipo} {Math.abs(movAEliminar.cantidad)})?
              <br />El stock del producto se recalcula automáticamente.
            </>
          ) : null
        }
        confirmLabel="Eliminar"
        tone="danger"
        busy={eliminando}
        onConfirm={eliminarMovimiento}
        onClose={() => { if (!eliminando) setMovAEliminar(null); }}
      />

    </div>
  );
}
