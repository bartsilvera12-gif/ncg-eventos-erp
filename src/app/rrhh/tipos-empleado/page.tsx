import Link from "next/link";
import PageHeader from "@/components/ui/PageHeader";

export const dynamic = "force-dynamic";

/**
 * Página obsoleta. La asignación de tipo(s) de empleado y los datos de chofer
 * ahora viven en la ficha del empleado (sección "Tipo(s) de empleado").
 * Se mantiene este stub para no romper enlaces directos.
 */
export default function TiposEmpleadoMovedPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="NCG · RRHH"
        title="Asignación de tipo de empleado"
        description="Esta sección se movió a la ficha del empleado."
        backHref="/rrhh"
        backLabel="RRHH"
      />
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-sm text-slate-700">
          Los tipos de empleado (Obrero, Capataz, Soldador…), la sucursal y los datos de
          chofer ahora se editan directamente desde la ficha de cada empleado, en la
          sección <strong>Tipo(s) de empleado</strong>.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <Link
            href="/rrhh/empleados"
            className="inline-flex items-center rounded-lg bg-[#4FAEB2] px-3 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-[#3F8E91]"
          >
            Ir a Empleados
          </Link>
          <Link
            href="/configuracion/tipos-empleado"
            className="inline-flex items-center rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Editar catálogo de tipos
          </Link>
        </div>
        <p className="mt-4 text-xs text-slate-500">
          El catálogo editable (Obrero, Capataz, Jornalero, Soldador, Montador…) sigue en
          Configuración. El multi-select de la ficha lo consume directamente.
        </p>
      </div>
    </div>
  );
}
