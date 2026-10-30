"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

export type ParentBankTransferSummary = {
  id: string;
  status: "AWAITING_PROOF" | "UNDER_REVIEW" | "APPROVED" | "REJECTED" | "SUPERSEDED";
  amount: string;
  causal: string;
  proofUploadedAt: string | null;
  rejectionReason: string | null;
};

type PaymentActionsProps = {
  paymentId: string;
  paymentType: "DEPOSIT" | "BALANCE";
  status: "PENDING" | "PAID" | "OVERDUE" | "CANCELLED" | "FAILED" | "EXPIRED";
  receiptId: string | null;
  /** Importo che verrà addebitato (già calcolato server-side). */
  displayAmountLabel: string;
  checkoutLabel: string;
  canCheckout: boolean;
  bankTransferConfigured: boolean;
  activeBankTransfer: ParentBankTransferSummary | null;
};

function bankStatusCopy(status: ParentBankTransferSummary["status"]) {
  switch (status) {
    case "AWAITING_PROOF":
      return "In attesa di contabile";
    case "UNDER_REVIEW":
      return "Bonifico in verifica";
    case "REJECTED":
      return "Contabile respinta";
    case "APPROVED":
      return "Bonifico approvato";
    case "SUPERSEDED":
      return "Bonifico superato";
    default:
      return status;
  }
}

