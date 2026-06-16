import Link from "next/link";
import PageHeader from "@/components/ui/PageHeader";

export const dynamic = "force-dynamic";

type Seccion = { titulo: string; descripcion: string; href?: string };

const SECCIONES: Seccion[] = [
  { titulo: "Libro de Ventas",  descripcion: "Detalle de ventas reales del mes con subtotal, IVA y total.", href: "/finanzas/libro-ventas" },
  { titulo: "Libro de Compras", descripcion: "Compras y gastos del mes con totales unificados.", href: "/finanzas/libro-compras" },
  { titulo: "IVA del período",  descripcion: "IVA repercutido (ventas), IVA soportado (compras) y resultado por mes.", href: "/finanzas/iva-mensual" },
  { titulo: "Cuentas por Cobrar", descripcion: "Ventas con saldo pendiente de cobro.", href: "/finanzas/cuentas-por-cobrar" },
  { titulo: "Cuentas por Pagar",  descripcion: "Compras y gastos con saldo pendiente de pago.", href: "/finanzas/cuentas-por-pagar" },
  { titulo: "Tesorería",          descripcion: "Movimientos de dinero por fecha (cobros y pagos).", href: "/finanzas/tesoreria" },
];

export default function FinanzasPage() {
  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="NCG · Contabilidad"
        title="Finanzas y Contabilidad"
        description="Vistas y reportes generados automáticamente desde ventas, compras y gastos cargados."
      />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {SECCIONES.map((s) => {
          const card = (
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-[#4FAEB2]/40 hover:shadow">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-semibold text-slate-900">{s.titulo}</h3>
                {s.href ? (
                  <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-700">
                    Disponible
                  </span>
                ) : (
                  <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700">
                    Próximamente
                  </span>
                )}
              </div>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">{s.descripcion}</p>
            </div>
          );
          return s.href ? (
            <Link key={s.titulo} href={s.href} className="block">{card}</Link>
          ) : (
            <div key={s.titulo}>{card}</div>
          );
        })}
      </div>
      <p className="text-xs text-slate-500">
        Sin doble carga: los libros y reportes leen de las ventas, compras y gastos ya cargados en sus módulos.
      </p>
    </div>
  );
}
