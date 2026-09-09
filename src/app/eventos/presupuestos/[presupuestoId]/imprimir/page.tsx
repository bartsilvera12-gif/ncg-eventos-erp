"use client";

/**
 * Impresion standalone de una cotizacion: sirve tanto para presupuestos vinculados
 * a un evento como para cotizaciones aun sin evento (proyecto_id = null). Usa
 * GET /api/eventos/presupuestos/[id] que devuelve el presupuesto + items +
 * cliente (por FK o snapshot) + evento (si existe).
 */

import { Fragment, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { getProductos } from "@/lib/inventario/storage";

interface Item {
  id: string;
  tipo: string;
  ref_id: string | null;
  descripcion: string;
  cantidad: number | string;
  precio_unitario: number | string;
  unidad: string;
  categoria: string | null;
  descuento_pct: number | string;
  iva_pct: number;
  subtotal: number | string;
}

interface Presupuesto {
  id: string;
  version: number;
  estado: string;
  fecha: string;
  validez_dias: number | null;
  observaciones: string | null;
  condiciones_pago: string | null;
  base_imponible: number | string;
  monto_iva: number | string;
  total: number | string;
  titulo_evento: string | null;
  tipo_evento: string | null;
  fecha_evento_aprox: string | null;
  cantidad_invitados: number | null;
  cliente_nombre_snapshot: string | null;
  cliente_telefono_snapshot: string | null;
  cliente_email_snapshot: string | null;
  foto_urls: string[] | null;
  items: Item[];
  clientes: {
    empresa?: string | null;
    nombre_contacto?: string | null;
    ruc?: string | null;
    direccion?: string | null;
    ciudad?: string | null;
    telefono?: string | null;
    email?: string | null;
    documento?: string | null;
  } | null;
  proyectos: {
    titulo?: string | null;
    tipo_evento?: string | null;
    fecha_evento?: string | null;
    hora_inicio?: string | null;
    hora_fin?: string | null;
    lugar_evento?: string | null;
    cantidad_invitados?: number | null;
  } | null;
}

function fmtMoney(n: number | string | null | undefined) {
  const v = typeof n === "string" ? Number(n) || 0 : n ?? 0;
  return `€ ${v.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function fmtFecha(iso?: string | null) {
  if (!iso) return "—";
  try { return new Date(iso).toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit", year: "numeric" }); }
  catch { return iso; }
}
function nroPresupuesto(p: Presupuesto) {
  const short = p.id.replace(/-/g, "").slice(0, 6).toUpperCase();
  return `PRE-${short}-v${p.version}`;
}

export default function PresupuestoImprimirStandalonePage() {
  const params = useParams<{ presupuestoId: string }>();
  const presupuestoId = params?.presupuestoId;

  const [presupuesto, setPresupuesto] = useState<Presupuesto | null>(null);
  const [productoImgs, setProductoImgs] = useState<Map<string, string>>(new Map());
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!presupuestoId) return;
    (async () => {
      try {
        const r = await fetch(`/api/eventos/presupuestos/${presupuestoId}`, { credentials: "include", cache: "no-store" });
        const j = (await r.json().catch(() => ({}))) as { success?: boolean; data?: { presupuesto?: Presupuesto }; error?: string };
        if (!r.ok || !j.success || !j.data?.presupuesto) {
          setError(j.error ?? "No se pudo cargar el presupuesto.");
          setCargando(false);
          return;
        }
        const p = j.data.presupuesto;
        setPresupuesto(p);
        const productoIds = new Set<string>();
        for (const it of p.items ?? []) {
          if (it.tipo === "producto" && it.ref_id) productoIds.add(it.ref_id);
        }
        if (productoIds.size > 0) {
          try {
            const prods = await getProductos();
            const m = new Map<string, string>();
            for (const pr of prods) {
              if (productoIds.has(pr.id) && pr.imagen_url) m.set(pr.id, pr.imagen_url);
            }
            setProductoImgs(m);
          } catch { /* silent */ }
        }
        setCargando(false);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Error");
        setCargando(false);
      }
    })();
  }, [presupuestoId]);

  const grupos = useMemo(() => {
    const map = new Map<string, Item[]>();
    for (const it of presupuesto?.items ?? []) {
      const cat = (it.categoria ?? "").trim();
      const arr = map.get(cat) ?? [];
      arr.push(it);
      map.set(cat, arr);
    }
    return [...map.entries()];
  }, [presupuesto]);

  const desgloseIva = useMemo(() => {
    const acc = new Map<number, { base: number; iva: number }>();
    for (const it of presupuesto?.items ?? []) {
      const cur = acc.get(it.iva_pct) ?? { base: 0, iva: 0 };
      const sub = Number(it.subtotal) || 0;
      cur.base += sub;
      cur.iva += sub * (it.iva_pct / 100);
      acc.set(it.iva_pct, cur);
    }
    return [...acc.entries()].sort((a, b) => a[0] - b[0]);
  }, [presupuesto]);

  if (cargando) return <div className="p-8 text-center text-slate-400">Cargando…</div>;
  if (error || !presupuesto) return <div className="p-8 text-center text-red-500">{error ?? "Presupuesto no encontrado."}</div>;

  const clienteRazon =
    presupuesto.clientes?.empresa || presupuesto.clientes?.nombre_contacto ||
    presupuesto.cliente_nombre_snapshot || "—";
  const clienteTelefono = presupuesto.clientes?.telefono ?? presupuesto.cliente_telefono_snapshot;
  const clienteEmail = presupuesto.clientes?.email ?? presupuesto.cliente_email_snapshot;
  const evento = presupuesto.proyectos;
  const eventoTitulo = evento?.titulo ?? presupuesto.titulo_evento ?? "Evento";
  const eventoTipo = evento?.tipo_evento ?? presupuesto.tipo_evento;
  const eventoFecha = evento?.fecha_evento ?? presupuesto.fecha_evento_aprox;
  const eventoInvitados = evento?.cantidad_invitados ?? presupuesto.cantidad_invitados;

  const validoHasta = presupuesto.validez_dias
    ? (() => { const d = new Date(presupuesto.fecha); d.setDate(d.getDate() + presupuesto.validez_dias!); return fmtFecha(d.toISOString()); })()
    : null;

  return (
    <>
      <style>{`
        @page { size: A4; margin: 15mm; }
        @media print {
          .no-print { display: none !important; }
          body { background: #fff !important; }
          .doc .brand-bar, .doc .th, .doc .row-cat td, .doc .total-cell {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
        }
        .doc { font-family: Arial, Helvetica, sans-serif; color: #1e293b; font-size: 12px; line-height: 1.4; }
        .doc h1, .doc h2, .doc h3 { margin: 0; padding: 0; }
        .doc table { border-collapse: collapse; width: 100%; }
        .doc .box { border: 1px solid #4FAEB2; border-radius: 4px; overflow: hidden; }
        .doc th, .doc td { padding: 7px 9px; }
        .doc .th { background: linear-gradient(90deg, #4FAEB2 0%, #3F8E91 100%); color: #ffffff; font-weight: 700; text-align: left; text-transform: uppercase; font-size: 11px; letter-spacing: .05em; }
        .doc .row-cat td { background: #E5F4F4; font-weight: 700; text-transform: uppercase; font-size: 11px; color: #2F6F72; border-left: 4px solid #4FAEB2; }
        .doc .right { text-align: right; }
        .doc .center { text-align: center; }
        .doc .muted { color: #64748b; }
        .doc .brand-bar { height: 6px; background: linear-gradient(90deg, #4FAEB2 0%, #3F8E91 60%, #2F6F72 100%); border-radius: 3px; margin-bottom: 12px; }
        .doc .brand-title { color: #2F6F72; letter-spacing: .04em; }
        .doc .chip { background: #E5F4F4; color: #2F6F72; padding: 2px 8px; border-radius: 999px; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: .06em; }
        .doc .total-cell { background: linear-gradient(135deg, #E5F4F4 0%, #ffffff 100%); color: #2F6F72; }
        .doc .zebra tbody tr:nth-child(even) td { background: #FBFCFC; }
        .doc .foto-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-top: 16px; }
        .doc .foto-grid img { width: 100%; height: 180px; object-fit: contain; background: #f8fafc; border-radius: 6px; border: 1px solid #cbd5e1; padding: 4px; }
      `}</style>
      <div className="min-h-screen bg-slate-100 p-6 print:bg-white print:p-0">
        <div className="no-print mx-auto mb-4 flex max-w-[210mm] justify-end gap-2">
          <button onClick={() => window.history.back()} className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700 hover:bg-slate-50">Volver</button>
          <button onClick={() => window.print()} className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700">Imprimir / PDF</button>
        </div>

        <div className="doc mx-auto max-w-[210mm] bg-white p-8 shadow print:shadow-none">
          <div className="brand-bar" />
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
            <div>
              <h1 className="brand-title" style={{ fontSize: 22, fontWeight: 800 }}>PRESUPUESTO</h1>
              <div className="muted" style={{ fontSize: 11 }}>{nroPresupuesto(presupuesto)}</div>
            </div>
            <span className="chip">{presupuesto.estado.toUpperCase()}</span>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
            <div>
              <h2 style={{ fontSize: 14, fontWeight: 700, color: "#2F6F72" }}>NCG Eventos</h2>
            </div>
            <div>
              <h2 style={{ fontSize: 14, fontWeight: 700, color: "#2F6F72" }}>{clienteRazon}</h2>
              {presupuesto.clientes?.direccion && <div>{presupuesto.clientes.direccion}</div>}
              {presupuesto.clientes?.ciudad && <div>{presupuesto.clientes.ciudad}</div>}
              {presupuesto.clientes?.ruc && <div>N.I.F. {presupuesto.clientes.ruc}</div>}
              {presupuesto.clientes?.documento && !presupuesto.clientes.ruc && <div>DNI/NIE {presupuesto.clientes.documento}</div>}
              {clienteTelefono && <div>Tel. {clienteTelefono}</div>}
              {clienteEmail && <div>{clienteEmail}</div>}
            </div>
          </div>

          <div style={{ marginTop: 20, display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: 12, paddingBottom: 8, borderBottom: "1px solid #cbd5e1" }}>
            <div><strong>Presupuesto:</strong> {nroPresupuesto(presupuesto)}</div>
            <div><strong>Fecha:</strong> {fmtFecha(presupuesto.fecha)}</div>
            <div className="right"><strong>Hoja nº:</strong> 1 de 1</div>
          </div>

          <div style={{ marginTop: 12, padding: "8px 10px", background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 4, fontSize: 12 }}>
            <strong>{eventoTitulo}</strong>
            <span className="muted">
              {" "}· {eventoTipo ?? "Evento"}
              {eventoFecha ? ` · ${fmtFecha(eventoFecha)}` : ""}
              {evento?.hora_inicio ? ` · ${evento.hora_inicio}${evento.hora_fin ? `–${evento.hora_fin}` : ""}` : ""}
            </span>
            {evento?.lugar_evento && <div className="muted">Lugar: {evento.lugar_evento}</div>}
            {typeof eventoInvitados === "number" && <div className="muted">Invitados: {eventoInvitados}</div>}
          </div>

          <table className="box zebra" style={{ marginTop: 12 }}>
            <thead>
              <tr>
                <th className="th">Descripción</th>
                <th className="th right" style={{ width: 70 }}>Cant.</th>
                <th className="th" style={{ width: 60 }}>Unidad</th>
                <th className="th right" style={{ width: 100 }}>Precio</th>
                <th className="th right" style={{ width: 60 }}>Desc.</th>
                <th className="th right" style={{ width: 60 }}>IVA</th>
                <th className="th right" style={{ width: 110 }}>Total</th>
              </tr>
            </thead>
            <tbody>
              {grupos.map(([cat, items]) => (
                <Fragment key={`grp-${cat || "sin"}`}>
                  {cat && (<tr className="row-cat"><td colSpan={7}>{cat}</td></tr>)}
                  {items.map((it) => {
                    const img = it.ref_id ? productoImgs.get(it.ref_id) : undefined;
                    return (
                      <tr key={it.id} style={{ borderTop: "1px solid #e2e8f0" }}>
                        <td>
                          {img ? (
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={img} alt={it.descripcion} style={{ width: 44, height: 44, objectFit: "cover", borderRadius: 4, border: "1px solid #cbd5e1", flexShrink: 0 }} />
                              <span>{it.descripcion}</span>
                            </div>
                          ) : (it.descripcion)}
                        </td>
                        <td className="right">{Number(it.cantidad).toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        <td>{it.unidad}</td>
                        <td className="right">{fmtMoney(it.precio_unitario)}</td>
                        <td className="right">{Number(it.descuento_pct) ? `${it.descuento_pct}%` : "—"}</td>
                        <td className="right">{it.iva_pct === 0 ? "Ex." : `${it.iva_pct}%`}</td>
                        <td className="right"><strong>{fmtMoney(it.subtotal)}</strong></td>
                      </tr>
                    );
                  })}
                </Fragment>
              ))}
            </tbody>
          </table>

          <table className="box" style={{ marginTop: 12 }}>
            <thead>
              <tr>
                <th className="th center">Base imponible</th>
                {desgloseIva.map(([tasa]) => (<th className="th center" key={`h-${tasa}`}>I.V.A. {tasa === 0 ? "Exenta" : `${tasa}%`}</th>))}
                <th className="th center">Total</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="center">{fmtMoney(presupuesto.base_imponible)}</td>
                {desgloseIva.map(([tasa, v]) => (<td className="center" key={`v-${tasa}`}>{fmtMoney(v.iva)}</td>))}
                <td className="center total-cell" style={{ fontSize: 16, fontWeight: 800 }}>{fmtMoney(presupuesto.total)}</td>
              </tr>
            </tbody>
          </table>

          {presupuesto.foto_urls && presupuesto.foto_urls.length > 0 && (
            <div style={{ marginTop: 20 }}>
              <div className="th" style={{ padding: "6px 9px", borderRadius: 4, display: "inline-block" }}>Fotos de referencia</div>
              <div className="foto-grid">
                {presupuesto.foto_urls.map((url, i) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img key={i} src={url} alt={`Foto ${i + 1}`} />
                ))}
              </div>
            </div>
          )}

          <div style={{ marginTop: 16, fontSize: 11, color: "#334155" }}>
            {presupuesto.condiciones_pago && (<p><strong>Condiciones de pago:</strong> {presupuesto.condiciones_pago}</p>)}
            {validoHasta && (<p><strong>Validez del presupuesto:</strong> hasta {validoHasta} ({presupuesto.validez_dias} días).</p>)}
            {presupuesto.observaciones && (<p style={{ whiteSpace: "pre-wrap" }}><strong>Observaciones:</strong> {presupuesto.observaciones}</p>)}
          </div>

          <div style={{ marginTop: 40, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 40, fontSize: 11, textAlign: "center" }}>
            <div><div style={{ borderTop: "1px solid #94a3b8", paddingTop: 4 }}>Firma cliente</div></div>
            <div><div style={{ borderTop: "1px solid #94a3b8", paddingTop: 4 }}>Por NCG Eventos</div></div>
          </div>
        </div>
      </div>
    </>
  );
}