export function PaymentActions({
  paymentId,
  status,
  receiptId,
  displayAmountLabel,
  checkoutLabel,
  canCheckout,
  bankTransferConfigured,
  activeBankTransfer,
}: PaymentActionsProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [bankInfo, setBankInfo] = useState<{
    beneficiary: string;
    ibanDisplay: string;
    causal: string;
    amount: string;
    requestId: string;
    status: ParentBankTransferSummary["status"];
    rejectionReason: string | null;
  } | null>(
    activeBankTransfer
      ? {
          beneficiary: "",
          ibanDisplay: "",
          causal: activeBankTransfer.causal,
          amount: activeBankTransfer.amount,
          requestId: activeBankTransfer.id,
          status: activeBankTransfer.status,
          rejectionReason: activeBankTransfer.rejectionReason,
        }
      : null,
  );

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

  async function handleStartBankTransfer() {
    setError(null);
    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/genitore/payments/${paymentId}/bank-transfer`, {
        method: "POST",
      });
      const body = (await response.json().catch(() => null)) as
        | {
            error?: string;
            request?: {
              id: string;
              status: ParentBankTransferSummary["status"];
              amount: string;
              causal: string;
              rejectionReason: string | null;
            };
            bank?: { beneficiary: string; ibanDisplay: string };
          }
        | null;
      if (!response.ok || !body?.request || !body.bank) {
        setError(body?.error ?? "Impossibile avviare il bonifico.");
        setIsSubmitting(false);
        return;
      }
      setBankInfo({
        beneficiary: body.bank.beneficiary,
        ibanDisplay: body.bank.ibanDisplay,
        causal: body.request.causal,
        amount: body.request.amount,
        requestId: body.request.id,
        status: body.request.status,
        rejectionReason: body.request.rejectionReason,
      });
      router.refresh();
    } catch {
      setError("Errore imprevisto. Riprova.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleUploadProof(file: File) {
    if (!bankInfo?.requestId) return;
    setError(null);
    setIsSubmitting(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const response = await fetch(`/api/genitore/bank-transfers/${bankInfo.requestId}/proof`, {
        method: "POST",
        body: form,
      });
      const body = (await response.json().catch(() => null)) as
        | { error?: string; status?: ParentBankTransferSummary["status"] }
        | null;
      if (!response.ok) {
        setError(body?.error ?? "Upload contabile non riuscito.");
        setIsSubmitting(false);
        return;
      }
      setBankInfo((prev) =>
        prev
          ? {
              ...prev,
              status: body?.status ?? "UNDER_REVIEW",
              rejectionReason: null,
            }
          : prev,
      );
      router.refresh();
    } catch {
      setError("Errore imprevisto durante upload.");
    } finally {
      setIsSubmitting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  const showPayOptions = canCheckout && status !== "PAID";
  const showCancelledBlocked = status === "CANCELLED" && !canCheckout;

  return (
    <div className="flex min-w-[170px] flex-col gap-2">
      <p className="text-base font-bold tabular-nums text-zinc-900">{displayAmountLabel}</p>

      {status === "PAID" ? (
        <span className="text-xs text-zinc-500">Pagamento chiuso</span>
      ) : null}
      {showCancelledBlocked ? (
        <span className="text-xs text-zinc-500">Annullato — non addebitabile</span>
      ) : null}
      {status === "CANCELLED" && canCheckout ? (
        <span className="text-xs font-medium text-amber-800">
          Debito ancora dovuto — puoi pagare ora
        </span>
      ) : null}

      {showPayOptions ? (
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={handleCheckout}
            disabled={isSubmitting}
            className="min-h-12 w-full rounded-xl bg-blue-800 px-3 py-2.5 text-sm font-bold text-white transition hover:bg-blue-900 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? "Apertura checkout..." : `Paga online · ${displayAmountLabel}`}
          </button>
          {bankTransferConfigured ? (
            <button
              type="button"
              onClick={handleStartBankTransfer}
              disabled={isSubmitting}
              className="min-h-11 w-full rounded-xl border border-blue-300 bg-white px-3 py-2 text-sm font-bold text-blue-900 transition hover:bg-sky-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Paga con bonifico bancario
            </button>
          ) : (
            <p className="text-[11px] text-zinc-500">
              Bonifico non ancora disponibile (coordinate da configurare in amministrazione).
            </p>
          )}
          <p className="text-[11px] text-zinc-500">{checkoutLabel}</p>
        </div>
      ) : null}

      {bankInfo ? (
        <div className="mt-1 space-y-2 rounded-xl border border-sky-200 bg-white p-3 text-xs text-zinc-700">
          <p className="font-bold text-blue-950">{bankStatusCopy(bankInfo.status)}</p>
          {bankInfo.beneficiary ? (
            <p>
              <span className="font-semibold">Beneficiario:</span> {bankInfo.beneficiary}
            </p>
          ) : (
            <p className="text-zinc-500">
              Apri di nuovo «Paga con bonifico» per vedere beneficiario e IBAN completi.
            </p>
          )}
          {bankInfo.ibanDisplay ? (
            <p className="font-mono text-[12px]">
              <span className="font-sans font-semibold">IBAN:</span> {bankInfo.ibanDisplay}
            </p>
          ) : null}
          <p>
            <span className="font-semibold">Importo:</span>{" "}
            {Number(bankInfo.amount).toLocaleString("it-IT", {
              style: "currency",
              currency: "EUR",
            })}
          </p>
          <p>
            <span className="font-semibold">Causale univoca:</span>{" "}
            <span className="font-mono">{bankInfo.causal}</span>
          </p>
          {bankInfo.rejectionReason ? (
            <p className="rounded-lg border border-red-200 bg-red-50 px-2 py-1 text-red-800">
              Motivazione rifiuto: {bankInfo.rejectionReason}
            </p>
          ) : null}
          {(bankInfo.status === "AWAITING_PROOF" || bankInfo.status === "REJECTED") &&
          canCheckout ? (
            <div className="space-y-1">
              <input
                ref={fileInputRef}
                type="file"
                accept="application/pdf,image/jpeg,image/png"
                className="block w-full text-[11px]"
                disabled={isSubmitting}
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) void handleUploadProof(file);
                }}
              />
              <p className="text-[11px] text-zinc-500">PDF/JPG/PNG, max 8 MB.</p>
            </div>
          ) : null}
          {bankInfo.status === "UNDER_REVIEW" ? (
            <p className="text-[11px] text-amber-800">
              Contabile ricevuta. Puoi ancora pagare online se preferisci; verrà contabilizzato un
              solo pagamento.
            </p>
          ) : null}
        </div>
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
