"use client";

import { useState } from "react";
import { fetchWithSupabaseSession } from "@/lib/api/fetch-with-supabase-session";

/**
 * Botón inline para marcar como cobrado/pagado el saldo restante.
 * Se usa en cuentas por cobrar (ventas) y por pagar (compras/gastos).
 */
export default function SaldarButton({
  tabla,
  id,
  label,
  onDone,
}: {
  tabla: "ventas" | "compras" | "gastos";
  id: string;
  label: string;
  onDone?: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function handle() {
    const verb = tabla === "ventas" ? "cobrar" : "pagar";
    if (!confirm(`¿Marcar como ${verb === "cobrar" ? "cobrada" : "pagada"} esta operación?`)) return;
    setBusy(true);
    setErr(null);
    try {
      const r = await fetchWithSupabaseSession("/api/finanzas/saldar", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tabla, id }),
      });
      const j = (await r.json().catch(() => ({}))) as { success?: boolean; error?: string };
      if (!r.ok || !j.success) {
        setErr(j.error ?? "No se pudo saldar");
        return;
      }
      onDone?.();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-0.5">
      <button type="button" onClick={handle} disabled={busy}
        className="text-xs font-medium text-[#3F8E91] hover:text-[#2F6F72] underline disabled:opacity-50">
        {busy ? "…" : label}
      </button>
      {err && <span className="text-[10px] text-red-600">{err}</span>}
    </div>
  );
}
