"use client";

import * as React from "react";
import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import MontoInput from "@/components/ui/MontoInput";
import PageHeader from "@/components/ui/PageHeader";
import ProductPickerModal, { type AgregarVentaPayload } from "@/components/inventario/ProductPickerModal";
import PagoDetalleModal from "@/components/ventas/PagoDetalleModal";
import { saveVenta } from "@/lib/ventas/storage";
import type { TipoIvaVenta, TipoVenta, MonedaVenta, LineaVenta, MetodoPago, TipoPrecioVenta, PagoDetalleVenta } from "@/lib/ventas/types";
import { parseImporte } from "@/lib/utils/money";

// ── Helpers ────────────────────────────────────────────────────────────────────

/**
 * Flag de vertical de negocio del cliente.
 * - "gastronomia" (legacy En lo de Mari): muestra modalidad de pedido (local/delivery/carry_out),
 *   número de mesa, datos de delivery, y obliga seleccionar una modalidad antes de
 *   confirmar la venta. Al confirmar también crea un proyecto-pedido de cocina.
 * - cualquier otro valor (default "distribuidora"): oculta toda la sección
 *   de modalidad/mesa. La venta se confirma solo con cliente + productos.
 *
 * Se lee de NEXT_PUBLIC_NEURA_VERTICAL en build/runtime de cliente.
 * Default seguro: "distribuidora" (no gastronomía).
 */
const ES_GASTRONOMIA =
  (typeof process !== "undefined" && process.env.NEXT_PUBLIC_NEURA_VERTICAL?.trim().toLowerCase()) === "gastronomia";

