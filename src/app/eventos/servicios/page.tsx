"use client";

import PageHeader from "@/components/ui/PageHeader";
import ServiciosPanel from "../_components/ServiciosPanel";

export default function ServiciosPage() {
  return (
    <div className="min-h-screen bg-slate-50 px-4 py-8 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <PageHeader
          eyebrow="NCG · Eventos"
          title="Catálogo de servicios"
          description="Servicios ofrecidos (catering, decoración, música, foto…). Reutilizados en paquetes y presupuestos."
          backHref="/eventos/catalogo"
        />
        <div className="mt-6">
          <ServiciosPanel />
        </div>
      </div>
    </div>
  );
}
