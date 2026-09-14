"use client";

import { useState } from "react";
import { ResetPasswordModal } from "@/components/admin/reset-password-modal";

type AdminResetPasswordButtonProps = {
  userId: string;
  isActive: boolean;
};

export function AdminResetPasswordButton({ userId, isActive }: AdminResetPasswordButtonProps) {
  const [isResetting, setIsResetting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ temporaryPassword: string; isActive: boolean } | null>(
    null,
  );

  async function onResetPassword() {
    setError(null);

    const confirmed = window.confirm(
      "Generare una nuova password temporanea per questo utente? La password attuale non sarà più valida.",
    );
    if (!confirmed) {
      return;
    }

    setIsResetting(true);

    try {
      const response = await fetch(`/api/admin/users/${userId}/reset-password`, {
        method: "POST",
      });
      const body = (await response.json().catch(() => null)) as
        | { error?: string; temporaryPassword?: string; isActive?: boolean }
        | null;

      if (!response.ok || !body?.temporaryPassword) {
        setError(body?.error ?? "Reset password non riuscito.");
        return;
      }

      setResult({
        temporaryPassword: body.temporaryPassword,
        isActive: body.isActive ?? isActive,
      });
    } catch {
      setError("Errore imprevisto. Riprova.");
    } finally {
      setIsResetting(false);
    }
  }

  return (
    <>
      <div className="flex flex-col gap-1">
        <button
          type="button"
          onClick={onResetPassword}
          disabled={isResetting}
          className="inline-flex items-center justify-center rounded-md border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-xs font-semibold text-amber-800 hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isResetting ? "Reset..." : "Reset password"}
        </button>
        {!isActive ? (
          <p className="text-[11px] text-amber-800">Utente disattivato</p>
        ) : null}
        {error ? <p className="text-[11px] text-red-600">{error}</p> : null}
      </div>

      {result ? (
        <ResetPasswordModal
          temporaryPassword={result.temporaryPassword}
          isActive={result.isActive}
          onClose={() => setResult(null)}
        />
      ) : null}
    </>
  );
}
