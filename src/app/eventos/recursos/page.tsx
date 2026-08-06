"use client";

import PageHeader from "@/components/ui/PageHeader";
import RecursosPanel from "../_components/RecursosPanel";

export default function RecursosPage() {
  return (
    <div className="min-h-screen bg-slate-50 px-4 py-8 lg:px-8">
      <div className="mx-auto max-w-5xl">
        <PageHeader
          eyebrow="NCG · Eventos"
          title="Recursos / Salones"
          description="Espacios propios reservables (salón, jardín, terraza…). Se validan contra doble reserva."
          backHref="/eventos/catalogo"
        />
        <div className="mt-6">
          <RecursosPanel />
        </div>
      </div>
    </div>
  );
}
