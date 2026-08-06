"use client";

import PageHeader from "@/components/ui/PageHeader";
import PaquetesPanel from "../_components/PaquetesPanel";

export default function PaquetesPage() {
  return (
    <div className="min-h-screen bg-slate-50 px-4 py-8 lg:px-8">
      <div className="mx-auto max-w-5xl">
        <PageHeader
          eyebrow="NCG · Eventos"
          title="Paquetes de eventos"
          description="Packs pre-armados de servicios (ej: 'Boda completa' = catering + decoración + música)."
          backHref="/eventos/catalogo"
        />
        <div className="mt-6">
          <PaquetesPanel />
        </div>
      </div>
    </div>
  );
}
