"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type BankTransferReviewActionsProps = {
  requestId: string;
};

export function BankTransferReviewActions({ requestId }: BankTransferReviewActionsProps) {
  const router = useRouter();
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function approve() {
    if (
      !window.confirm(
        "Confermi di aver verificato l'accredito sul conto bancario? L'operazione segnerà il pagamento come PAID.",
      )
    ) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/bank-transfers/${requestId}/approve`, {
        method: "POST",
      });
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        setError(body?.error ?? "Approvazione non riuscita.");
        return;
      }
      router.refresh();
    } catch {
      setError("Errore imprevisto.");
    } finally {
      setBusy(false);
    }
  }

  async function reject() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/bank-transfers/${requestId}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      });
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        setError(body?.error ?? "Respingimento non riuscito.");
        return;
      }
      setReason("");
      router.refresh();
    } catch {
      setError("Errore imprevisto.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        <a
          href={`/api/admin/bank-transfers/${requestId}/proof`}
          className="rounded-lg border border-sky-300 bg-sky-50 px-3 py-1.5 text-xs font-bold text-blue-900"
        >
          Scarica contabile
        </a>
        <button
          type="button"
          disabled={busy}
          onClick={() => void approve()}
          className="rounded-lg bg-emerald-700 px-3 py-1.5 text-xs font-bold text-white disabled:opacity-60"
        >
          Approva
        </button>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Motivazione rifiuto"
          className="min-w-[180px] flex-1 rounded-lg border border-zinc-200 px-2 py-1.5 text-xs"
        />
        <button
          type="button"
          disabled={busy || !reason.trim()}
          onClick={() => void reject()}
          className="rounded-lg border border-red-300 bg-red-50 px-3 py-1.5 text-xs font-bold text-red-800 disabled:opacity-60"
        >
          Respingi
        </button>
      </div>
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
    </div>
  );
}
