"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { getProductos } from "@/lib/inventario/storage";
import type { Producto, MetodoValuacion } from "@/lib/inventario/types";
import ExportExcelButton from "@/components/ui/ExportExcelButton";
import ImportExcelButton from "@/components/ui/ImportExcelButton";
import EdgeScrollArea from "@/components/ui/EdgeScrollArea";
import PageHeader from "@/components/ui/PageHeader";
import Badge, { type BadgeTone } from "@/components/ui/Badge";
import { useIsAdmin } from "@/lib/auth/use-is-admin";
import SalidaConsumibleModal, { type SalidaConsumibleProducto } from "@/components/inventario/SalidaConsumibleModal";
import AsignarHerramientaModal, { type HerramientaResumen } from "@/components/inventario/AsignarHerramientaModal";
import DevolverHerramientaModal from "@/components/inventario/DevolverHerramientaModal";
import FinalizarMantenimientoModal from "@/components/inventario/FinalizarMantenimientoModal";
import BajaHerramientaModal from "@/components/inventario/BajaHerramientaModal";
import { fetchWithSupabaseSession } from "@/lib/api/fetch-with-supabase-session";

const inputFilterClass =
  "border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-[#0EA5E9] focus:outline-none";

const metodoTone: Record<MetodoValuacion, BadgeTone> = {
  CPP: "info",
  FIFO: "success",
  LIFO: "primary",
};

function formatGs(valor: number) {
  return `€ ${valor.toLocaleString("es-PY")}`;
}

