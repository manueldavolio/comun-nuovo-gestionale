"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type PaymentActionsProps = {
  paymentId: string;
  paymentType: "DEPOSIT" | "BALANCE";
  status: "PENDING" | "PAID" | "OVERDUE" | "CANCELLED" | "FAILED" | "EXPIRED";
  receiptId: string | null;
  /** Importo che verrà addebitato (già calcolato server-side). */
  displayAmountLabel: string;
  checkoutLabel: string;
  canCheckout: boolean;
};

export function PaymentActions({
  paymentId,
  status,
  receiptId,
  displayAmountLabel,
  checkoutLabel,
  canCheckout,
}: PaymentActionsProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCheckout() {
    setError(null);
    setIsSubmitting(true);

    try {
      const response = await fetch(`/api/genitore/payments/${paymentId}/checkout`, {
        method: "POST",
      });

      const body = (await response.json().catch(() => null)) as
        | { error?: string; checkoutUrl?: string }
        | null;
      if (!response.ok) {
        setError(body?.error ?? "Errore durante avvio pagamento.");
        setIsSubmitting(false);
        return;
      }

      if (!body?.checkoutUrl) {
        setError("Sessione checkout non disponibile.");
        setIsSubmitting(false);
        return;
      }

      window.location.href = body.checkoutUrl;
    } catch {
      setError("Errore imprevisto. Riprova.");
      setIsSubmitting(false);
    }
  }

  return (
    <div className="flex min-w-[170px] flex-col gap-2">
      <p className="text-base font-bold tabular-nums text-zinc-900">{displayAmountLabel}</p>

      {status === "PAID" ? (
        <span className="text-xs text-zinc-500">Pagamento chiuso</span>
      ) : null}
      {status === "CANCELLED" ? (
        <span className="text-xs text-zinc-500">Annullato — non addebitabile</span>
      ) : null}

      {canCheckout ? (
        <button
          type="button"
          onClick={handleCheckout}
          disabled={isSubmitting}
          className="min-h-11 rounded-md border border-blue-300 bg-blue-50 px-2.5 py-1.5 text-xs font-semibold text-blue-800 transition hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSubmitting ? "Apertura checkout..." : `${checkoutLabel} · ${displayAmountLabel}`}
        </button>
      ) : null}

      {receiptId ? (
        <a
          href={`/api/genitore/receipts/${receiptId}/download`}
          onClick={() => router.refresh()}
          className="rounded-md border border-emerald-300 bg-emerald-50 px-2.5 py-1.5 text-center text-xs font-semibold text-emerald-800 transition hover:bg-emerald-100"
        >
          Scarica ricevuta
        </a>
      ) : status === "PAID" ? (
        <span className="text-xs text-zinc-500">Ricevuta non disponibile</span>
      ) : null}

      {error ? <p className="text-xs text-red-600">{error}</p> : null}
    </div>
  );
}
