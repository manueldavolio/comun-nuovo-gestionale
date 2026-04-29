"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type RegenerateReceiptButtonProps = {
  paymentId: string;
};

export function RegenerateReceiptButton({ paymentId }: RegenerateReceiptButtonProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleRegenerate() {
    setIsSubmitting(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/payments/${paymentId}/regenerate-receipt`, {
        method: "POST",
      });
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        setError(body?.error ?? "Errore durante rigenerazione ricevuta.");
        setIsSubmitting(false);
        return;
      }
      router.refresh();
    } catch {
      setError("Errore imprevisto durante rigenerazione.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        onClick={handleRegenerate}
        disabled={isSubmitting}
        className="inline-flex rounded-lg border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-800 transition hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isSubmitting ? "Rigenerazione..." : "Rigenera ricevuta"}
      </button>
      {error ? <span className="text-xs text-red-600">{error}</span> : null}
    </div>
  );
}