function formatGs(valor: number) {
  return `€ ${valor.toLocaleString("es-PY", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

/** Alícuota a partir del código de IVA (admite formatos PY y ES). */
function tasaIvaVenta(tipo: TipoIvaVenta): number {
  if (tipo === "EXENTA") return 0;
  if (tipo === "4%") return 0.04;
  if (tipo === "5%") return 0.05;
  if (tipo === "10%") return 0.1;
  if (tipo === "21%") return 0.21;
  return 0;
}

// ── Estilos ────────────────────────────────────────────────────────────────────

const inputClass =
  "w-full border border-slate-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-[#0EA5E9] focus:outline-none bg-white text-sm";
const labelClass = "block text-sm font-medium text-slate-700 mb-1.5";

// ── Labels ──────────────────────────────────────────────────────────────────

const ivaLabel: Record<TipoIvaVenta, string> = {
  EXENTA: "Exento",
  "4%":   "4%",
  "5%":   "5%",
  "10%":  "10%",
  "21%":  "21%",
};

const tipoPrecioLabel: Record<TipoPrecioVenta, string> = {
  minorista: "Minorista",
  mayorista: "Mayorista",
  costo:     "Al costo",
};

// ── Componente principal ───────────────────────────────────────────────────────

export default function NuevaVentaPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  /**
   * Modo presupuesto: el form es el mismo, pero al guardar se envía
   * tipo_documento='presupuesto', lo que en el servidor:
   *  - No valida stock
   *  - No descuenta stock
   *  - No genera movimientos de inventario
   *  - Crea la venta con estado_presupuesto='pendiente'
   */
  const esPresupuesto = (searchParams?.get("tipo") ?? "") === "presupuesto";

  // ── Estado global ──────────────────────────────────────────────────────────
  const [items, setItems]           = useState<LineaVenta[]>([]);
  const [errorVenta, setErrorVenta] = useState<string | null>(null);

  // ── Datos de la obra (solo presupuesto) ──────────────────────────────────
  const [obraMeta, setObraMeta] = useState<ObraMeta>({
    titulo_obra: "",
    tipo_obra_id: "",
    ubicacion: "",
    superficie_m2: "",
    descripcion: "",
    validez_dias: "15",
    condiciones: "",
  });
  // Modal de partida manual (solo presupuesto)
  const [partidaManualOpen, setPartidaManualOpen] = useState(false);

  // ── Condiciones de la venta (fijas para En lo de Mari) ────────────────────
  // Instancia dedicada: siempre Guaraníes + Contado.
  const moneda: MonedaVenta = "GS";
  const tipoVenta: TipoVenta = "CONTADO";

  // Pedidos (gastronomía): modalidad obligatoria en instancia En lo de Mari
  type Modalidad = "local" | "delivery" | "carry_out";
  const [modalidad, setModalidad] = useState<Modalidad | "">("");
  const [pedidoMesa, setPedidoMesa] = useState("");
  const [pedidoClienteNombre, setPedidoClienteNombre] = useState("");
  const [pedidoClienteTelefono, setPedidoClienteTelefono] = useState("");
  const [pedidoDireccion, setPedidoDireccion] = useState("");
  const [pedidoObservacion, setPedidoObservacion] = useState("");

  // ── Cobro (solo CONTADO, no se persiste — solo ayuda al cajero) ───────────
  const [montoRecibido, setMontoRecibido] = useState("");
  const [metodoPago, setMetodoPago] = useState<MetodoPago>("efectivo");

  // ── Modal buscador ─────────────────────────────────────────────────────────
  // Arranca abierto: al entrar a "Nueva venta" el buscador ya aparece desplegado
  // (un solo paso desde Ventas → Nueva venta → cargar productos).
  const [pickerOpen, setPickerOpen] = useState(true);

  // ── Popup de detalle de pago (transferencia / tarjeta) ───────────────────────
  const [pagoDetalleOpen, setPagoDetalleOpen] = useState(false);
  const [guardandoVenta, setGuardandoVenta] = useState(false);
  const [pagoError, setPagoError] = useState<string | null>(null);

  /**
   * Agregado desde el panel de detalle del buscador: arma la LineaVenta con los
   * datos del modal (producto, cantidad, precio, IVA y tipo de precio elegido
   * ahí). Mantiene el modal abierto si todo OK para seguir cargando.
   */
  function handleAgregarDesdePicker(payload: AgregarVentaPayload): boolean {
    const { producto: p, cantidad, precio_input, iva, tipo_precio, precio_incluye_iva } = payload;
    const precioPyg = precio_input;
    const ctrlStock = (p as { controla_stock?: boolean }).controla_stock !== false;
    if (ctrlStock) {
      const yaEnCarrito = items.filter((i) => i.producto_id === p.id).reduce((s, i) => s + i.cantidad, 0);
      const disp = p.stock_actual - yaEnCarrito;
      if (cantidad > disp) {
        return false;
      }
    }
    const tasa = tasaIvaVenta(iva);
    const bruto = cantidad * precioPyg;
    // precio_incluye_iva=true → el bruto YA contiene IVA, se extrae.
    // precio_incluye_iva=false → el bruto es base imponible, IVA se suma encima.
    const subtotal = tasa > 0 && precio_incluye_iva ? bruto / (1 + tasa) : bruto;
    const montoIva = tasa > 0 ? (precio_incluye_iva ? bruto - subtotal : subtotal * tasa) : 0;
    const totalLinea = subtotal + montoIva;

    setItems((prev) => [
      ...prev,
      {
        producto_id: p.id,
        producto_nombre: p.nombre,
        sku: p.sku,
        cantidad,
        precio_venta_original: precio_input,
        precio_venta: precioPyg,
        tipo_iva: iva,
        tipo_precio,
        subtotal,
        monto_iva: montoIva,
        total_linea: totalLinea,
      },
    ]);
    setErrorVenta(null);
    return true;
  }

  // ── Cálculos ───────────────────────────────────────────────────────────────
  const tipoCambioNum = 1;

  const totalSubtotal = items.reduce((s, i) => s + i.subtotal, 0);
  const totalIva      = items.reduce((s, i) => s + i.monto_iva, 0);
  const totalGeneral  = items.reduce((s, i) => s + i.total_linea, 0);
  const pedidoValido = (() => {
    // En verticales no-gastronomía no hay concepto de modalidad de pedido.
    if (!ES_GASTRONOMIA) return true;
    if (modalidad === "") return false;
    if (modalidad === "delivery") return pedidoClienteTelefono.trim().length > 0 && pedidoDireccion.trim().length > 0;
    return true; // local + carry_out: todos opcionales
  })();
  const presupuestoValido = !esPresupuesto || (obraMeta.titulo_obra.trim().length > 0);
  const ventaValida   = items.length > 0 && pedidoValido && presupuestoValido;

  // Vuelto (solo informativo, no se persiste)
  const montoRecibidoNum = parseImporte(montoRecibido);
  const vuelto           = montoRecibidoNum - totalGeneral;

  function handleEliminarLinea(index: number) {
    setItems((prev) => prev.filter((_, i) => i !== index));
  }

  /**
   * Arma el pedido para el kanban según vertical:
   * - Gastronomía con modalidad elegida: info completa (mesa/delivery/etc).
   * - Gastronomía sin modalidad: undefined (el form bloquea el submit antes).
   * - No-gastronomía (distribuidora): modalidad=null → el backend igual crea
   *   el pedido en el kanban con título genérico "Venta {numero}".
   */
  function buildPedidoCocina() {
    // NCG (constructora): no aplica el concepto de "pedido cocina" / tarjeta
    // automática en kanban. Las obras son proyectos largos imputados a mano,
    // no una tarjeta por venta. Devolver undefined evita el INSERT en
    // proyectos y el error "Tipo de proyecto 'pedido' no configurado".
    if (!ES_GASTRONOMIA) return undefined;
    return modalidad === ""
      ? undefined
      : {
          modalidad,
          mesa: modalidad === "local" ? pedidoMesa.trim() || null : null,
          cliente_nombre: pedidoClienteNombre.trim() || null,
          cliente_telefono: pedidoClienteTelefono.trim() || null,
          direccion_entrega: pedidoDireccion.trim() || null,
          observacion: pedidoObservacion.trim() || null,
        };
  }

  /**
   * Guardado real (con o sin detalle de pago). Si OK abre el ticket y vuelve al
   * listado. Devuelve el resultado para que el caller muestre el error donde
   * corresponda (página para efectivo, popup para transferencia/tarjeta).
   */
  async function guardarVenta(pagoDetalle: PagoDetalleVenta | null) {
    const resultado = await saveVenta(
      {
        items,
        moneda,
        tipo_cambio:  tipoCambioNum,
        subtotal:     totalSubtotal,
        monto_iva:    totalIva,
        total:        totalGeneral,
        tipo_venta:   tipoVenta,
        metodo_pago:  metodoPago,
      },
      esPresupuesto ? undefined : buildPedidoCocina(),
      esPresupuesto ? null : pagoDetalle,
      {
        tipoDocumento: esPresupuesto ? "presupuesto" : "venta",
        presupuestoMeta: esPresupuesto ? obraMetaToPayload(obraMeta) : null,
      }
    );
    if (resultado.success) {
      if (!esPresupuesto) {
        // Solo ventas reales generan ticket/comandas para imprimir.
        try {
          window.open(`/api/ventas/${resultado.venta.id}/ticket?mode=comandas&auto=1`, "_blank", "noopener");
        } catch {}
      }
      router.push("/ventas");
    }
    return resultado;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorVenta(null);
    if (!ventaValida) return;

    // Transferencia / tarjeta: primero capturamos los datos de conciliación en
    // el popup; el guardado se dispara al confirmar ahí (obligatorio).
    if (metodoPago === "transferencia" || metodoPago === "tarjeta") {
      setPagoError(null);
      setPagoDetalleOpen(true);
      return;
    }

    // Efectivo: guardado directo.
    const r = await guardarVenta(null);
    if (!r.success) setErrorVenta(r.error);
  }

  /** Confirmación desde el popup de transferencia/tarjeta. */
  async function confirmarConDetalle(detalle: PagoDetalleVenta) {
    setPagoError(null);
    setGuardandoVenta(true);
    const r = await guardarVenta(detalle);
    if (!r.success) {
      setPagoError(r.error);
      setGuardandoVenta(false);
    }
    // En éxito se navega a /ventas y el modal se desmonta con la página.
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-8">

      <PageHeader
        eyebrow={esPresupuesto ? "NCG · Comercial" : "NCG · Operaciones"}
        title={esPresupuesto ? "Nuevo presupuesto de obra" : "Nueva venta de material"}
        description={esPresupuesto
          ? "Cotización de obra para el cliente. No descuenta stock ni genera movimientos. Al aprobarse puede convertirse en obra."
          : undefined}
        backHref="/ventas"
        backLabel="Ventas"
      />

      {esPresupuesto && (
        <div className="rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm text-indigo-800">
          <strong>Modo presupuesto de obra:</strong> esta operación se guarda como presupuesto
          pendiente de aprobación. No afecta el stock ni genera ticket de cobro.
        </div>
      )}

      {esPresupuesto && (
        <DatosObraSection meta={obraMeta} setMeta={setObraMeta} />
      )}

      <form onSubmit={handleSubmit} className="space-y-6 max-w-7xl">

        {/* ── SECCIÓN 3: Carrito + totales + confirmar ─────────────────────── */}
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-4 sm:p-6">
          <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest">
              {esPresupuesto ? "Partidas del presupuesto" : "Productos en esta venta"}
            </p>
            <div className="flex items-center gap-2">
              {esPresupuesto && (
                <button
                  type="button"
                  onClick={() => setPartidaManualOpen(true)}
                  className="shrink-0 inline-flex items-center gap-1.5 bg-white border border-[#0EA5E9] text-[#0EA5E9] hover:bg-sky-50 px-3 py-2 rounded-lg text-sm font-medium transition-colors active:scale-95"
                >
                  + Partida manual
                </button>
              )}
              <button
                type="button"
                onClick={() => setPickerOpen(true)}
                className="shrink-0 inline-flex items-center gap-1.5 bg-[#0EA5E9] hover:bg-[#0284C7] text-white px-3 py-2 rounded-lg text-sm font-medium transition-colors shadow-sm active:scale-95"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 shrink-0">
                  <path d="M10.75 4.75a.75.75 0 0 0-1.5 0v4.5h-4.5a.75.75 0 0 0 0 1.5h4.5v4.5a.75.75 0 0 0 1.5 0v-4.5h4.5a.75.75 0 0 0 0-1.5h-4.5v-4.5Z" />
                </svg>
                {esPresupuesto ? "Agregar material" : "Agregar producto"}
              </button>
            </div>
          </div>

          {items.length === 0 ? (
            <div className="py-10 text-center text-gray-400 text-sm border-2 border-dashed border-gray-200 rounded-lg">
              {esPresupuesto
                ? "Todavía no agregaste partidas al presupuesto."
                : "Todavía no agregaste productos a esta venta."}
            </div>
          ) : (
            <>
              {/* min-w fuerza scroll horizontal en mobile (9 columnas).
                  Columnas secundarias (SKU, Subtotal, IVA Gs) se ocultan
                  progresivamente: en mobile solo Producto/Cant/Precio/Total/eliminar. */}
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] sm:min-w-0 text-sm text-left">
                  <thead>
                    <tr className="bg-slate-50 text-slate-600 text-sm font-semibold">
                      <th className="py-2.5 pr-3 font-medium">Producto</th>
                      <th className="py-2.5 pr-3 font-medium hidden md:table-cell">SKU</th>
                      <th className="py-2.5 pr-3 font-medium text-right">Cant.</th>
                      <th className="py-2.5 pr-3 font-medium text-right">Precio unit.</th>
                      <th className="py-2.5 pr-3 font-medium text-center hidden md:table-cell">IVA</th>
                      <th className="py-2.5 pr-3 font-medium text-right hidden lg:table-cell">Subtotal</th>
                      <th className="py-2.5 pr-3 font-medium text-right hidden lg:table-cell">IVA €</th>
                      <th className="py-2.5 pr-3 font-medium text-right">Total</th>
                      <th className="py-2.5 font-medium"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item, idx) => (
                      <tr key={idx} className="border-b border-slate-200 last:border-0 hover:bg-slate-50 transition-colors">
                        <td className="py-3 pr-3 font-medium text-gray-800">
                          {item.producto_nombre}
                        </td>
                        <td className="py-3 pr-3 font-mono text-xs text-gray-500 hidden md:table-cell">
                          {item.sku}
                        </td>
                        <td className="py-3 pr-3 text-right tabular-nums">
                          {item.cantidad}
                        </td>
                        <td className="py-3 pr-3 text-right tabular-nums text-gray-600 text-xs">
                          <div>{formatGs(item.precio_venta)}</div>
                          <span className={`inline-block mt-0.5 text-[10px] font-medium px-1.5 py-0.5 rounded-full ${
                            item.tipo_precio === "mayorista"
                              ? "bg-indigo-100 text-indigo-700"
                              : item.tipo_precio === "costo"
                              ? "bg-amber-100 text-amber-700"
                              : "bg-slate-100 text-slate-600"
                          }`}>
                            {tipoPrecioLabel[item.tipo_precio]}
                          </span>
                        </td>
                        <td className="py-3 pr-3 text-center hidden md:table-cell">
                          <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-600">
                            {ivaLabel[item.tipo_iva]}
                          </span>
                        </td>
                        <td className="py-3 pr-3 text-right tabular-nums text-gray-600 text-xs hidden lg:table-cell">
                          {formatGs(item.subtotal)}
                        </td>
                        <td className="py-3 pr-3 text-right tabular-nums text-gray-500 text-xs hidden lg:table-cell">
                          {item.monto_iva > 0 ? formatGs(item.monto_iva) : "—"}
                        </td>
                        <td className="py-3 pr-3 text-right tabular-nums font-semibold text-gray-800">
                          {formatGs(item.total_linea)}
                        </td>
                        <td className="py-3 text-center">
                          <button
                            type="button"
                            onClick={() => handleEliminarLinea(idx)}
                            className="inline-flex items-center justify-center min-w-[40px] min-h-[40px] text-red-400 hover:text-red-700 transition-colors rounded hover:bg-red-50"
                            title="Eliminar producto"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                              <path fillRule="evenodd" d="M8.75 1A2.75 2.75 0 0 0 6 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 1 0 .23 1.482l.149-.022.841 10.518A2.75 2.75 0 0 0 7.596 19h4.807a2.75 2.75 0 0 0 2.742-2.53l.841-10.52.149.023a.75.75 0 0 0 .23-1.482A41.03 41.03 0 0 0 14 4.193V3.75A2.75 2.75 0 0 0 11.25 1h-2.5ZM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4ZM8.58 7.72a.75.75 0 0 0-1.5.06l.3 7.5a.75.75 0 1 0 1.5-.06l-.3-7.5Zm4.34.06a.75.75 0 1 0-1.5-.06l-.3 7.5a.75.75 0 1 0 1.5.06l.3-7.5Z" clipRule="evenodd" />
                            </svg>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Totales + Cobro (vuelto) */}
              <div className="mt-5 flex justify-end">
                <div className="w-full md:w-80 space-y-3">
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs text-gray-500">
                      <span>Subtotal sin IVA</span>
                      <span className="tabular-nums">{formatGs(totalSubtotal)}</span>
                    </div>
                    <div className="flex justify-between text-xs text-gray-500">
                      <span>IVA repercutido</span>
                      <span className="tabular-nums">
                        {totalIva > 0 ? formatGs(totalIva) : "—"}
                      </span>
                    </div>
                    <div className="flex justify-between text-base font-bold text-gray-900 pt-2 border-t border-gray-200">
                      <span>TOTAL con IVA</span>
                      <span className="tabular-nums">{formatGs(totalGeneral)}</span>
                    </div>
                  </div>

                  {tipoVenta === "CONTADO" && !esPresupuesto && (
                    <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-2">
                      <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                        Cobro
                      </p>
                      <div>
                        <label className="block text-xs text-gray-600 mb-1">Método de pago</label>
                        <div className="grid grid-cols-3 gap-1">
                          {(["efectivo", "tarjeta", "transferencia"] as MetodoPago[]).map((m) => (
                            <button
                              key={m}
                              type="button"
                              onClick={() => setMetodoPago(m)}
                              className={`text-xs py-1.5 rounded-md border transition-colors ${
                                metodoPago === m
                                  ? "border-[#0EA5E9] bg-[#0EA5E9]/10 text-[#0EA5E9] font-medium"
                                  : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                              }`}
                            >
                              {m === "efectivo" ? "Efectivo" : m === "tarjeta" ? "Tarjeta" : "Transfer."}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs text-gray-600 mb-1">
                          Monto recibido (€)
                        </label>
                        <MontoInput
                          value={montoRecibido}
                          onChange={(n) => setMontoRecibido(String(n))}
                          placeholder="Ej: 100.000"
                          className={inputClass}
                          decimals
                        />
                      </div>
                      {montoRecibidoNum > 0 && (
                        <div className="flex justify-between text-sm pt-2 border-t border-slate-200">
                          {vuelto >= 0 ? (
                            <>
                              <span className="text-gray-600">Vuelto</span>
                              <span className="font-bold text-emerald-600 tabular-nums">
                                {formatGs(vuelto)}
                              </span>
                            </>
                          ) : (
                            <>
                              <span className="text-gray-600">Falta</span>
                              <span className="font-bold text-red-600 tabular-nums">
                                {formatGs(Math.abs(vuelto))}
                              </span>
                            </>
                          )}
                        </div>
                      )}
                      <p className="text-[11px] text-gray-400 leading-snug">
                        Cálculo solo informativo — no se guarda en la venta.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}

          {/* Modalidad del pedido (gastronómico) — solo en vertical gastronomía */}
          {ES_GASTRONOMIA && (
          <div className="mt-6 rounded-lg border border-amber-200 bg-amber-50/40 px-4 py-4">
            <p className="text-sm font-semibold text-slate-800 mb-3">
              Modalidad del pedido <span className="text-red-500">*</span>
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {([
                { v: "local",     label: "En local" },
                { v: "delivery",  label: "Delivery" },
                { v: "carry_out", label: "Retiro / Carry out" },
              ] as Array<{ v: Modalidad; label: string }>).map((opt) => (
                <label
                  key={opt.v}
                  className={`flex items-center gap-2 rounded-md border px-3 py-2 text-sm cursor-pointer transition ${
                    modalidad === opt.v
                      ? "border-amber-500 bg-white text-amber-700 font-medium"
                      : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  <input
                    type="radio"
                    name="modalidad"
                    value={opt.v}
                    checked={modalidad === opt.v}
                    onChange={() => setModalidad(opt.v)}
                    className="h-4 w-4 text-amber-600 focus:ring-amber-500"
                  />
                  {opt.label}
                </label>
              ))}
            </div>

            {modalidad === "local" && (
              <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Número de mesa</label>
                  <input
                    type="text"
                    value={pedidoMesa}
                    onChange={(e) => setPedidoMesa(e.target.value)}
                    placeholder="Opcional — ej: 3"
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Observación</label>
                  <input
                    type="text"
                    value={pedidoObservacion}
                    onChange={(e) => setPedidoObservacion(e.target.value)}
                    placeholder='Ej: "sin cebolla"'
                    className={inputClass}
                  />
                </div>
              </div>
            )}

            {modalidad === "delivery" && (
              <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Nombre cliente</label>
                  <input
                    type="text"
                    value={pedidoClienteNombre}
                    onChange={(e) => setPedidoClienteNombre(e.target.value)}
                    placeholder="Opcional"
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    Teléfono <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={pedidoClienteTelefono}
                    onChange={(e) => setPedidoClienteTelefono(e.target.value)}
                    placeholder="09xx xxx xxx"
                    className={inputClass}
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    Dirección de entrega <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={pedidoDireccion}
                    onChange={(e) => setPedidoDireccion(e.target.value)}
                    placeholder="Calle, número, referencia"
                    className={inputClass}
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-xs font-medium text-slate-600 mb-1">Observación</label>
                  <input
                    type="text"
                    value={pedidoObservacion}
                    onChange={(e) => setPedidoObservacion(e.target.value)}
                    placeholder="Notas para el repartidor o la cocina"
                    className={inputClass}
                  />
                </div>
              </div>
            )}

            {modalidad === "carry_out" && (
              <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Nombre cliente</label>
                  <input
                    type="text"
                    value={pedidoClienteNombre}
                    onChange={(e) => setPedidoClienteNombre(e.target.value)}
                    placeholder="Opcional"
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Teléfono</label>
                  <input
                    type="text"
                    value={pedidoClienteTelefono}
                    onChange={(e) => setPedidoClienteTelefono(e.target.value)}
                    placeholder="Opcional"
                    className={inputClass}
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-xs font-medium text-slate-600 mb-1">Observación</label>
                  <input
                    type="text"
                    value={pedidoObservacion}
                    onChange={(e) => setPedidoObservacion(e.target.value)}
                    placeholder='Ej: "pasa en 20 min"'
                    className={inputClass}
                  />
                </div>
              </div>
            )}

            {modalidad === "" && (
              <p className="mt-2 text-xs text-amber-700">
                Elegí una modalidad antes de confirmar la venta.
              </p>
            )}
          </div>
          )}

          {/* Error confirmar */}
          {errorVenta && (
            <div className="mt-4 flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-xs text-red-700">
              <span className="text-base leading-none mt-0.5">⚠</span>
              <span className="font-medium">{errorVenta}</span>
            </div>
          )}

          {/* Acciones — stack vertical full-width en mobile (mas facil de tappear),
              fila en sm+. Confirmar en orden visual primero (primary). */}
          <div className="mt-6 flex flex-col-reverse sm:flex-row gap-3">
            <button
              type="button"
              onClick={() => router.push("/ventas")}
              className="border border-slate-200 px-6 py-3 rounded-lg text-sm hover:bg-slate-50 transition-colors min-h-[48px] w-full sm:w-auto"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={!ventaValida}
              className="bg-[#0EA5E9] hover:bg-[#0284C7] text-white px-6 py-3 rounded-lg text-sm font-medium transition-colors shadow-sm disabled:opacity-40 disabled:cursor-not-allowed active:scale-95 min-h-[48px] w-full sm:w-auto"
            >
              {esPresupuesto ? "Guardar presupuesto" : "Confirmar venta"}
            </button>
          </div>

        </div>

      </form>

      <ProductPickerModal
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onAgregar={handleAgregarDesdePicker}
        excludeIds={items.map((i) => i.producto_id)}
        moneda={moneda}
        tipoCambio={tipoCambioNum}
        ivaDefault="21%"
        tasasIva={["EXENTA", "4%", "10%", "21%"]}
        precioIncluyeIvaDefault={false}
      />

      <PagoDetalleModal
        open={pagoDetalleOpen}
        metodo={metodoPago === "tarjeta" ? "tarjeta" : "transferencia"}
        totalVenta={totalGeneral}
        guardando={guardandoVenta}
        errorExterno={pagoError}
        onClose={() => {
          if (!guardandoVenta) setPagoDetalleOpen(false);
        }}
        onConfirmar={confirmarConDetalle}
      />

      {esPresupuesto && partidaManualOpen && (
        <PartidaManualModal
          onClose={() => setPartidaManualOpen(false)}
          onAgregar={(linea) => { setItems((p) => [...p, linea]); setPartidaManualOpen(false); }}
        />
      )}
    </div>
  );
}

