"use client";

import { useEffect } from "react";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message?: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  /** 'danger' pinta el boton de confirmar en rojo (para acciones destructivas). */
  tone?: "danger" | "default";
  busy?: boolean;
  onConfirm: () => void | Promise<void>;
  onClose: () => void;
}

/**
 * Modal de confirmacion integrado al diseño del ERP.
 *
 * Reemplaza a window.confirm() dandonos: acento visual (rojo para destructivo),
 * botones alineados, estado 'busy', cierre por Esc / click afuera y bloqueo de
 * scroll. Uso tipico:
 *
 *   <ConfirmDialog
 *     open={confirmOpen}
 *     title="Eliminar foto"
 *     message="¿Seguro que querés eliminarla? Esta accion es definitiva."
 *     confirmLabel="Eliminar"
 *     tone="danger"
 *     onConfirm={handleDelete}
 *     onClose={() => setConfirmOpen(false)}
 *   />
 */
export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Confirmar",
  cancelLabel = "Cancelar",
  tone = "default",
  busy = false,
  onConfirm,
  onClose,
}: ConfirmDialogProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) onClose();
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, busy, onClose]);

  if (!open) return null;

  const isDanger = tone === "danger";
  const confirmBtnCls = isDanger
    ? "bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 shadow-red-500/25"
    : "bg-gradient-to-r from-[#4FAEB2] to-[#3F8E91] hover:from-[#3F8E91] hover:to-[#2F6F72] shadow-[#4FAEB2]/25";

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm px-3"
      onClick={() => { if (!busy) onClose(); }}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div
        className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-5">
          <div className="mb-3 flex items-start gap-3">
            {isDanger && (
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-red-50 text-red-600">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
                  <path fillRule="evenodd" d="M9.401 3.003c1.155-2 4.043-2 5.197 0l7.355 12.748c1.154 2-.29 4.5-2.599 4.5H4.645c-2.309 0-3.752-2.5-2.598-4.5L9.4 3.003ZM12 8.25a.75.75 0 0 1 .75.75v3.75a.75.75 0 0 1-1.5 0V9a.75.75 0 0 1 .75-.75Zm0 8.25a.94.94 0 1 0 0-1.875.94.94 0 0 0 0 1.875Z" clipRule="evenodd" />
                </svg>
              </div>
            )}
            <div className="min-w-0 flex-1">
              <h2 className="text-base font-semibold text-slate-900">{title}</h2>
              {message && (
                <div className="mt-1 text-sm text-slate-600">{message}</div>
              )}
            </div>
          </div>

          <div className="mt-5 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={busy}
              className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50 disabled:opacity-50"
            >
              {cancelLabel}
            </button>
            <button
              type="button"
              onClick={() => void onConfirm()}
              disabled={busy}
              className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0 ${confirmBtnCls}`}
            >
              {busy && (
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" className="h-4 w-4 animate-spin">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeOpacity="0.25" strokeWidth="4" />
                  <path fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                </svg>
              )}
              {busy ? "Procesando…" : confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
