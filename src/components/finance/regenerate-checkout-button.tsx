"use client";

import { useState } from "react";

type RegenerateCheckoutButtonProps = {
  paymentId: string;
};

export function RegenerateCheckoutButton({ paymentId }: RegenerateCheckoutButtonProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleRegenerateCheckout() {
    setIsSubmitting(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/payments/${paymentId}/regenerate-checkout`, {
        method: "POST",
      });
      const body = (await response.json().catch(() => null)) as
        | { error?: string; checkoutUrl?: string }
        | null;

      if (!response.ok) {
        setError(body?.error ?? "Errore durante rigenerazione checkout.");
        return;
      }

      if (!body?.checkoutUrl) {
        setError("Checkout non disponibile.");
        return;
      }

      window.open(body.checkoutUrl, "_blank", "noopener,noreferrer");
    } catch {
      setError("Errore imprevisto durante rigenerazione checkout.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        onClick={handleRegenerateCheckout}
        disabled={isSubmitting}
        className="inline-flex min-h-10 items-center justify-center rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-bold text-blue-800 transition hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isSubmitting ? "Rigenerazione..." : "Rigenera checkout"}
      </button>
      {error ? <span className="text-xs text-red-600">{error}</span> : null}
    </div>
  );
}
