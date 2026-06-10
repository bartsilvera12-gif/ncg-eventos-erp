import PageHeader from "@/components/ui/PageHeader";

export const dynamic = "force-dynamic";

const SECCIONES = [
  { titulo: "Libro de Ventas", descripcion: "Detalle de facturas emitidas en el período con totales y IVA." },
  { titulo: "Libro de Compras", descripcion: "Facturas recibidas y gastos del período." },
  { titulo: "Tesorería", descripcion: "Cobros y pagos por fecha, flujo de caja." },
  { titulo: "Cuentas por Cobrar", descripcion: "Facturas con saldo pendiente." },
  { titulo: "Cuentas por Pagar", descripcion: "Compras y gastos con saldo pendiente." },
  { titulo: "Reporte IVA Mensual", descripcion: "IVA débito, IVA crédito e IVA a pagar por mes." },
];

export default function FinanzasPage() {
  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="NCG · Contabilidad"
        title="Finanzas y Contabilidad"
        description="Centro de operaciones contables: libros, tesorería, cuentas y reportes fiscales."
      />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {SECCIONES.map((s) => (
          <div
            key={s.titulo}
            className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-slate-900">{s.titulo}</h3>
              <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700">
                Próximamente
              </span>
            </div>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">{s.descripcion}</p>
          </div>
        ))}
      </div>
      <p className="text-xs text-slate-500">
        Estas vistas se generarán automáticamente desde ventas, compras, gastos y pagos ya cargados en el sistema.
        No hay que volver a cargar datos.
      </p>
    </div>
  );
}
