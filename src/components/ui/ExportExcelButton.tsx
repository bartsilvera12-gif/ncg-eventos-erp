"use client";

import { useState } from "react";

interface Props {
  url: string;
  label?: string;
  className?: string;
}

/**
 * Boton "Exportar Excel": dispara fetch al endpoint indicado, recibe blob xlsx
 * y lo descarga. Estilo verde-excel con gradiente e icono de hoja de calculo.
 */
export default function ExportExcelButton({ url, label = "Exportar Excel", className = "" }: Props) {
  const [busy, setBusy] = useState(false);

  async function handleClick() {
    if (busy) return;
    setBusy(true);
    try {
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) {
        alert(`No se pudo exportar (${res.status}).`);
        return;
      }
      const blob = await res.blob();
      const dispo = res.headers.get("Content-Disposition") ?? "";
      const m = /filename="([^"]+)"/.exec(dispo);
      const filename = m?.[1] ?? "export.xlsx";
      const objUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(objUrl);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Error de red al exportar.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={busy}
      title="Descargar planilla .xlsx"
      className={
        "group inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-emerald-500 to-emerald-600 " +
        "px-3.5 py-2 text-sm font-semibold text-white shadow-sm shadow-emerald-500/25 " +
        "transition-all hover:-translate-y-0.5 hover:from-emerald-600 hover:to-emerald-700 hover:shadow-md " +
        "active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0 " +
        className
      }
    >
      {busy ? (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" className="h-4 w-4 animate-spin">
          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeOpacity="0.25" strokeWidth="4" />
          <path fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
        </svg>
      ) : (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 transition-transform group-hover:scale-110">
          <path fillRule="evenodd" d="M15.988 3.012A2.25 2.25 0 0 1 18 5.25v6.5A2.25 2.25 0 0 1 15.75 14H13.5V7A2.5 2.5 0 0 0 11 4.5H8.128a2.252 2.252 0 0 1 1.884-1.488A2.25 2.25 0 0 1 12.25 1h1.5a2.25 2.25 0 0 1 2.238 2.012ZM11.5 3.25a.75.75 0 0 1 .75-.75h1.5a.75.75 0 0 1 .75.75v.25h-3v-.25Z" clipRule="evenodd" />
          <path fillRule="evenodd" d="M2 6.75A.75.75 0 0 1 2.75 6h8.5A.75.75 0 0 1 12 6.75v10.5A.75.75 0 0 1 11.25 18h-8.5A.75.75 0 0 1 2 17.25V6.75ZM4 9.5a.75.75 0 0 1 .75-.75h4.5a.75.75 0 0 1 0 1.5h-4.5A.75.75 0 0 1 4 9.5Zm.75 2.25a.75.75 0 0 0 0 1.5h4.5a.75.75 0 0 0 0-1.5h-4.5ZM4 15a.75.75 0 0 1 .75-.75h4.5a.75.75 0 0 1 0 1.5h-4.5A.75.75 0 0 1 4 15Z" clipRule="evenodd" />
        </svg>
      )}
      <span>{busy ? "Generando…" : label}</span>
    </button>
  );
}