// ── Datos de la obra (sección del presupuesto) ─────────────────────────────

type ObraMeta = {
  titulo_obra: string;
  tipo_obra_id: string;
  ubicacion: string;
  superficie_m2: string;
  descripcion: string;
  validez_dias: string;
  condiciones: string;
};

function obraMetaToPayload(m: ObraMeta): Record<string, unknown> {
  return {
    titulo_obra: m.titulo_obra.trim() || null,
    tipo_obra_id: m.tipo_obra_id || null,
    ubicacion: m.ubicacion.trim() || null,
    superficie_m2: m.superficie_m2.trim() !== "" ? Number(m.superficie_m2) || null : null,
    descripcion: m.descripcion.trim() || null,
    validez_dias: m.validez_dias.trim() !== "" ? Number(m.validez_dias) || null : null,
    condiciones: m.condiciones.trim() || null,
  };
}

function DatosObraSection({ meta, setMeta }: { meta: ObraMeta; setMeta: React.Dispatch<React.SetStateAction<ObraMeta>> }) {
  const [tipos, setTipos] = React.useState<{ id: string; nombre: string }[]>([]);
  React.useEffect(() => {
    fetch("/api/proyectos/tipos", { credentials: "include", cache: "no-store" })
      .then((r) => r.json())
      .then((j: { success?: boolean; data?: Array<{ id: string; nombre: string }> }) => {
        if (j.success && Array.isArray(j.data)) setTipos(j.data.map((t) => ({ id: t.id, nombre: t.nombre })));
      })
      .catch(() => { /* tolerante */ });
  }, []);
  const setField = <K extends keyof ObraMeta>(k: K, v: ObraMeta[K]) => setMeta((p) => ({ ...p, [k]: v }));
  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-4 sm:p-6 max-w-7xl">
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-4">Datos de la obra</p>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">Título de la obra <span className="text-red-500">*</span></label>
          <input value={meta.titulo_obra} onChange={(e) => setField("titulo_obra", e.target.value)}
            placeholder="Ej. Impermeabilización cubierta vivienda Pérez"
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#0EA5E9]" />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">Tipo de obra</label>
          <select value={meta.tipo_obra_id} onChange={(e) => setField("tipo_obra_id", e.target.value)}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#0EA5E9]">
            <option value="">— Tipo por defecto —</option>
            {tipos.map((t) => <option key={t.id} value={t.id}>{t.nombre}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">Ubicación / zona</label>
          <input value={meta.ubicacion} onChange={(e) => setField("ubicacion", e.target.value)}
            placeholder="Ej. Madrid Centro"
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#0EA5E9]" />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">Superficie estimada (m²)</label>
          <input type="text" inputMode="decimal"
            value={meta.superficie_m2} onChange={(e) => setField("superficie_m2", e.target.value.replace(/[^\d.,-]/g, ""))}
            placeholder="80"
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#0EA5E9]" />
        </div>
        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-slate-700 mb-1.5">Descripción del trabajo</label>
          <textarea value={meta.descripcion} onChange={(e) => setField("descripcion", e.target.value)} rows={2}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#0EA5E9]" />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">Validez del presupuesto (días)</label>
          <input type="number" min={1} value={meta.validez_dias}
            onChange={(e) => setField("validez_dias", e.target.value)}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#0EA5E9]" />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">Observaciones / condiciones</label>
          <input value={meta.condiciones} onChange={(e) => setField("condiciones", e.target.value)}
            placeholder="Ej. 30% al iniciar, 70% al entregar"
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#0EA5E9]" />
        </div>
      </div>
    </div>
  );
}

// ── Modal de partida manual ─────────────────────────────────────────────────

const TIPO_PARTIDA_OPTS: { value: string; label: string }[] = [
  { value: "mano_obra", label: "Mano de obra" },
  { value: "servicio", label: "Servicio" },
  { value: "transporte", label: "Transporte" },
  { value: "otro", label: "Otro gasto" },
];

function PartidaManualModal({ onClose, onAgregar }: { onClose: () => void; onAgregar: (l: LineaVenta) => void }) {
  const [tipo, setTipo] = React.useState<string>("mano_obra");
  const [descripcion, setDescripcion] = React.useState("");
  const [cantidad, setCantidad] = React.useState("1");
  const [unidad, setUnidad] = React.useState("UNIDAD");
  const [precio, setPrecio] = React.useState("");
  const [iva, setIva] = React.useState<TipoIvaVenta>("21%");
  const [precioIncluyeIva, setPrecioIncluyeIva] = React.useState(false);

  const cantNum = parseImporte(cantidad);
  const precioNum = parseImporte(precio);
  const tasa = iva === "21%" ? 0.21 : iva === "10%" ? 0.10 : iva === "5%" ? 0.05 : iva === "4%" ? 0.04 : 0;
  const bruto = cantNum * precioNum;
  const subtotal = tasa > 0 && precioIncluyeIva ? bruto / (1 + tasa) : bruto;
  const ivaMonto = tasa > 0 ? (precioIncluyeIva ? bruto - subtotal : subtotal * tasa) : 0;
  const totalLinea = subtotal + ivaMonto;
  const valida = descripcion.trim() && cantNum > 0 && precioNum > 0;

  function handleAgregar(e: React.FormEvent) {
    e.preventDefault();
    if (!valida) return;
    const linea: LineaVenta = {
      producto_id: "",
      producto_nombre: descripcion.trim(),
      sku: unidad.trim().toUpperCase() || "UNIDAD",
      cantidad: cantNum,
      precio_venta_original: precioNum,
      precio_venta: precioNum,
      tipo_iva: iva,
      tipo_precio: "minorista",
      subtotal,
      monto_iva: ivaMonto,
      total_linea: totalLinea,
      tipo_partida: tipo,
      descripcion: descripcion.trim(),
    };
    onAgregar(linea);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" onClick={onClose}>
      <div className="w-full max-w-xl rounded-2xl bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="border-b border-slate-200 px-5 py-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-900">Agregar partida manual</h2>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-700">✕</button>
        </div>
        <form onSubmit={handleAgregar} className="space-y-4 p-5">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Tipo</label>
              <select value={tipo} onChange={(e) => setTipo(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm">
                {TIPO_PARTIDA_OPTS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Unidad</label>
              <input value={unidad} onChange={(e) => setUnidad(e.target.value)}
                placeholder="UNIDAD / HORA / KM"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Descripción <span className="text-red-500">*</span></label>
              <input value={descripcion} onChange={(e) => setDescripcion(e.target.value)}
                placeholder="Ej. Mano de obra instalación lámina impermeabilizante"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Cantidad <span className="text-red-500">*</span></label>
              <input type="text" inputMode="decimal" value={cantidad}
                onChange={(e) => setCantidad(e.target.value.replace(/[^\d.,-]/g, ""))}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                {precioIncluyeIva ? "Precio unitario con IVA" : "Precio unitario sin IVA"} <span className="text-red-500">*</span>
              </label>
              <input type="text" inputMode="decimal" value={precio}
                onChange={(e) => setPrecio(e.target.value.replace(/[^\d.,-]/g, ""))}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
              <label className="mt-1.5 inline-flex items-center gap-1.5 text-[11px] text-slate-500 cursor-pointer">
                <input type="checkbox" checked={precioIncluyeIva}
                  onChange={(e) => setPrecioIncluyeIva(e.target.checked)} />
                El precio ingresado incluye IVA
              </label>
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1.5">IVA</label>
              <div className="flex border border-slate-200 rounded-lg overflow-hidden">
                {(["EXENTA", "4%", "10%", "21%"] as TipoIvaVenta[]).map((opt) => (
                  <button key={opt} type="button" onClick={() => setIva(opt)}
                    className={`flex-1 py-1.5 text-xs font-medium ${iva === opt ? "bg-[#0EA5E9] text-white" : "bg-white text-slate-600 hover:bg-slate-50"}`}>
                    {opt === "EXENTA" ? "Exento" : opt}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-600 space-y-0.5">
            <div className="flex justify-between"><span>Subtotal sin IVA</span><span className="tabular-nums">{formatGs(subtotal)}</span></div>
            <div className="flex justify-between"><span>IVA {iva === "EXENTA" ? "" : iva}</span><span className="tabular-nums">{ivaMonto > 0 ? formatGs(ivaMonto) : "—"}</span></div>
            <div className="flex justify-between font-semibold text-slate-800 border-t border-slate-200 pt-1"><span>Total</span><span className="tabular-nums">{formatGs(totalLinea)}</span></div>
          </div>
          <div className="flex justify-end gap-2 border-t border-slate-200 pt-4">
            <button type="button" onClick={onClose} className="rounded-lg border border-slate-200 px-3 py-2 text-sm">Cancelar</button>
            <button type="submit" disabled={!valida}
              className="rounded-lg bg-[#0EA5E9] px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-[#0284C7] disabled:opacity-40">
              Agregar partida
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
