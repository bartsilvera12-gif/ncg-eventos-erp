"use client";

import { useState } from "react";
import PageHeader from "@/components/ui/PageHeader";
import ServiciosPanel from "../_components/ServiciosPanel";
import PaquetesPanel from "../_components/PaquetesPanel";
import RecursosPanel from "../_components/RecursosPanel";

type TabKey = "servicios" | "paquetes" | "recursos";

const TABS: { key: TabKey; label: string; hint: string }[] = [
  { key: "servicios", label: "Servicios", hint: "Catering, decoración, música, foto…" },
  { key: "paquetes",  label: "Paquetes",  hint: "Packs pre-armados de servicios" },
  { key: "recursos",  label: "Recursos",  hint: "Salones y espacios propios reservables" },
];

export default function CatalogoPage() {
  const [tab, setTab] = useState<TabKey>("servicios");
  const activeHint = TABS.find((t) => t.key === tab)?.hint ?? "";

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-8 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <PageHeader
          eyebrow="NCG · Eventos"
          title="Catálogo"
          description={activeHint}
          backHref="/eventos"
        />

        <div className="mt-6 border-b border-slate-200">
          <nav className="-mb-px flex gap-1 overflow-x-auto">
            {TABS.map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`whitespace-nowrap border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
                  tab === t.key
                    ? "border-[#0EA5E9] text-[#0EA5E9]"
                    : "border-transparent text-slate-500 hover:text-slate-700"
                }`}
              >
                {t.label}
              </button>
            ))}
          </nav>
        </div>

        <div className="mt-5">
          {tab === "servicios" && <ServiciosPanel />}
          {tab === "paquetes" && <PaquetesPanel />}
          {tab === "recursos" && <RecursosPanel />}
        </div>
      </div>
    </div>
  );
}
