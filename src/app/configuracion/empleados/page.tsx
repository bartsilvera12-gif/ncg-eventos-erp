"use client";

import { useState } from "react";
import PageHeader from "@/components/ui/PageHeader";
import CatalogoEditor from "@/components/config/CatalogoEditor";

type Tab = "tipos" | "departamentos" | "sucursales";

const TABS: { id: Tab; label: string; descripcion: string }[] = [
  { id: "tipos", label: "Tipos de empleado", descripcion: "Roles operativos (Obrero, Capataz, Soldador, Chofer…)." },
  { id: "departamentos", label: "Departamentos", descripcion: "Áreas funcionales (Operaciones, Administración, Comercial…)." },
  { id: "sucursales", label: "Sucursales", descripcion: "Sedes donde trabajan los empleados (Central, otra sede…)." },
];

export default function ConfiguracionEmpleadosPage() {
  const [tab, setTab] = useState<Tab>("tipos");
  const meta = TABS.find((t) => t.id === tab)!;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="NCG · Configuración"
        title="Empleados"
        description="Catálogos editables que alimentan los selectores de la ficha del empleado."
        backHref="/configuracion"
        backLabel="Configuración"
      />

      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 pb-1">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`relative -mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
              tab === t.id
                ? "border-[#4FAEB2] text-[#3F8E91]"
                : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <p className="-mt-3 text-xs text-slate-500">{meta.descripcion}</p>

      {tab === "tipos" && (
        <CatalogoEditor
          endpointBase="/api/rrhh/tipos-empleado-catalogo"
          singular="tipo"
          placeholderCrear="Encofrador"
        />
      )}
      {tab === "departamentos" && (
        <CatalogoEditor
          endpointBase="/api/rrhh/departamentos-catalogo"
          singular="departamento"
          placeholderCrear="Logística"
        />
      )}
      {tab === "sucursales" && (
        <CatalogoEditor
          endpointBase="/api/rrhh/sucursales-catalogo"
          singular="sucursal"
          placeholderCrear="Madrid Centro"
        />
      )}
    </div>
  );
}
