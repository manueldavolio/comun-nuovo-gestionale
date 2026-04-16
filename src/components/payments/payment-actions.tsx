"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type PaymentActionsProps = {
  paymentId: string;
  status: "PENDING" | "PAID" | "OVERDUE" | "CANCELLED";
  receiptId: string | null;
};

export function PaymentActions({ paymentId, status, receiptId }: PaymentActionsProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canMarkPaid = status !== "PAID" && status !== "CANCELLED";

  async function handleMarkPaid() {
    setError(null);
    setIsSubmitting(true);

    try {
      const response = await fetch(`/api/genitore/payments/${paymentId}/mark-paid`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ paymentMethod: "Manuale dashboard (test)" }),
      });

      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        setError(body?.error ?? "Errore durante la registrazione pagamento.");
        setIsSubmitting(false);
        return;
      }

      router.refresh();
    } catch {
      setError("Errore imprevisto. Riprova.");
      setIsSubmitting(false);
    }
  }

  return (
    <div className="flex min-w-[170px] flex-col gap-2">
      {canMarkPaid ? (
        <button
          type="button"
          onClick={handleMarkPaid}
          disabled={isSubmitting}
          className="rounded-md border border-blue-300 bg-blue-50 px-2.5 py-1.5 text-xs font-semibold text-blue-800 transition hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSubmitting ? "Registrazione..." : "Segna come pagato"}
        </button>
      ) : (
        <span className="text-xs text-zinc-500">Pagamento chiuso</span>
      )}

      {receiptId ? (
        <a
          href={`/api/genitore/receipts/${receiptId}/download`}
          className="rounded-md border border-emerald-300 bg-emerald-50 px-2.5 py-1.5 text-center text-xs font-semibold text-emerald-800 transition hover:bg-emerald-100"
        >
          Scarica ricevuta
        </a>
      ) : (
        <span className="text-xs text-zinc-500">Ricevuta non disponibile</span>
      )}

      {error ? <p className="text-xs text-red-600">{error}</p> : null}
    </div>
  );
}
