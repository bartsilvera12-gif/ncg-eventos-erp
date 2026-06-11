"use client";

import { useEffect, useState } from "react";
import { fetchWithSupabaseSession } from "@/lib/api/fetch-with-supabase-session";

type ProyectoLite = { id: string; titulo: string };

/**
 * Selector inline para imputar un registro (venta/compra/gasto/movimiento)
 * a una obra. Si cambia, hace PATCH a /api/proyectos/imputar.
 *
 * No es bloqueante: el select está disponible siempre, el cambio se aplica
 * en background. Si falla, el valor anterior se restaura.
 */
export default function ImputarObraSelect({
  tabla,
  id,
  proyectoIdInicial,
  className = "",
  onChanged,
}: {
  tabla: "ventas" | "compras" | "gastos" | "movimientos_inventario";
  id: string;
  proyectoIdInicial: string | null;
  className?: string;
  onChanged?: (proyectoId: string | null) => void;
}) {
  const [proyectos, setProyectos] = useState<ProyectoLite[]>([]);
  const [valor, setValor] = useState<string>(proyectoIdInicial ?? "");
  const [saving, setSaving] = useState(false);

  // Lista de obras: una sola vez por sesión, cacheable a futuro si hace falta.
  useEffect(() => {
    let cancelled = false;
    fetch("/api/proyectos", { credentials: "include", cache: "no-store" })
      .then((r) => r.json())
      .then((j: { success?: boolean; data?: { id: string; titulo: string }[] }) => {
        if (!cancelled && j.success && Array.isArray(j.data)) {
          setProyectos(j.data.map((p) => ({ id: p.id, titulo: p.titulo })));
        }
      })
      .catch(() => { /* sin proyectos: select queda vacío */ });
    return () => { cancelled = true; };
  }, []);

  async function handleChange(nuevo: string) {
    const previo = valor;
    setValor(nuevo);
    setSaving(true);
    try {
      const r = await fetchWithSupabaseSession("/api/proyectos/imputar", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tabla, id, proyecto_id: nuevo || null }),
      });
      const j = (await r.json().catch(() => ({}))) as { success?: boolean; error?: string };
      if (!r.ok || !j.success) {
        // Rollback visual si falla
        setValor(previo);
        return;
      }
      onChanged?.(nuevo || null);
    } catch {
      setValor(previo);
    } finally {
      setSaving(false);
    }
  }

  return (
    <select
      value={valor}
      onChange={(e) => void handleChange(e.target.value)}
      disabled={saving}
      className={`max-w-[220px] truncate rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 disabled:opacity-50 ${className}`}
    >
      <option value="">— Sin obra —</option>
      {proyectos.map((p) => (
        <option key={p.id} value={p.id}>{p.titulo}</option>
      ))}
    </select>
  );
}
