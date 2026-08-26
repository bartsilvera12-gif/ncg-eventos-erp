"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { getProveedores, getResumenProveedores, getComprasStatsProveedores, deleteProveedor } from "@/lib/proveedores/storage";
import ExportExcelButton from "@/components/ui/ExportExcelButton";
import ImportExcelButton from "@/components/ui/ImportExcelButton";
import PageHeader from "@/components/ui/PageHeader";
import StatCard from "@/components/ui/StatCard";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { useIsAdmin } from "@/lib/auth/use-is-admin";
import type { Proveedor, ResumenProveedores, ProveedorComprasStat } from "@/lib/proveedores/types";

function formatGs(v: number) {
  return `€ ${(v).toLocaleString("es-PY", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}
function formatFechaCorta(iso: string | null): string {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
  } catch {
    return "—";
  }
}

/**
 * Isla cliente de la página de Proveedores: búsqueda, filtros y acciones.
 *
 * Los datos iniciales llegan ya renderizados desde el Server Component
 * (`initialProveedores`, `serverLoaded`), eliminando el waterfall
 * "montar → resolver token → fetch /api → render". Solo re-fetchea cuando:
 *   - el servidor NO pudo cargar (fallback al comportamiento anterior), o
 *   - hubo un refresh manual (p. ej. tras importar un Excel).
 */
export default function ProveedoresClient({
  initialProveedores,
  serverLoaded,
}: {
  initialProveedores: Proveedor[];
  serverLoaded: boolean;
}) {
  const { isAdmin } = useIsAdmin();
  const [lista, setLista] = useState<Proveedor[]>(initialProveedores);
  const [busqueda, setBusqueda] = useState("");
  const [cargando, setCargando] = useState(!serverLoaded);
  const [refreshKey, setRefreshKey] = useState(0);
  const [resumen, setResumen] = useState<ResumenProveedores | null>(null);
  const [stats, setStats] = useState<Record<string, ProveedorComprasStat>>({});
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [proveedorAEliminar, setProveedorAEliminar] = useState<Proveedor | null>(null);
  const [eliminando, setEliminando] = useState(false);

  // Cards + totales por proveedor se recalculan server-side según el rango.
  useEffect(() => {
    let cancel = false;
    getResumenProveedores(desde || undefined, hasta || undefined).then((r) => { if (!cancel) setResumen(r); });
    getComprasStatsProveedores(desde || undefined, hasta || undefined).then((m) => { if (!cancel) setStats(m); });
    return () => { cancel = true; };
  }, [refreshKey, desde, hasta]);

  useEffect(() => {
    // Si el servidor ya trajo los datos y no hubo refresh manual, usamos esos
    // (sin red). `cargando` ya arranca en false cuando serverLoaded es true.
    if (serverLoaded && refreshKey === 0) {
      return;
    }
    let cancel = false;
    setCargando(true);
    getProveedores().then((rows) => {
      if (!cancel) {
        setLista(rows);
        setCargando(false);
      }
    });
    return () => {
      cancel = true;
    };
  }, [refreshKey, serverLoaded]);

  const filtradas = useMemo(() => {
    const t = busqueda.trim().toLowerCase();
    if (!t) return lista;
    return lista.filter((p) => {
      const cats = (p.categorias ?? []).map((c) => c.nombre.toLowerCase()).join(" ");
      return (
        p.nombre.toLowerCase().includes(t) ||
        (p.ruc ?? "").toLowerCase().includes(t) ||
        (p.email ?? "").toLowerCase().includes(t) ||
        cats.includes(t)
      );
    });
  }, [lista, busqueda]);

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="NCG · Adquisiciones"
        title="Proveedores"
        description="Maestro de abastecimiento: categorías, condiciones de pago y vínculo con compras."
        actions={
          <>
            <ExportExcelButton url="/api/proveedores/export" />
            <ImportExcelButton
              entidad="Proveedores"
              previewUrl="/api/proveedores/import/preview"
              commitUrl="/api/proveedores/import/commit"
              templateUrl="/api/proveedores/import/template"
              permiteCrearFaltantes
              visible={isAdmin}
              onCompleted={() => setRefreshKey((k) => k + 1)}
            />
            <Button href="/proveedores/categorias" variant="secondary" size="sm">
              Categorías
            </Button>
            <Button href="/proveedores/nuevo" size="sm">
              <span aria-hidden>+</span> Nuevo proveedor
            </Button>
          </>
        }
      />

      {resumen && (
        <div>
          <p className="text-xs text-gray-400 uppercase tracking-wide font-medium mb-3">
            Resumen operativo
          </p>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard compact label="Total proveedores" value={String(resumen.totalProveedores)} accent />
            <StatCard compact label="Con compras (período)" value={String(resumen.conComprasRango)} />
            <StatCard compact label="Total comprado (período)" value={formatGs(resumen.totalCompradoRango)} />
            <StatCard
              compact
              label="Última compra"
              value={resumen.ultimaCompra ? formatGs(resumen.ultimaCompra.total) : "—"}
              hint={
                resumen.ultimaCompra
                  ? `${resumen.ultimaCompra.numero_control} · ${formatFechaCorta(resumen.ultimaCompra.fecha)}`
                  : "Sin compras registradas"
              }
            />
          </div>
        </div>
      )}

      <Card className="overflow-hidden">
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <input
            type="search"
            placeholder="Buscar por nombre, NIF, email o categoría…"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="min-w-[200px] flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm focus:ring-2 focus:ring-[#0EA5E9]"
          />
          <div className="flex items-center gap-2">
            <label className="text-xs text-slate-400 whitespace-nowrap">Desde</label>
            <input
              type="date"
              value={desde}
              onChange={(e) => setDesde(e.target.value)}
              max={hasta || undefined}
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:ring-2 focus:ring-[#0EA5E9]"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-slate-400 whitespace-nowrap">Hasta</label>
            <input
              type="date"
              value={hasta}
              onChange={(e) => setHasta(e.target.value)}
              min={desde || undefined}
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:ring-2 focus:ring-[#0EA5E9]"
            />
          </div>
          <span className="text-sm text-slate-400">
            {filtradas.length} de {lista.length}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-slate-600">
                <th className="py-3 pr-4 font-semibold">Proveedor</th>
                <th className="py-3 pr-4 font-semibold">NIF</th>
                <th className="py-3 pr-4 font-semibold">Contacto</th>
                <th className="py-3 pr-4 font-semibold">Categorías</th>
                <th className="py-3 pr-4 font-semibold">Estado</th>
                <th className="py-3 pr-4 font-semibold text-right">Compras</th>
                <th className="py-3 pr-4 font-semibold text-right">Total período</th>
                <th className="py-3 pr-4 font-semibold">Última compra</th>
                <th className="py-3 font-semibold w-28" />
              </tr>
            </thead>
            <tbody>
              {cargando ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400">
                    Cargando…
                  </td>
                </tr>
              ) : filtradas.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400">
                    {lista.length === 0 ? "No hay proveedores cargados." : "Sin resultados."}
                  </td>
                </tr>
              ) : (
                filtradas.map((p) => {
                  const st = stats[p.id];
                  return (
                  <tr key={p.id} className="border-b border-slate-50 last:border-0 hover:bg-[#4FAEB2]/[0.04] transition-colors">
                    <td className="py-3 pr-4">
                      <div className="font-medium text-slate-800">{p.nombre}</div>
                      {p.nombre_comercial && (
                        <div className="text-xs text-slate-500">{p.nombre_comercial}</div>
                      )}
                    </td>
                    <td className="py-3 pr-4 font-mono text-xs text-slate-600">{p.ruc ?? "—"}</td>
                    <td className="py-3 pr-4 text-slate-600">
                      <div>{p.contacto ?? "—"}</div>
                      <div className="text-xs text-slate-400">{p.telefono ?? ""}</div>
                    </td>
                    <td className="py-3 pr-4">
                      <div className="flex flex-wrap gap-1">
                        {(p.categorias ?? []).length === 0 ? (
                          <span className="text-xs text-slate-400">—</span>
                        ) : (
                          p.categorias!.map((c) => (
                            <Badge key={c.id} tone="neutral">{c.nombre}</Badge>
                          ))
                        )}
                      </div>
                    </td>
                    <td className="py-3 pr-4">
                      <Badge tone={p.estado === "activo" ? "success" : "neutral"}>
                        {p.estado === "activo" ? "Activo" : "Inactivo"}
                      </Badge>
                    </td>
                    <td className="py-3 pr-4 text-right tabular-nums text-slate-700">{st?.cantidad ?? 0}</td>
                    <td className="py-3 pr-4 text-right tabular-nums text-slate-700">{formatGs(st?.total_rango ?? 0)}</td>
                    <td className="py-3 pr-4 text-slate-600 text-xs tabular-nums">{formatFechaCorta(st?.ultima_compra ?? null)}</td>
                    <td className="py-3">
                      <div className="flex items-center gap-1.5">
                        <Link
                          href={`/proveedores/${p.id}`}
                          className="group/act inline-flex items-center gap-1 rounded-lg border border-[#4FAEB2]/30 bg-white px-2.5 py-1.5 text-xs font-semibold text-[#3F8E91] shadow-sm transition-all hover:-translate-y-0.5 hover:border-[#4FAEB2] hover:bg-[#E5F4F4] hover:shadow-md"
                          title="Ver detalle"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5 transition-transform group-hover/act:scale-110">
                            <path d="M10 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z" />
                            <path fillRule="evenodd" d="M.664 10.59a1.651 1.651 0 0 1 0-1.186A10.004 10.004 0 0 1 10 3c4.257 0 7.893 2.66 9.336 6.41.147.381.146.804 0 1.186A10.004 10.004 0 0 1 10 17c-4.257 0-7.893-2.66-9.336-6.41ZM14 10a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z" clipRule="evenodd" />
                          </svg>
                          Ver
                        </Link>
                        <Link
                          href={`/proveedores/${p.id}/editar`}
                          className="group/act inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-600 shadow-sm transition-all hover:-translate-y-0.5 hover:border-slate-300 hover:bg-slate-50 hover:text-slate-800 hover:shadow-md"
                          title="Editar proveedor"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5 transition-transform group-hover/act:scale-110">
                            <path d="m5.433 13.917 1.262-3.155A4 4 0 0 1 7.58 9.42l6.92-6.918a2.121 2.121 0 0 1 3 3l-6.92 6.918c-.383.383-.84.685-1.343.886l-3.154 1.262a.5.5 0 0 1-.65-.65Z" />
                            <path d="M3.5 5.75c0-.69.56-1.25 1.25-1.25H10A.75.75 0 0 0 10 3H4.75A2.75 2.75 0 0 0 2 5.75v9.5A2.75 2.75 0 0 0 4.75 18h9.5A2.75 2.75 0 0 0 17 15.25V10a.75.75 0 0 0-1.5 0v5.25c0 .69-.56 1.25-1.25 1.25h-9.5c-.69 0-1.25-.56-1.25-1.25v-9.5Z" />
                          </svg>
                          Editar
                        </Link>
                        {isAdmin && (
                          <button
                            type="button"
                            onClick={() => setProveedorAEliminar(p)}
                            className="group/act inline-flex items-center gap-1 rounded-lg border border-red-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-red-600 shadow-sm transition-all hover:-translate-y-0.5 hover:border-red-300 hover:bg-red-50 hover:text-red-700 hover:shadow-md"
                            title="Eliminar proveedor"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5 transition-transform group-hover/act:scale-110">
                              <path fillRule="evenodd" d="M8.75 1A2.75 2.75 0 0 0 6 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 1 0 .23 1.482l.149-.022.841 10.518A2.75 2.75 0 0 0 7.596 19h4.807a2.75 2.75 0 0 0 2.742-2.53l.841-10.52.149.023a.75.75 0 0 0 .23-1.482A41.03 41.03 0 0 0 14 4.193V3.75A2.75 2.75 0 0 0 11.25 1h-2.5ZM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4Z" clipRule="evenodd" />
                            </svg>
                            Eliminar
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <ConfirmDialog
        open={proveedorAEliminar !== null}
        title="Eliminar proveedor"
        message={
          proveedorAEliminar ? (
            <>
              ¿Seguro que querés eliminar <span className="font-semibold text-slate-800">{`"${proveedorAEliminar.nombre}"`}</span>? Esta acción es definitiva.
            </>
          ) : null
        }
        confirmLabel="Eliminar"
        tone="danger"
        busy={eliminando}
        onConfirm={async () => {
          if (!proveedorAEliminar) return;
          setEliminando(true);
          const r = await deleteProveedor(proveedorAEliminar.id);
          setEliminando(false);
          if (r.ok) {
            setLista((prev) => prev.filter((x) => x.id !== proveedorAEliminar.id));
            setProveedorAEliminar(null);
          } else {
            window.alert(r.error);
          }
        }}
        onClose={() => { if (!eliminando) setProveedorAEliminar(null); }}
      />
    </div>
  );
}
