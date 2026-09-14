"use client";

import { useEffect, useState } from "react";

type ResetPasswordModalProps = {
  temporaryPassword: string;
  isActive: boolean;
  onClose: () => void;
};

export function ResetPasswordModal({
  temporaryPassword,
  isActive,
  onClose,
}: ResetPasswordModalProps) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  async function copyPassword() {
    try {
      await navigator.clipboard.writeText(temporaryPassword);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-900/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="reset-password-title"
    >
      <div className="w-full max-w-md rounded-xl border border-blue-100 bg-white p-4 shadow-lg">
        <h2 id="reset-password-title" className="text-base font-semibold text-zinc-900">
          Password temporanea generata
        </h2>
        <p className="mt-2 text-sm text-zinc-600">
          Comunica questa password all&apos;utente e chiedigli di cambiarla al prossimo accesso.
          Non viene salvata in chiaro.
        </p>

        {!isActive ? (
          <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            Attenzione: l&apos;utente è disattivato. Anche con la nuova password non potrà accedere
            finché non viene riattivato.
          </p>
        ) : null}

        <div className="mt-4 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
            Password temporanea
          </p>
          <p className="mt-1 break-all font-mono text-sm font-semibold text-zinc-900">
            {temporaryPassword}
          </p>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={copyPassword}
            className="inline-flex rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-100"
          >
            {copied ? "Copiata" : "Copia"}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-50"
          >
            Chiudi
          </button>
        </div>
      </div>
    </div>
  );
}
