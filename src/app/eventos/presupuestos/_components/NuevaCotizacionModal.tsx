"use client";

import { useEffect, useMemo, useState } from "react";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import { getEventos, getPaquetes, getServicios } from "@/lib/eventos/storage";
import { getClientes } from "@/lib/clientes/storage";
import type { Cliente } from "@/lib/clientes/types";
import type {
  Evento,
  IvaPresupuesto,
  Paquete,
  ServicioCatalogo,
  TipoItemPresupuesto,
} from "@/lib/eventos/types";

const TIPOS_EVENTO = [
  "Boda",
  "Cumpleaños",
  "Corporativo",
  "15 años",
  "Aniversario",
  "Comunión",
  "Bautismo",
  "Otro",
];

function nombreCliente(c: Cliente): string {
  return c.tipo_cliente === "empresa" && c.empresa ? c.empresa : c.nombre_contacto;
}
function fmtEur(n: number) {
  return `€ ${n.toLocaleString("es-PY", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

interface LineaDraft {
  tipo: TipoItemPresupuesto;
  ref_id: string | null;
  descripcion: string;
  cantidad: number;
  precio_unitario: number;
  unidad: string;
  categoria: string;
  descuento_pct: number;
  iva_pct: IvaPresupuesto;
}

const inputCls =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#4FAEB2]/40 focus:border-[#4FAEB2]";
const inputSm =
  "w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-[#4FAEB2]/40 focus:border-[#4FAEB2]";
const labelCls = "text-[11px] font-semibold uppercase tracking-wider text-slate-500";

export interface NuevaCotizacionModalProps {
  open: boolean;
  onClose: () => void;
  /** Se llama después de guardar exitosamente. */
  onSaved: () => void;
}

/**
 * Modal para armar una nueva cotización (presupuesto). Dos modos:
 *   - "nuevo": cotización standalone (sin evento aún; se crea evento al aprobar).
 *   - "existente": presupuesto vinculado a un evento existente.
 * En ambos modos el cuerpo del form (líneas) es el mismo.
 */
export default function NuevaCotizacionModal({ open, onClose, onSaved }: NuevaCotizacionModalProps) {
  const [modo, setModo] = useState<"nuevo" | "existente">("nuevo");

  // Catálogos.
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [servicios, setServicios] = useState<ServicioCatalogo[]>([]);
  const [paquetes, setPaquetes] = useState<Paquete[]>([]);
  const [catCargado, setCatCargado] = useState(false);

  // Cabecera.
  // Cliente: 2 modos. 'existente' usa el select; 'nuevo' guarda snapshot.
  // El cliente en la DB se crea recién si la cotización se aprueba.
  const [modoCliente, setModoCliente] = useState<"existente" | "nuevo">("nuevo");
  const [clienteId, setClienteId] = useState("");
  const [clienteNombreSnap, setClienteNombreSnap] = useState("");
  const [clienteTelefonoSnap, setClienteTelefonoSnap] = useState("");
  const [clienteEmailSnap, setClienteEmailSnap] = useState("");
  const [eventoId, setEventoId] = useState("");
  const [titulo, setTitulo] = useState("");
  const [tipoEvento, setTipoEvento] = useState("");
  const [fechaEvento, setFechaEvento] = useState("");
  const [invitados, setInvitados] = useState("");
  const [validez, setValidez] = useState("30");
  const [observaciones, setObservaciones] = useState("");

  // Líneas.
  const [lineas, setLineas] = useState<LineaDraft[]>([]);

  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || catCargado) return;
    Promise.all([getClientes(), getEventos(), getServicios(), getPaquetes()]).then(
      ([cs, es, ss, ps]) => {
        setClientes(cs);
        setEventos(es);
        setServicios(ss);
        setPaquetes(ps);
        setCatCargado(true);
      }
    );
  }, [open, catCargado]);

  const totales = useMemo(() => {
    let base = 0;
    let iva = 0;
    for (const l of lineas) {
      const bruto = l.cantidad * l.precio_unitario;
      const sub = bruto * (1 - l.descuento_pct / 100);
      base += sub;
      iva += sub * (l.iva_pct / 100);
    }
    return { base, iva, total: base + iva };
  }, [lineas]);

  const addLinea = (tipo: TipoItemPresupuesto = "texto") => {
    setLineas((prev) => [
      ...prev,
      {
        tipo,
        ref_id: null,
        descripcion: "",
        cantidad: 1,
        precio_unitario: 0,
        unidad: "servicio",
        categoria: "",
        descuento_pct: 0,
        iva_pct: 0,
      },
    ]);
  };
  const updateLinea = (idx: number, patch: Partial<LineaDraft>) => {
    setLineas((prev) =>
      prev.map((l, i) => {
        if (i !== idx) return l;
        const m = { ...l, ...patch };
        if (patch.ref_id !== undefined && patch.ref_id) {
          if (m.tipo === "servicio") {
            const s = servicios.find((x) => x.id === patch.ref_id);
            if (s) {
              if (!m.descripcion) m.descripcion = s.nombre;
              if (!m.precio_unitario) m.precio_unitario = s.precio_base;
              if (!m.categoria && s.categoria) m.categoria = s.categoria;
            }
          } else if (m.tipo === "paquete") {
            const p = paquetes.find((x) => x.id === patch.ref_id);
            if (p) {
              if (!m.descripcion) m.descripcion = p.nombre;
              if (!m.precio_unitario) m.precio_unitario = p.precio_total;
            }
          }
        }
        if (patch.tipo !== undefined && patch.tipo !== l.tipo) m.ref_id = null;
        return m;
      })
    );
  };
  const removeLinea = (idx: number) => setLineas((prev) => prev.filter((_, i) => i !== idx));

  const reset = () => {
    setModo("nuevo");
    setModoCliente("nuevo");
    setClienteId("");
    setClienteNombreSnap("");
    setClienteTelefonoSnap("");
    setClienteEmailSnap("");
    setEventoId("");
    setTitulo("");
    setTipoEvento("");
    setFechaEvento("");
    setInvitados("");
    setValidez("30");
    setObservaciones("");
    setLineas([]);
    setError(null);
  };

  const guardar = async () => {
    setError(null);
    if (modo === "existente") {
      if (!eventoId) return setError("Elegí un evento existente.");
    } else {
      if (modoCliente === "existente" && !clienteId) {
        return setError("Elegí un cliente existente o cambiá a Cliente nuevo.");
      }
      if (modoCliente === "nuevo" && !clienteNombreSnap.trim()) {
        return setError("Cargá al menos el nombre del cliente.");
      }
      if (!titulo.trim()) return setError("Cargá el título del evento.");
    }
    if (lineas.length === 0) return setError("Agregá al menos una línea.");
    for (const l of lineas) {
      if (!l.descripcion.trim()) return setError("Todas las líneas necesitan descripción.");
      if (l.cantidad <= 0) return setError("La cantidad debe ser mayor a 0.");
    }

    setGuardando(true);
    const itemsPayload = lineas.map((l, i) => ({
      tipo: l.tipo,
      ref_id: l.ref_id,
      descripcion: l.descripcion.trim(),
      cantidad: l.cantidad,
      precio_unitario: l.precio_unitario,
      unidad: l.unidad || "servicio",
      categoria: l.categoria || null,
      descuento_pct: l.descuento_pct,
      iva_pct: l.iva_pct,
      sort_order: i,
    }));

    let url: string;
    let body: Record<string, unknown>;
    if (modo === "existente") {
      url = `/api/eventos/${eventoId}/presupuestos`;
      body = {
        fecha: new Date().toISOString().slice(0, 10),
        validez_dias: parseInt(validez) || 30,
        observaciones: observaciones.trim() || null,
        items: itemsPayload,
      };
    } else {
      url = "/api/eventos/presupuestos";
      body = {
        // Uno de los dos: cliente_id existente O snapshot manual.
        cliente_id: modoCliente === "existente" ? clienteId : null,
        cliente_nombre_snapshot: modoCliente === "nuevo" ? clienteNombreSnap.trim() : null,
        cliente_telefono_snapshot: modoCliente === "nuevo" ? clienteTelefonoSnap.trim() || null : null,
        cliente_email_snapshot: modoCliente === "nuevo" ? clienteEmailSnap.trim() || null : null,
        titulo_evento: titulo.trim(),
        tipo_evento: tipoEvento || null,
        fecha_evento_aprox: fechaEvento || null,
        cantidad_invitados: invitados ? parseInt(invitados) : null,
        observaciones: observaciones.trim() || null,
        validez_dias: parseInt(validez) || 30,
        items: itemsPayload,
      };
    }

    try {
      const r = await fetch(url, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const j = await r.json().catch(() => ({}));
      setGuardando(false);
      if (!r.ok || !(j as { success?: boolean }).success) {
        setError((j as { error?: string }).error ?? `Error ${r.status}`);
        return;
      }
      onSaved();
      reset();
      onClose();
    } catch (e) {
      setGuardando(false);
      setError(e instanceof Error ? e.message : "Error de red");
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Nueva cotización"
      description="Armá el presupuesto línea por línea. Podés vincular a un evento existente o dejarlo como cotización pendiente."
      maxWidthClass="max-w-5xl"
    >
      {/* Toggle modo */}
      <div className="mb-4 flex gap-1 rounded-lg bg-slate-100 p-1 text-xs">
        <button
          onClick={() => setModo("nuevo")}
          className={`flex-1 rounded-md px-3 py-1.5 font-medium transition-colors ${
            modo === "nuevo" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
          }`}
        >
          Cotización nueva (sin evento aún)
        </button>
        <button
          onClick={() => setModo("existente")}
          className={`flex-1 rounded-md px-3 py-1.5 font-medium transition-colors ${
            modo === "existente" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
          }`}
        >
          Para un evento existente
        </button>
      </div>

      {/* Cabecera */}
      <div className="mb-4 rounded-xl border border-slate-200 bg-slate-50/50 p-4">
        {modo === "existente" ? (
          <label className="flex flex-col gap-1">
            <span className={labelCls}>Evento *</span>
            <select
              value={eventoId}
              onChange={(e) => setEventoId(e.target.value)}
              className={inputCls}
            >
              <option value="">Seleccionar evento…</option>
              {eventos.map((ev) => (
                <option key={ev.id} value={ev.id}>
                  {ev.titulo}
                  {ev.fecha_evento ? ` — ${ev.fecha_evento}` : ""}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-6">
            {/* Bloque cliente: 2 modos. En "nuevo" no se toca la tabla clientes
                hasta que se apruebe la cotización — recién ahí se crea. */}
            <div className="md:col-span-6">
              <div className="mb-2 flex items-center gap-2">
                <span className={labelCls}>Cliente *</span>
                <div className="flex gap-1 rounded-lg bg-slate-100 p-0.5 text-[11px]">
                  <button
                    type="button"
                    onClick={() => setModoCliente("nuevo")}
                    className={`rounded-md px-2 py-0.5 font-medium transition-colors ${
                      modoCliente === "nuevo"
                        ? "bg-white text-slate-900 shadow-sm"
                        : "text-slate-500 hover:text-slate-700"
                    }`}
                  >
                    Nuevo (a mano)
                  </button>
                  <button
                    type="button"
                    onClick={() => setModoCliente("existente")}
                    className={`rounded-md px-2 py-0.5 font-medium transition-colors ${
                      modoCliente === "existente"
                        ? "bg-white text-slate-900 shadow-sm"
                        : "text-slate-500 hover:text-slate-700"
                    }`}
                  >
                    De la lista
                  </button>
                </div>
              </div>
              {modoCliente === "existente" ? (
                <select
                  value={clienteId}
                  onChange={(e) => setClienteId(e.target.value)}
                  className={inputCls}
                >
                  <option value="">Seleccionar cliente…</option>
                  {clientes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {nombreCliente(c)}
                    </option>
                  ))}
                </select>
              ) : (
                <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                  <input
                    type="text"
                    value={clienteNombreSnap}
                    onChange={(e) => setClienteNombreSnap(e.target.value)}
                    placeholder="Nombre / razón social *"
                    className={inputCls}
                  />
                  <input
                    type="tel"
                    value={clienteTelefonoSnap}
                    onChange={(e) => setClienteTelefonoSnap(e.target.value)}
                    placeholder="Teléfono"
                    className={inputCls}
                  />
                  <input
                    type="email"
                    value={clienteEmailSnap}
                    onChange={(e) => setClienteEmailSnap(e.target.value)}
                    placeholder="Email"
                    className={inputCls}
                  />
                  <p className="md:col-span-3 text-[11px] text-slate-500">
                    El cliente se crea automáticamente en la base recién al aprobar esta cotización.
                  </p>
                </div>
              )}
            </div>

            <label className="flex flex-col gap-1 md:col-span-6">
              <span className={labelCls}>Título del evento *</span>
              <input
                type="text"
                value={titulo}
                onChange={(e) => setTitulo(e.target.value)}
                placeholder="Ej. Boda Pérez–Gómez"
                className={inputCls}
              />
            </label>
            <label className="flex flex-col gap-1 md:col-span-2">
              <span className={labelCls}>Tipo</span>
              <select
                value={tipoEvento}
                onChange={(e) => setTipoEvento(e.target.value)}
                className={inputCls}
              >
                <option value="">—</option>
                {TIPOS_EVENTO.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 md:col-span-2">
              <span className={labelCls}>Fecha aprox.</span>
              <input
                type="date"
                value={fechaEvento}
                onChange={(e) => setFechaEvento(e.target.value)}
                className={inputCls}
              />
            </label>
            <label className="flex flex-col gap-1 md:col-span-2">
              <span className={labelCls}>Invitados</span>
              <input
                type="number"
                min={0}
                value={invitados}
                onChange={(e) => setInvitados(e.target.value)}
                placeholder="—"
                className={inputCls}
              />
            </label>
          </div>
        )}

        <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-4">
          <label className="flex flex-col gap-1">
            <span className={labelCls}>Validez (días)</span>
            <input
              type="number"
              min={1}
              value={validez}
              onChange={(e) => setValidez(e.target.value)}
              className={inputCls}
            />
          </label>
          <label className="flex flex-col gap-1 md:col-span-3">
            <span className={labelCls}>Observaciones</span>
            <input
              type="text"
              value={observaciones}
              onChange={(e) => setObservaciones(e.target.value)}
              placeholder="Opcional"
              className={inputCls}
            />
          </label>
        </div>
      </div>

      {/* Líneas */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-700">Líneas del presupuesto</h3>
          <div className="flex flex-wrap gap-1">
            <Button variant="secondary" size="sm" onClick={() => addLinea("servicio")}>
              + Servicio
            </Button>
            <Button variant="secondary" size="sm" onClick={() => addLinea("paquete")}>
              + Paquete
            </Button>
            <Button variant="secondary" size="sm" onClick={() => addLinea("texto")}>
              + Texto libre
            </Button>
          </div>
        </div>

        {lineas.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50/50 p-6 text-center text-xs text-slate-400">
            Agregá al menos una línea usando los botones de arriba.
          </div>
        ) : (
          <div className="space-y-2">
            {lineas.map((l, idx) => {
              const subtotal = l.cantidad * l.precio_unitario * (1 - l.descuento_pct / 100);
              return (
                <div
                  key={idx}
                  className="rounded-lg border border-slate-100 bg-white p-3 shadow-sm"
                >
                  <div className="grid grid-cols-1 gap-2 md:grid-cols-12">
                    <div className="md:col-span-2">
                      <span className={labelCls}>Tipo</span>
                      <select
                        value={l.tipo}
                        onChange={(e) =>
                          updateLinea(idx, { tipo: e.target.value as TipoItemPresupuesto })
                        }
                        className={inputSm}
                      >
                        <option value="servicio">Servicio</option>
                        <option value="paquete">Paquete</option>
                        <option value="producto">Producto</option>
                        <option value="texto">Texto</option>
                      </select>
                    </div>
                    {l.tipo === "servicio" || l.tipo === "paquete" ? (
                      <div className="md:col-span-3">
                        <span className={labelCls}>
                          Elegir del catálogo (opcional)
                        </span>
                        {(l.tipo === "servicio" ? servicios : paquetes).length === 0 ? (
                          <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-2 py-1.5 text-[11px] text-slate-500">
                            Sin {l.tipo === "servicio" ? "servicios" : "paquetes"} cargados.
                            Podés dejar la descripción a mano o cargarlos en{" "}
                            <span className="font-medium">Eventos → Catálogo</span>.
                          </div>
                        ) : (
                          <select
                            value={l.ref_id ?? ""}
                            onChange={(e) => updateLinea(idx, { ref_id: e.target.value || null })}
                            className={inputSm}
                          >
                            <option value="">— Elegir para autocompletar —</option>
                            {(l.tipo === "servicio" ? servicios : paquetes).map((x) => (
                              <option key={x.id} value={x.id}>
                                {x.nombre}
                              </option>
                            ))}
                          </select>
                        )}
                      </div>
                    ) : (
                      <div className="md:col-span-3">
                        <span className={labelCls}>Categoría</span>
                        <input
                          type="text"
                          value={l.categoria}
                          onChange={(e) => updateLinea(idx, { categoria: e.target.value })}
                          placeholder="Opcional"
                          className={inputSm}
                        />
                      </div>
                    )}
                    <div className="md:col-span-4">
                      <span className={labelCls}>Descripción</span>
                      <input
                        type="text"
                        value={l.descripcion}
                        onChange={(e) => updateLinea(idx, { descripcion: e.target.value })}
                        placeholder="Detalle de la línea"
                        className={inputSm}
                      />
                    </div>
                    <div className="md:col-span-1">
                      <span className={labelCls}>Cant.</span>
                      <input
                        type="number"
                        min={1}
                        step={1}
                        value={l.cantidad === 0 ? "" : l.cantidad}
                        onChange={(e) => updateLinea(idx, { cantidad: parseFloat(e.target.value) || 0 })}
                        className={inputSm + " text-right"}
                      />
                    </div>
                    <div className="md:col-span-2">
                      <span className={labelCls}>Precio (€)</span>
                      <input
                        type="number"
                        step="0.01"
                        min={0}
                        value={l.precio_unitario === 0 ? "" : l.precio_unitario}
                        placeholder="0,00"
                        onChange={(e) =>
                          updateLinea(idx, { precio_unitario: parseFloat(e.target.value) || 0 })
                        }
                        className={inputSm + " text-right"}
                      />
                    </div>
                  </div>
                  <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-12 md:items-end">
                    <label className="md:col-span-2 flex flex-col gap-1">
                      <span className={labelCls}>Unidad</span>
                      <input
                        type="text"
                        value={l.unidad}
                        onChange={(e) => updateLinea(idx, { unidad: e.target.value })}
                        className={inputSm}
                        placeholder="u / pax / hora…"
                      />
                    </label>
                    <label className="md:col-span-2 flex flex-col gap-1">
                      <span className={labelCls}>Descuento %</span>
                      <input
                        type="number"
                        min={0}
                        max={100}
                        step="0.5"
                        value={l.descuento_pct}
                        onChange={(e) =>
                          updateLinea(idx, {
                            descuento_pct: Math.min(100, Math.max(0, parseFloat(e.target.value) || 0)),
                          })
                        }
                        className={inputSm + " text-right"}
                      />
                    </label>
                    <label className="md:col-span-2 flex flex-col gap-1">
                      <span className={labelCls}>IVA</span>
                      <select
                        value={l.iva_pct}
                        onChange={(e) =>
                          updateLinea(idx, { iva_pct: Number(e.target.value) as IvaPresupuesto })
                        }
                        className={inputSm}
                      >
                        <option value={0}>Exento</option>
                        <option value={5}>5%</option>
                        <option value={10}>10%</option>
                      </select>
                    </label>
                    <div className="md:col-span-5 flex items-end justify-end gap-2">
                      <span className={labelCls}>Subtotal</span>
                      <span className="text-sm font-semibold text-slate-800">
                        {fmtEur(subtotal)}
                      </span>
                    </div>
                    <div className="md:col-span-1 flex items-end justify-end">
                      <button
                        onClick={() => removeLinea(idx)}
                        className="text-xs text-red-600 hover:underline"
                      >
                        Quitar
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Totales */}
        <div className="mt-4 flex justify-end">
          <div className="w-full max-w-xs space-y-1 rounded-lg bg-slate-50 p-3 text-sm">
            <div className="flex justify-between text-slate-600">
              <span>Base imponible</span>
              <span className="tabular-nums">{fmtEur(totales.base)}</span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>IVA</span>
              <span className="tabular-nums">{fmtEur(totales.iva)}</span>
            </div>
            <div className="flex justify-between border-t border-slate-200 pt-1 text-base font-bold text-slate-900">
              <span>Total</span>
              <span className="tabular-nums">{fmtEur(totales.total)}</span>
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          {error}
        </div>
      )}

      <div className="mt-5 flex justify-end gap-2 border-t border-slate-100 pt-4">
        <Button variant="secondary" onClick={onClose}>
          Cancelar
        </Button>
        <Button variant="primary" onClick={guardar} disabled={guardando}>
          {guardando ? "Guardando…" : "Guardar cotización"}
        </Button>
      </div>
    </Modal>
  );
}
