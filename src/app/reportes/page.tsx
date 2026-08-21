"use client";

import PageHeader from "@/components/ui/PageHeader";
import { ReportCard } from "@/components/reportes/ReportCard";
import {
  Wallet, ShoppingCart, Package, Truck, ArrowLeftRight,
  TrendingUp, AlertTriangle, CalendarDays, AlertCircle,
} from "lucide-react";

/** Hub de reportería operativa: cards estilo Configuración Global. */
export default function ReportesPage() {
  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="NCG · Análisis"
        title="Reportes"
        description="Panel de análisis y reportería operativa"
      />

      <ul className="m-0 grid list-none gap-4 p-0 sm:grid-cols-2 xl:grid-cols-3">
        <li>
          <ReportCard
            title="Eventos del mes"
            subtitle="Agenda del período"
            icon={CalendarDays}
            description="Lista de eventos con fecha dentro del mes seleccionado, filtrable por estado."
            href="/reportes/eventos-mes"
          />
        </li>
        <li>
          <ReportCard
            title="Pendientes de pago"
            subtitle="Cobros pendientes por evento"
            icon={AlertCircle}
            description="Eventos con saldo pendiente contra el último presupuesto aprobado."
            href="/reportes/eventos-pendientes-pago"
          />
        </li>
        <li>
          <ReportCard
            title="Rentabilidad de eventos"
            subtitle="Cobrado vs costos por evento"
            icon={TrendingUp}
            description="Total cobrado, costos imputados y ganancia neta con margen %."
            href="/reportes/rentabilidad-eventos"
          />
        </li>
        <li>
          <ReportCard
            title="Stock bajo"
            subtitle="Materiales por reponer"
            icon={AlertTriangle}
            description="Productos por debajo del mínimo, ordenados por urgencia, con costo de reposición."
            href="/reportes/stock-bajo"
          />
        </li>
        <li>
          <ReportCard
            title="Estado de cuenta"
            subtitle="Saldos, movimientos y situación financiera"
            icon={Wallet}
            description="Resumen de cuentas, ventas, compras, pagos y saldos del período."
            href="/reportes/estado-cuenta"
          />
        </li>
        <li>
          <ReportCard
            title="Ventas"
            subtitle="Facturación y operaciones comerciales"
            icon={ShoppingCart}
            description="Ventas del mes, tipos de precio, productos vendidos y totales."
            href="/reportes/ventas"
          />
        </li>
        <li>
          <ReportCard
            title="Compras"
            subtitle="Adquisiciones y costos"
            icon={Package}
            description="Compras del mes, proveedores, productos adquiridos y montos."
            href="/reportes/compras"
          />
        </li>
        <li>
          <ReportCard
            title="Proveedores"
            subtitle="Abastecimiento y relación comercial"
            icon={Truck}
            description="Resumen de proveedores, compras por proveedor y actividad del mes."
            href="/reportes/proveedores"
          />
        </li>
        <li>
          <ReportCard
            title="Conciliación entre cuentas"
            subtitle="Transferencias y tarjetas"
            icon={ArrowLeftRight}
            description="Cobros por transferencia y tarjeta: banco, titular, monto y comprobante del período."
            href="/reportes/conciliacion"
          />
        </li>
      </ul>
    </div>
  );
}
