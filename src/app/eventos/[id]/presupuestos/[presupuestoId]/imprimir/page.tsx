"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { getEvento, getPresupuestos } from "@/lib/eventos/storage";
import { getCliente } from "@/lib/clientes/storage";
import type { Cliente } from "@/lib/clientes/types";
import type { Evento, EventoPresupuesto, EventoPresupuestoItem } from "@/lib/eventos/types";

interface EmpresaCabecera {
  razon_social: string;
  ruc: string;
  direccion_fiscal: string | null;
}

function fmtMoney(n?: number) {
  return `Gs. ${Math.round(n ?? 0).toLocaleString("es-PY")}`;
}
function fmtFecha(iso?: string | null) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("es-PY", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}
function nroPresupuesto(p: EventoPresupuesto) {
  const short = p.id.replace(/-/g, "").slice(0, 6).toUpperCase();
  return `PRE-${short}-v${p.version}`;
}

export default function PresupuestoImprimirPage() {
  const params = useParams<{ id: string; presupuestoId: string }>();
  const eventoId = params?.id;
  const presupuestoId = params?.presupuestoId;

  const [evento, setEvento] = useState<Evento | null>(null);
  const [presupuesto, setPresupuesto] = useState<EventoPresupuesto | null>(null);
  const [cliente, setCliente] = useState<Cliente | null>(null);
  const [empresa, setEmpresa] = useState<EmpresaCabecera | null>(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    if (!eventoId || !presupuestoId) return;
    (async () => {
      const [ev, ps, sifenRes] = await Promise.all([
        getEvento(eventoId),
        getPresupuestos(eventoId),
        fetch("/api/configuracion/sifen", { credentials: "include", cache: "no-store" })
          .then((r) => r.json())
          .catch(() => ({ success: false })),
      ]);
      setEvento(ev);
      const p = ps.find((x) => x.id === presupuestoId) ?? null;
      setPresupuesto(p);
      if (ev?.cliente_id) {
        setCliente(await getCliente(ev.cliente_id));
      }
      if (sifenRes?.success && sifenRes.data) {
        setEmpresa({
          razon_social: String(sifenRes.data.razon_social ?? ""),
          ruc: String(sifenRes.data.ruc ?? ""),
          direccion_fiscal: sifenRes.data.direccion_fiscal ?? null,
        });
      }
      setCargando(false);
    })();
  }, [eventoId, presupuestoId]);

  // Agrupar items por categoría preservando orden.
  const grupos = useMemo(() => {
    const map = new Map<string, EventoPresupuestoItem[]>();
    for (const it of presupuesto?.items ?? []) {
      const cat = it.categoria?.trim() || "";
      const arr = map.get(cat) ?? [];
      arr.push(it);
      map.set(cat, arr);
    }
    return [...map.entries()];
  }, [presupuesto]);

  // Desglose de IVA por tasa (para el pie estilo el modelo de la foto).
  const desgloseIva = useMemo(() => {
    const acc = new Map<number, { base: number; iva: number }>();
    for (const it of presupuesto?.items ?? []) {
      const cur = acc.get(it.iva_pct) ?? { base: 0, iva: 0 };
      cur.base += it.subtotal;
      cur.iva += it.subtotal * (it.iva_pct / 100);
      acc.set(it.iva_pct, cur);
    }
    return [...acc.entries()].sort((a, b) => a[0] - b[0]);
  }, [presupuesto]);

  if (cargando) {
    return <div className="p-8 text-center text-slate-400">Cargando…</div>;
  }
  if (!evento || !presupuesto) {
    return <div className="p-8 text-center text-slate-400">Presupuesto no encontrado.</div>;
  }

  const validoHasta = presupuesto.validez_dias
    ? (() => {
        const d = new Date(presupuesto.fecha);
        d.setDate(d.getDate() + presupuesto.validez_dias);
        return fmtFecha(d.toISOString());
      })()
    : null;

  const clienteRazon =
    cliente?.tipo_cliente === "empresa" && cliente.empresa
      ? cliente.empresa
      : cliente?.nombre_contacto ?? evento.cliente_nombre ?? "—";

  return (
    <>
      <style>{`
        @page { size: A4; margin: 15mm; }
        @media print {
          .no-print { display: none !important; }
          body { background: #fff !important; }
        }
        .doc {
          font-family: Arial, Helvetica, sans-serif;
          color: #1e293b;
          font-size: 12px;
          line-height: 1.4;
        }
        .doc h1, .doc h2, .doc h3 { margin: 0; padding: 0; }
        .doc table { border-collapse: collapse; width: 100%; }
        .doc .box { border: 1px solid #94a3b8; }
        .doc th, .doc td { padding: 6px 8px; }
        .doc .th { background: #e2e8f0; font-weight: 600; text-align: left; text-transform: uppercase; font-size: 11px; letter-spacing: .03em; }
        .doc .row-cat td { background: #f1f5f9; font-weight: 700; text-transform: uppercase; font-size: 11px; color: #334155; }
        .doc .right { text-align: right; }
        .doc .center { text-align: center; }
        .doc .muted { color: #64748b; }
      `}</style>
      <div className="min-h-screen bg-slate-100 p-6 print:bg-white print:p-0">
        <div className="no-print mx-auto mb-4 flex max-w-[210mm] justify-end gap-2">
          <button
            onClick={() => window.history.back()}
            className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
          >
            Volver
          </button>
          <button
            onClick={() => window.print()}
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
          >
            Imprimir / PDF
          </button>
        </div>

        <div className="doc mx-auto max-w-[210mm] bg-white p-8 shadow print:shadow-none">
          {/* Cabecera: emisor + receptor */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
            <div>
              <h2 style={{ fontSize: 14, fontWeight: 700 }}>
                {empresa?.razon_social || "Configurar razón social en SIFEN"}
              </h2>
              {empresa?.direccion_fiscal && (
                <div>{empresa.direccion_fiscal}</div>
              )}
              {empresa?.ruc && <div>R.U.C. {empresa.ruc}</div>}
            </div>
            <div>
              <h2 style={{ fontSize: 14, fontWeight: 700 }}>{clienteRazon}</h2>
              {cliente?.direccion && <div>{cliente.direccion}</div>}
              {cliente?.ciudad && <div>{cliente.ciudad}</div>}
              {cliente?.ruc && <div>R.U.C. {cliente.ruc}</div>}
              {cliente?.documento && !cliente.ruc && <div>C.I. {cliente.documento}</div>}
              {cliente?.telefono && <div>Tel. {cliente.telefono}</div>}
              {cliente?.email && <div>{cliente.email}</div>}
            </div>
          </div>

          {/* Metadatos */}
          <div
            style={{
              marginTop: 20,
              display: "grid",
              gridTemplateColumns: "2fr 1fr 1fr",
              gap: 12,
              paddingBottom: 8,
              borderBottom: "1px solid #cbd5e1",
            }}
          >
            <div>
              <strong>Presupuesto:</strong> {nroPresupuesto(presupuesto)}
            </div>
            <div>
              <strong>Fecha:</strong> {fmtFecha(presupuesto.fecha)}
            </div>
            <div className="right">
              <strong>Hoja nº:</strong> 1 de 1
            </div>
          </div>

          {/* Cuerpo del evento */}
          <div
            style={{
              marginTop: 12,
              padding: "8px 10px",
              background: "#f8fafc",
              border: "1px solid #e2e8f0",
              borderRadius: 4,
              fontSize: 12,
            }}
          >
            <strong>{evento.titulo}</strong>
            <span className="muted">
              {" "}· {evento.tipo_evento ?? "Evento"}
              {evento.fecha_evento ? ` · ${fmtFecha(evento.fecha_evento)}` : ""}
              {evento.hora_inicio ? ` · ${evento.hora_inicio}${evento.hora_fin ? `–${evento.hora_fin}` : ""}` : ""}
            </span>
            {evento.lugar_evento && (
              <div className="muted">Lugar: {evento.lugar_evento}</div>
            )}
            {typeof evento.cantidad_invitados === "number" && (
              <div className="muted">Invitados: {evento.cantidad_invitados}</div>
            )}
          </div>

          {/* Tabla de líneas */}
          <table className="box" style={{ marginTop: 12 }}>
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
                  {cat && (
                    <tr className="row-cat">
                      <td colSpan={7}>{cat}</td>
                    </tr>
                  )}
                  {items.map((it) => (
                    <tr key={it.id} style={{ borderTop: "1px solid #e2e8f0" }}>
                      <td>{it.descripcion}</td>
                      <td className="right">{Number(it.cantidad).toLocaleString("es-PY")}</td>
                      <td>{it.unidad}</td>
                      <td className="right">{fmtMoney(it.precio_unitario)}</td>
                      <td className="right">{it.descuento_pct ? `${it.descuento_pct}%` : "—"}</td>
                      <td className="right">{it.iva_pct === 0 ? "Ex." : `${it.iva_pct}%`}</td>
                      <td className="right"><strong>{fmtMoney(it.subtotal)}</strong></td>
                    </tr>
                  ))}
                </Fragment>
              ))}
            </tbody>
          </table>

          {/* Totales (estilo el modelo: BASE / IVA / TOTAL) */}
          <table className="box" style={{ marginTop: 12 }}>
            <thead>
              <tr>
                <th className="th center">Base imponible</th>
                {desgloseIva.map(([tasa]) => (
                  <th className="th center" key={`h-${tasa}`}>
                    I.V.A. {tasa === 0 ? "Exenta" : `${tasa}%`}
                  </th>
                ))}
                <th className="th center">Total</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="center">{fmtMoney(presupuesto.base_imponible)}</td>
                {desgloseIva.map(([tasa, v]) => (
                  <td className="center" key={`v-${tasa}`}>
                    {fmtMoney(v.iva)}
                  </td>
                ))}
                <td className="center" style={{ fontSize: 14, fontWeight: 700 }}>
                  {fmtMoney(presupuesto.total)}
                </td>
              </tr>
            </tbody>
          </table>

          {/* Pie: condiciones + validez + observaciones */}
          <div style={{ marginTop: 16, fontSize: 11, color: "#334155" }}>
            {presupuesto.condiciones_pago && (
              <p>
                <strong>Condiciones de pago:</strong> {presupuesto.condiciones_pago}
              </p>
            )}
            {validoHasta && (
              <p>
                <strong>Validez del presupuesto:</strong> hasta {validoHasta} ({presupuesto.validez_dias} días).
              </p>
            )}
            {presupuesto.observaciones && (
              <p style={{ whiteSpace: "pre-wrap" }}>
                <strong>Observaciones:</strong> {presupuesto.observaciones}
              </p>
            )}
          </div>

          <div
            style={{
              marginTop: 40,
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 40,
              fontSize: 11,
              textAlign: "center",
            }}
          >
            <div>
              <div style={{ borderTop: "1px solid #94a3b8", paddingTop: 4 }}>
                Firma cliente
              </div>
            </div>
            <div>
              <div style={{ borderTop: "1px solid #94a3b8", paddingTop: 4 }}>
                Por {empresa?.razon_social ?? "la empresa"}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
