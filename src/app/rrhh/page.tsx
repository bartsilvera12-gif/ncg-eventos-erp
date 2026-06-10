import PageHeader from "@/components/ui/PageHeader";

export const dynamic = "force-dynamic";

const SECCIONES = [
  { titulo: "Empleados", descripcion: "Alta, datos personales, contratos y salarios base." },
  { titulo: "Control Horario", descripcion: "Fichajes de entrada y salida, horas trabajadas por jornada." },
  { titulo: "Vacaciones", descripcion: "Solicitudes, aprobaciones y saldo de días por empleado." },
  { titulo: "Nómina", descripcion: "Liquidación mensual con conceptos, descuentos e IPS." },
  { titulo: "Asignación a Obras", descripcion: "Personal asignado a cada obra con horas y costo imputado." },
  { titulo: "Costo de Mano de Obra", descripcion: "Reporte de costo de personal consolidado por obra." },
];

export default function RrhhPage() {
  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="NCG · Personal"
        title="Recursos Humanos"
        description="Gestión integral de empleados, jornadas, nómina y asignación a obras."
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
        Módulo en preparación. La implementación incluye tablas de empleados, fichajes, nómina y vínculo con obras
        para calcular costo de mano de obra real por proyecto.
      </p>
    </div>
  );
}
