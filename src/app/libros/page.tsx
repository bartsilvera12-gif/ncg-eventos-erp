"use client";

import PageHeader from "@/components/ui/PageHeader";
import { ReportCard } from "@/components/reportes/ReportCard";
import { BookOpen, BookMarked, ShoppingCart, ReceiptText, Landmark } from "lucide-react";

/** Hub de libros contables: cards al estilo /reportes. */
export default function LibrosPage() {
  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="NCG · Contabilidad"
        title="Libros"
        description="Libros contables y auxiliares del período"
      />

      <ul className="m-0 grid list-none gap-4 p-0 sm:grid-cols-2 xl:grid-cols-3">
        <li>
          <ReportCard
            title="Libro diario"
            subtitle="Asientos contables del período"
            icon={BookOpen}
            description="Movimientos por asiento (débito y crédito) ordenados por fecha, con totales."
            href="/reportes/libro-diario"
          />
        </li>
        <li>
          <ReportCard
            title="Libro mayor"
            subtitle="Movimientos por cuenta"
            icon={BookMarked}
            description="Saldo inicial, movimientos y saldo final por cuenta contable."
            href="/reportes/libro-mayor"
          />
        </li>
        <li>
          <ReportCard
            title="Libro de compras"
            subtitle="Facturas de proveedores"
            icon={ShoppingCart}
            description="Detalle de compras del período con IVA soportado."
            href="/finanzas/libro-compras"
          />
        </li>
        <li>
          <ReportCard
            title="Libro de ventas"
            subtitle="Facturas emitidas"
            icon={ReceiptText}
            description="Detalle de ventas del período con IVA repercutido."
            href="/finanzas/libro-ventas"
          />
        </li>
        <li>
          <ReportCard
            title="IVA mensual"
            subtitle="Liquidación mensual"
            icon={Landmark}
            description="IVA soportado vs repercutido y saldo a favor/pagar del mes."
            href="/finanzas/iva-mensual"
          />
        </li>
      </ul>
    </div>
  );
}