function foldText(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

function calcularMargenVenta(costo: number, precio: number): number {
  if (precio === 0) return 0;
  return ((precio - costo) / precio) * 100;
}

function margenColor(margen: number): string {
  if (margen >= 40) return "text-green-600";
  if (margen >= 20) return "text-yellow-600";
  return "text-red-600";
}

interface UbicacionMin { id: string; nombre: string; tipo: string }

export default function InventarioPage() {
  const { isAdmin } = useIsAdmin();
  const [todos, setTodos] = useState<Producto[]>([]);
  const [ubicaciones, setUbicaciones] = useState<UbicacionMin[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);

  // Filtros por columna
  const [filtroPorNombre,  setFiltroPorNombre]  = useState("");
  const [filtroPorSku,     setFiltroPorSku]     = useState("");
  const [filtroPorCosto,   setFiltroPorCosto]   = useState("");
  const [filtroPorPrecio,  setFiltroPorPrecio]  = useState("");
  const [filtroValuacion,  setFiltroValuacion]  = useState<MetodoValuacion | "">("");
  const [filtroUbicacion,  setFiltroUbicacion]  = useState<string>(""); // "", "__sin__" o id
  const [filtroTipo,       setFiltroTipo]       = useState<"todos" | "vendibles" | "insumos" | "mixtos">("todos");
  const [tab,              setTab]               = useState<"material" | "herramienta" | "consumible">("material");
  const [cargandoLista,    setCargandoLista]     = useState(true);
  const [soloStockBajo,    setSoloStockBajo]    = useState(false);
  const [eliminandoId,     setEliminandoId]     = useState<string | null>(null);
  const [salidaProducto,   setSalidaProducto]   = useState<SalidaConsumibleProducto | null>(null);
  const [toast,            setToast]            = useState<string | null>(null);
  // Herramientas: estado de modales y resumen de "última asignación" por producto.
  const [herrModal, setHerrModal] = useState<{ tipo: "asignar" | "devolver" | "finmant" | "baja"; herr: HerramientaResumen } | null>(null);
  const [ultAsign,  setUltAsign]  = useState<Map<string, { responsable: string | null; proyecto_titulo: string | null }>>(new Map());

  async function handleEliminarProducto(id: string, nombre: string) {
    if (eliminandoId) return; // evitar doble click
    const ok = window.confirm(
      `¿Eliminar el producto "${nombre}"?\n\n` +
      `Por seguridad se hace baja lógica (queda inactivo) — si tiene movimientos o ventas asociadas se conservan.`
    );
    if (!ok) return;
    setEliminandoId(id);
    try {
      const res = await fetch(`/api/productos/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.success) {
        const msg = json?.error || `Error ${res.status}`;
        window.alert(`No se pudo eliminar: ${msg}`);
        return;
      }
      // Refrescar la lista
      setRefreshKey((k) => k + 1);
    } catch (err) {
      window.alert(`Error de red al eliminar: ${err instanceof Error ? err.message : "desconocido"}`);
    } finally {
      setEliminandoId(null);
    }
  }

  useEffect(() => {
    let cancelled = false;
    setCargandoLista(true);
    getProductos()
      .then((data) => {
        if (!cancelled) setTodos(data);
      })
      .finally(() => {
        if (!cancelled) setCargandoLista(false);
      });
    // Ubicaciones para el filtro
    fetch("/api/inventario/ubicaciones", { credentials: "include", cache: "no-store" })
      .then((r) => r.json())
      .then((j) => {
        if (cancelled || !j?.success) return;
        setUbicaciones((j.data?.ubicaciones ?? []) as UbicacionMin[]);
      })
      .catch(() => undefined);
    return () => { cancelled = true; };
  }, [refreshKey]);

  // Última asignación por herramienta (solo cuando estamos en ese tab).
  // Hace UN GET de movimientos y arma un Map producto_id -> {responsable, obra}.
  useEffect(() => {
    if (tab !== "herramienta") return;
    let cancel = false;
    fetchWithSupabaseSession("/api/inventario/movimientos", { cache: "no-store" })
      .then((r) => r.json())
      .then((j: { success?: boolean; data?: { movimientos?: Array<{ producto_id: string; tipo: string; usuario_nombre: string | null; proyecto_titulo: string | null; fecha: string }> } }) => {
        if (cancel) return;
        const ult = new Map<string, { responsable: string | null; proyecto_titulo: string | null }>();
        const movs = j.data?.movimientos ?? [];
        // movimientos vienen ordenados por fecha desc; el primer ASIGNACION por producto
        // que tenga su par DEVOLUCION posterior se descarta.
        const asignaciones = new Map<string, { fecha: string; responsable: string | null; proyecto_titulo: string | null }>();
        const devoluciones = new Map<string, string>(); // producto_id -> ultima_fecha_devolucion
        for (const m of movs) {
          if (m.tipo === "ASIGNACION" && !asignaciones.has(m.producto_id)) {
            asignaciones.set(m.producto_id, { fecha: m.fecha, responsable: m.usuario_nombre, proyecto_titulo: m.proyecto_titulo });
          }
          if ((m.tipo === "DEVOLUCION" || m.tipo === "BAJA") && !devoluciones.has(m.producto_id)) {
            devoluciones.set(m.producto_id, m.fecha);
          }
        }
        for (const [pid, info] of asignaciones) {
          const devFecha = devoluciones.get(pid);
          if (!devFecha || devFecha < info.fecha) {
            ult.set(pid, { responsable: info.responsable, proyecto_titulo: info.proyecto_titulo });
          }
        }
        setUltAsign(ult);
      })
      .catch(() => { /* tolerante */ });
    return () => { cancel = true; };
  }, [tab, refreshKey]);

  // Map se reconstruia en cada render del componente (cualquier setState de
  // filtro): O(N) basura por keystroke. useMemo lo cachea hasta que cambia ubicaciones.
  const ubicacionById = useMemo(
    () => new Map(ubicaciones.map((u) => [u.id, u])),
    [ubicaciones],
  );

  // Lista filtrada: el filter recorre `todos` en cada keystroke de los filtros.
  // Con catalogos de 500-5000 productos esto era visible (lag al tipear).
  // useMemo solo recalcula cuando cambian las dependencias relevantes.
  const productos = useMemo(() => todos.filter((p) => {
    // Nombre — fold accents/diacritics ("atun" matchea "ATÚN")
    if (filtroPorNombre.trim() !== "" &&
        !foldText(p.nombre).includes(foldText(filtroPorNombre.trim())))
      return false;

    // SKU
    if (filtroPorSku.trim() !== "" &&
        !foldText(p.sku).includes(foldText(filtroPorSku.trim())))
      return false;

    // Costo promedio — acepta "35000" o "35.000"
    if (filtroPorCosto.trim() !== "") {
      const t = filtroPorCosto.trim();
      const coincide =
        String(p.costo_promedio).includes(t) ||
        p.costo_promedio.toLocaleString("es-PY").includes(t);
      if (!coincide) return false;
    }

    // Precio venta — acepta "75000" o "75.000"
    if (filtroPorPrecio.trim() !== "") {
      const t = filtroPorPrecio.trim();
      const coincide =
        String(p.precio_venta).includes(t) ||
        p.precio_venta.toLocaleString("es-PY").includes(t);
      if (!coincide) return false;
    }

    // Valuación
    if (filtroValuacion !== "" && p.metodo_valuacion !== filtroValuacion) return false;

    // Ubicación
    if (filtroUbicacion === "__sin__") {
      if (p.ubicacion_principal_id) return false;
    } else if (filtroUbicacion !== "") {
      if (p.ubicacion_principal_id !== filtroUbicacion) return false;
    }

    // Solo stock bajo
    if (soloStockBajo && p.stock_actual > p.stock_minimo) return false;

    // Tipo gastronómico (vendible/insumo/mixto)
    if (filtroTipo !== "todos") {
      const v = p.es_vendible !== false; // default true si null/undef
      const i = p.es_insumo === true;
      if (filtroTipo === "mixtos" && !(v && i)) return false;
      if (filtroTipo === "vendibles" && !(v && !i)) return false;
      if (filtroTipo === "insumos" && !(i && !v)) return false;
    }

    // Filtro por tab (Materiales | Herramientas | Consumibles).
    // Usa tipo_inventario (nueva columna). Si está vacío o tiene un valor legacy
    // (ej. 'accesorio'), se trata como 'material' para que no quede oculto.
    const rawTipo = (p as { tipo_inventario?: string }).tipo_inventario;
    const tipoInv = rawTipo === "herramienta" || rawTipo === "consumible" ? rawTipo : "material";
    if (tipoInv !== tab) return false;

    return true;
  }), [
    todos,
    filtroPorNombre,
    filtroPorSku,
    filtroPorCosto,
    filtroPorPrecio,
    filtroValuacion,
    filtroUbicacion,
    soloStockBajo,
    filtroTipo,
    tab,
  ]);

  const hayFiltrosActivos =
    filtroPorNombre || filtroPorSku || filtroPorCosto ||
    filtroPorPrecio || filtroValuacion || filtroUbicacion || soloStockBajo ||
    filtroTipo !== "todos";

  function limpiarFiltros() {
    setFiltroPorNombre("");
    setFiltroPorSku("");
    setFiltroPorCosto("");
    setFiltroPorPrecio("");
    setFiltroValuacion("");
    setFiltroUbicacion("");
    setSoloStockBajo(false);
    setFiltroTipo("todos");
  }

  return (
    <div className="space-y-8">

      <PageHeader
        eyebrow="NCG · Stock"
        title="Inventario"
        description="Gestión de productos y control de stock"
        actions={
          <>
            <ExportExcelButton url="/api/inventario/productos/export" />
            <ImportExcelButton
              entidad="Productos"
              previewUrl="/api/inventario/productos/import/preview"
              commitUrl="/api/inventario/productos/import/commit"
              templateUrl="/api/inventario/productos/import/template"
              permiteCrearFaltantes
              visible={isAdmin}
              onCompleted={() => setRefreshKey((k) => k + 1)}
            />
          </>
        }
      />

      {/* Tabs gastronómicos (filtran por tipo de producto) */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex flex-wrap gap-6" aria-label="Tabs">
          {([
            { id: "material",    label: "Materiales",  subtitle: "Materiales principales que se consumen en cada obra" },
            { id: "herramienta", label: "Herramientas", subtitle: "Activos de la empresa: equipos y herramientas" },
            { id: "consumible",  label: "Consumibles",  subtitle: "Insumos que se gastan seguido" },
          ] as const).map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`whitespace-nowrap border-b-2 py-2 px-1 text-sm font-medium transition-colors ${
                tab === t.id
                  ? "border-amber-500 text-amber-600"
                  : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700"
              }`}
              title={t.subtitle}
            >
              {t.label}
            </button>
          ))}
          <Link
            href="/inventario/movimientos"
            className="whitespace-nowrap border-b-2 border-transparent py-2 px-1 text-sm font-medium text-gray-500 transition-colors hover:border-gray-300 hover:text-gray-700"
            title="Entradas, salidas y trazabilidad por obra"
          >
            Movimientos →
          </Link>
        </nav>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl shadow-sm ring-1 ring-[#4FAEB2]/15 p-6">

        <div className="flex flex-wrap justify-between items-center gap-3 mb-5">
          <div className="flex items-center gap-3 flex-wrap">
            <h2 className="text-xl font-semibold">Productos</h2>
            <Link
              href="/inventario/nuevo"
              className="rounded-lg bg-[#4FAEB2] px-3 py-1.5 text-xs font-semibold text-white shadow-sm shadow-[#4FAEB2]/25 transition-colors hover:bg-[#3F8E91] active:scale-95"
            >
              {tab === "consumible" ? "Nuevo consumible"
                : tab === "herramienta" ? "Nueva herramienta"
                : "Nuevo material"}
            </Link>
            <input
              type="text"
              placeholder="Buscar por nombre..."
              value={filtroPorNombre}
              onChange={(e) => setFiltroPorNombre(e.target.value)}
              className="w-64 border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#0EA5E9] focus:outline-none bg-white"
            />
          </div>
        </div>

        {/* Filtros por columna — fila 1 (SKU/Costo/Precio) oculta para UX simplificada */}
        <div className="hidden space-y-3 mb-5 pb-5 border-b border-gray-100">

          {/* Fila 1: filtros de texto por columna */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs text-gray-400 mb-1">Nombre</label>
              <input
                type="text"
                placeholder="Buscar nombre..."
                value={filtroPorNombre}
                onChange={(e) => setFiltroPorNombre(e.target.value)}
                className={inputFilterClass}
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">SKU</label>
              <input
                type="text"
                placeholder="Buscar SKU..."
                value={filtroPorSku}
                onChange={(e) => setFiltroPorSku(e.target.value)}
                className={inputFilterClass}
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Costo promedio</label>
              <input
                type="text"
                placeholder="Ej: 35000"
                value={filtroPorCosto}
                onChange={(e) => setFiltroPorCosto(e.target.value)}
                className={inputFilterClass}
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Precio venta</label>
              <input
                type="text"
                placeholder="Ej: 75000"
                value={filtroPorPrecio}
                onChange={(e) => setFiltroPorPrecio(e.target.value)}
                className={inputFilterClass}
              />
            </div>
          </div>

          {/* Fila 2: valuación, ubicación, stock bajo, limpiar y contador
              Ocultada para instancia En lo de Mari — la lógica de filtros sigue activa pero sin UI. */}
          <div className="hidden flex-wrap items-center gap-3">
            <div>
              <label className="block text-xs text-gray-400 mb-1">Valuación</label>
              <select
                value={filtroValuacion}
                onChange={(e) => setFiltroValuacion(e.target.value as MetodoValuacion | "")}
                className={inputFilterClass}
              >
                <option value="">Todos los métodos</option>
                <option value="CPP">CPP</option>
                <option value="FIFO">FIFO</option>
                <option value="LIFO">LIFO</option>
              </select>
            </div>
            <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer select-none mt-4">
              <input
                type="checkbox"
                checked={soloStockBajo}
                onChange={(e) => setSoloStockBajo(e.target.checked)}
                className="rounded"
              />
              Solo stock bajo
            </label>
            <div className="mt-4 flex items-center gap-1 rounded-md border border-gray-200 bg-gray-50 p-0.5">
              {(["todos","vendibles","insumos","mixtos"] as const).map((opt) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => setFiltroTipo(opt)}
                  className={`px-2.5 py-1 text-xs font-medium rounded transition ${
                    filtroTipo === opt
                      ? "bg-white text-amber-700 shadow-sm"
                      : "text-gray-500 hover:text-gray-700"
                  }`}
                >
                  {opt === "todos" ? "Todos" : opt[0].toUpperCase() + opt.slice(1)}
                </button>
              ))}
            </div>
            {hayFiltrosActivos && (
              <button
                onClick={limpiarFiltros}
                className="mt-4 text-sm text-gray-400 hover:text-gray-600 transition-colors px-2"
              >
                Limpiar filtros
              </button>
            )}
            <span className="ml-auto text-sm text-gray-400 self-end mb-0.5">
              {productos.length} de {todos.length} productos
            </span>
          </div>

        </div>

        <EdgeScrollArea>
          {/* min-w-[1100px] fuerza scroll horizontal real en mobile; en >=lg
              vuelve a comportarse natural. Columnas no críticas (SKU, Unidad,
              Ubicacion, Valuacion, Margen) se ocultan progresivamente. */}
          <table className="w-full min-w-[1100px] lg:min-w-0 text-left text-sm">

            <thead>
              <tr className="bg-slate-50 text-slate-600 text-sm font-semibold">
                <th className="py-3 pr-4 font-medium">Nombre</th>
                <th className="py-3 pr-4 font-medium hidden md:table-cell">SKU</th>
                <th className={`py-3 pr-4 font-medium ${tab === "herramienta" ? "hidden lg:table-cell" : ""}`}>
                  {tab === "herramienta" ? "Costo adquisición" : "Costo Prom."}
                </th>
                <th className={`py-3 pr-4 font-medium ${tab === "consumible" ? "" : "hidden"}`}>Último costo</th>
                <th className={`py-3 pr-4 font-medium ${tab === "consumible" || tab === "herramienta" ? "hidden" : ""}`}>Precio Venta</th>
                <th className={`py-3 pr-4 font-medium text-center ${tab !== "herramienta" ? "" : "hidden"}`}>Stock</th>
                <th className={`py-3 pr-4 font-medium text-center ${tab !== "herramienta" ? "hidden md:table-cell" : "hidden"}`}>Stock Mín.</th>
                <th className={`py-3 pr-4 font-medium ${tab === "herramienta" ? "" : "hidden"}`}>Estado</th>
                <th className={`py-3 pr-4 font-medium hidden md:table-cell ${tab === "herramienta" ? "" : ""}`}>{tab === "herramienta" ? "Responsable" : "Unidad"}</th>
                <th className={`py-3 pr-4 font-medium hidden lg:table-cell`}>
                  {tab === "herramienta" ? "Obra asignada" : tab === "consumible" ? "Valor (€)" : "Valuación"}
                </th>
                <th className={`py-3 pr-6 font-medium text-right hidden md:table-cell ${tab === "consumible" || tab === "herramienta" ? "md:hidden" : ""}`}>
                  <span title="(precio - costo) / precio × 100">Margen s/venta</span>
                </th>
                <th className={`py-3 pl-4 font-medium text-center ${tab === "consumible" || tab === "herramienta" ? "w-72" : "w-44"}`}>Acción</th>
              </tr>
            </thead>

            <tbody>
              {productos.map((p) => {
                const stockBajo = p.stock_actual <= p.stock_minimo;
                const margen = calcularMargenVenta(p.costo_promedio, p.precio_venta);
                return (
                  <tr key={p.id} className="border-b border-slate-200 last:border-0 hover:bg-[#4FAEB2]/[0.04] transition-colors">
                    <td className="py-4 pr-4 font-medium text-gray-800">
                      <div className="flex items-center gap-3">
                        {/* Thumbnail 40x40 — usa <img> plano para no requerir config de dominios en next.config */}
                        <div className="flex-shrink-0 w-10 h-10 rounded-md overflow-hidden bg-slate-100 border border-slate-200">
                          {p.imagen_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={p.imagen_url}
                              alt={p.nombre}
                              className="w-full h-full object-cover"
                              loading="lazy"
                              onError={(e) => {
                                // Si la URL fallece (404/CORS), reemplaza con placeholder
                                const target = e.currentTarget as HTMLImageElement;
                                target.style.display = "none";
                                const parent = target.parentElement;
                                if (parent && !parent.querySelector("[data-img-placeholder]")) {
                                  parent.insertAdjacentHTML(
                                    "beforeend",
                                    '<div data-img-placeholder class="w-full h-full flex items-center justify-center text-slate-300"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg></div>'
                                  );
                                }
                              }}
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-slate-300" aria-label="Sin imagen">
                              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                                <circle cx="8.5" cy="8.5" r="1.5"/>
                                <polyline points="21 15 16 10 5 21"/>
                              </svg>
                            </div>
                          )}
                        </div>
                        {/* Nombre + badges */}
                        <div className="flex items-center gap-2 flex-wrap">
                          <span>{p.nombre}</span>
                          {(() => {
                            const v = p.es_vendible !== false;
                            const i = p.es_insumo === true;
                            // Mixto/Insumo se siguen mostrando; Vendible queda oculto (redundante: ya hay tab).
                            if (v && i) return <Badge tone="primary">Mixto</Badge>;
                            if (i) return <Badge tone="success">Insumo</Badge>;
                            return null;
                          })()}
                        </div>
                      </div>
                    </td>
                    <td className="py-4 pr-4 text-gray-500 font-mono hidden md:table-cell">{p.sku}</td>
                    <td className={`py-4 pr-4 text-gray-700 ${tab === "herramienta" ? "hidden lg:table-cell" : ""}`}>{formatGs(p.costo_promedio)}</td>
                    <td className={`py-4 pr-4 text-gray-700 ${tab === "consumible" ? "" : "hidden"}`}>{formatGs(p.ultimo_costo ?? p.costo_promedio)}</td>
                    <td className={`py-4 pr-4 text-gray-700 ${tab === "consumible" || tab === "herramienta" ? "hidden" : ""}`}>{formatGs(p.precio_venta)}</td>
                    <td className={`py-4 pr-4 text-center ${tab !== "herramienta" ? "" : "hidden"}`}>
                      <span className={`font-semibold ${stockBajo ? "text-red-600" : "text-gray-800"}`}>
                        {p.stock_actual}
                      </span>
                    </td>
                    <td className={`py-4 pr-4 text-center text-gray-500 ${tab !== "herramienta" ? "hidden md:table-cell" : "hidden"}`}>{p.stock_minimo}</td>
                    {/* Estado (solo herramienta) */}
                    {tab === "herramienta" && (() => {
                      const asignada = p.cantidad_asignada ?? 0;
                      const mant = p.cantidad_mantenimiento ?? 0;
                      const disp = p.stock_actual - asignada - mant;
                      return (
                        <td className="py-4 pr-4">
                          <div className="flex flex-col gap-0.5 text-[11px]">
                            {disp > 0 && <span className="font-semibold text-emerald-700">Disponible · {disp}</span>}
                            {asignada > 0 && <span className="text-amber-700">En obra · {asignada}</span>}
                            {mant > 0 && <span className="text-sky-700">Mant. · {mant}</span>}
                            {disp <= 0 && asignada <= 0 && mant <= 0 && <span className="text-slate-400">—</span>}
                          </div>
                        </td>
                      );
                    })()}
                    {tab === "herramienta" ? (
                      <td className="py-4 pr-4 text-gray-700 text-xs hidden md:table-cell">
                        {ultAsign.get(p.id)?.responsable ?? <span className="text-gray-300">—</span>}
                      </td>
                    ) : (
                      <td className="py-4 pr-4 text-gray-600 hidden md:table-cell lg:table-cell">{p.unidad_medida}</td>
                    )}
                    <td className="py-4 pr-4 hidden lg:table-cell">
                      {tab === "herramienta" ? (
                        <span className="text-xs text-gray-700">{ultAsign.get(p.id)?.proyecto_titulo ?? <span className="text-gray-300">—</span>}</span>
                      ) : tab === "consumible" ? (
                        <span className="tabular-nums font-semibold text-gray-800">
                          {formatGs(p.stock_actual * p.costo_promedio)}
                        </span>
                      ) : (
                        <Badge tone={metodoTone[p.metodo_valuacion]}>{p.metodo_valuacion}</Badge>
                      )}
                    </td>
                    <td className={`py-4 pr-6 text-right tabular-nums font-semibold hidden md:table-cell ${tab === "consumible" || tab === "herramienta" ? "md:hidden" : ""} ${margenColor(margen)}`}>
                      {margen.toFixed(2)}%
                    </td>
                    <td className="py-4 pl-4 text-center">
                      <div className="inline-flex items-center justify-center gap-2 flex-wrap">
                        {tab === "herramienta" && (() => {
                          const asignada = p.cantidad_asignada ?? 0;
                          const mant = p.cantidad_mantenimiento ?? 0;
                          const disp = p.stock_actual - asignada - mant;
                          const resumen: HerramientaResumen = {
                            id: p.id,
                            nombre: p.nombre,
                            sku: p.sku,
                            stock_actual: p.stock_actual,
                            cantidad_asignada: asignada,
                            cantidad_mantenimiento: mant,
                            unidad_medida: p.unidad_medida,
                          };
                          return (
                            <>
                              <button type="button" disabled={disp <= 0}
                                onClick={() => setHerrModal({ tipo: "asignar", herr: resumen })}
                                className="inline-flex items-center justify-center min-h-[40px] rounded-md border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700 hover:border-emerald-300 hover:bg-emerald-100 disabled:opacity-40 disabled:cursor-not-allowed">
                                Asignar
                              </button>
                              <button type="button" disabled={asignada <= 0}
                                onClick={() => setHerrModal({ tipo: "devolver", herr: resumen })}
                                className="inline-flex items-center justify-center min-h-[40px] rounded-md border border-sky-200 bg-sky-50 px-3 py-1.5 text-xs font-medium text-sky-700 hover:border-sky-300 hover:bg-sky-100 disabled:opacity-40 disabled:cursor-not-allowed">
                                Devolver
                              </button>
                              {mant > 0 && (
                                <button type="button"
                                  onClick={() => setHerrModal({ tipo: "finmant", herr: resumen })}
                                  className="inline-flex items-center justify-center min-h-[40px] rounded-md border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-700 hover:border-amber-300 hover:bg-amber-100">
                                  Finalizar mant.
                                </button>
                              )}
                              <button type="button"
                                onClick={() => setHerrModal({ tipo: "baja", herr: resumen })}
                                className="inline-flex items-center justify-center min-h-[40px] rounded-md border border-red-200 bg-white px-3 py-1.5 text-xs font-medium text-red-600 hover:border-red-300 hover:bg-red-50">
                                Dar de baja
                              </button>
                              <Link href={`/inventario/movimientos?producto=${p.id}`}
                                className="inline-flex items-center justify-center min-h-[40px] rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:border-slate-300 hover:bg-slate-50">
                                Historial
                              </Link>
                            </>
                          );
                        })()}
                        {tab === "consumible" && (
                          <>
                            <button
                              type="button"
                              onClick={() => setSalidaProducto({
                                id: p.id,
                                nombre: p.nombre,
                                sku: p.sku,
                                stock_actual: p.stock_actual,
                                costo_promedio: p.costo_promedio,
                                unidad_medida: p.unidad_medida,
                              })}
                              className="inline-flex items-center justify-center min-h-[40px] rounded-md border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700 hover:border-emerald-300 hover:bg-emerald-100 transition-colors"
                            >
                              Dar salida
                            </button>
                            <Link
                              href={`/inventario/movimientos?producto=${p.id}`}
                              className="inline-flex items-center justify-center min-h-[40px] rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:border-slate-300 hover:bg-slate-50 transition-colors"
                            >
                              Movimientos
                            </Link>
                          </>
                        )}
                        <Link
                          href={`/inventario/${p.id}/editar`}
                          className="inline-flex items-center justify-center min-h-[40px] rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:border-slate-300 hover:bg-slate-50 transition-colors"
                        >
                          Editar
                        </Link>
                        <button
                          type="button"
                          onClick={() => handleEliminarProducto(p.id, p.nombre)}
                          disabled={eliminandoId === p.id}
                          className="inline-flex items-center justify-center min-h-[40px] rounded-md border border-red-200 bg-white px-3 py-1.5 text-xs font-medium text-red-600 hover:border-red-300 hover:bg-red-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {eliminandoId === p.id ? "..." : "Eliminar"}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {!cargandoLista && productos.length === 0 && (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-sm text-slate-400">
                    {todos.length === 0
                      ? "No hay ítems registrados todavía. Creá uno con “Nuevo material”."
                      : hayFiltrosActivos
                        ? "Ningún ítem coincide con los filtros."
                        : tab === "herramienta"
                          ? "No hay herramientas registradas. Creá una con “Nueva herramienta”."
                          : tab === "consumible"
                            ? "No hay consumibles registrados. Creá uno con “Nuevo consumible”."
                            : "No hay materiales registrados. Creá uno con “Nuevo material”."}
                  </td>
                </tr>
              )}
            </tbody>

          </table>
        </EdgeScrollArea>

      </div>

      {salidaProducto && (
        <SalidaConsumibleModal
          producto={salidaProducto}
          onClose={() => setSalidaProducto(null)}
          onSaved={async () => {
            setRefreshKey((k) => k + 1);
            setToast("Salida registrada correctamente.");
            setTimeout(() => setToast(null), 3000);
          }}
        />
      )}

      {herrModal?.tipo === "asignar" && (
        <AsignarHerramientaModal
          herramienta={herrModal.herr}
          onClose={() => setHerrModal(null)}
          onSaved={async () => { setRefreshKey((k) => k + 1); setToast("Herramienta asignada."); setTimeout(() => setToast(null), 3000); }}
        />
      )}
      {herrModal?.tipo === "devolver" && (
        <DevolverHerramientaModal
          herramienta={herrModal.herr}
          onClose={() => setHerrModal(null)}
          onSaved={async () => { setRefreshKey((k) => k + 1); setToast("Devolución registrada."); setTimeout(() => setToast(null), 3000); }}
        />
      )}
      {herrModal?.tipo === "finmant" && (
        <FinalizarMantenimientoModal
          herramienta={herrModal.herr}
          onClose={() => setHerrModal(null)}
          onSaved={async () => { setRefreshKey((k) => k + 1); setToast("Mantenimiento finalizado."); setTimeout(() => setToast(null), 3000); }}
        />
      )}
      {herrModal?.tipo === "baja" && (
        <BajaHerramientaModal
          herramienta={herrModal.herr}
          onClose={() => setHerrModal(null)}
          onSaved={async () => { setRefreshKey((k) => k + 1); setToast("Baja registrada."); setTimeout(() => setToast(null), 3000); }}
        />
      )}

      {toast && (
        <div className="fixed bottom-6 right-6 z-50 rounded-lg bg-emerald-600 px-4 py-3 text-sm font-medium text-white shadow-lg">
          {toast}
        </div>
      )}

    </div>
  );
}
