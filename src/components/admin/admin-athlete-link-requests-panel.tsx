"use client";

import { useEffect, useState } from "react";
import { Check, Clock3, X } from "lucide-react";

type AdminLinkRequest = {
  id: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  createdAt: string;
  reviewedAt: string | null;
  requester: { fullName: string; email: string; phone: string };
  athlete: { id: string; fullName: string; taxCode: string };
  primaryParent: { fullName: string; email: string };
};

type ReviewAction = "APPROVE" | "REJECT";

type ConfirmReview = {
  request: AdminLinkRequest;
  action: ReviewAction;
};

const STATUS_LABEL: Record<AdminLinkRequest["status"], string> = {
  PENDING: "In attesa",
  APPROVED: "Approvata",
  REJECTED: "Rifiutata",
};

function statusBadgeClass(status: AdminLinkRequest["status"]) {
  switch (status) {
    case "PENDING":
      return "bg-amber-100 text-amber-900 ring-1 ring-amber-200";
    case "APPROVED":
      return "bg-sky-100 text-sky-900 ring-1 ring-sky-200";
    case "REJECTED":
      return "bg-red-50 text-red-800 ring-1 ring-red-200";
  }
}

export function AdminAthleteLinkRequestsPanel() {
  const [items, setItems] = useState<AdminLinkRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [confirmReview, setConfirmReview] = useState<ConfirmReview | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/athlete-link-requests");
      const data = (await response.json().catch(() => null)) as
        | { data?: AdminLinkRequest[]; error?: string }
        | null;
      if (!response.ok) {
        setError(data?.error ?? "Caricamento non riuscito.");
        return;
      }
      setItems(data?.data ?? []);
    } catch {
      setError("Errore imprevisto durante il caricamento.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    if (!confirmReview || pendingId) {
      return;
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setConfirmReview(null);
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [confirmReview, pendingId]);

  async function review(requestId: string, action: ReviewAction) {
    setPendingId(requestId);
    setFeedback(null);
    try {
      const response = await fetch(`/api/admin/athlete-link-requests/${requestId}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = (await response.json().catch(() => null)) as
        | { error?: string; message?: string }
        | null;
      if (!response.ok) {
        setFeedback(data?.error ?? "Operazione non riuscita.");
        return;
      }
      setFeedback(data?.message ?? "Operazione completata.");
      setConfirmReview(null);
      await load();
    } catch {
      setFeedback("Errore imprevisto.");
    } finally {
      setPendingId(null);
    }
  }

  if (loading) {
    return (
      <p className="rounded-2xl border border-sky-100 bg-sky-50/50 px-4 py-3 text-sm font-medium text-zinc-600">
        Caricamento richieste...
      </p>
    );
  }

  if (error) {
    return (
      <p className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
        {error}
      </p>
    );
  }

  const pending = items.filter((item) => item.status === "PENDING");
  const others = items.filter((item) => item.status !== "PENDING");
  const isBusy = pendingId !== null;
  const confirmIsApprove = confirmReview?.action === "APPROVE";

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-sky-100 bg-sky-50/60 px-4 py-3">
          <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-blue-800/70">
            Totale
          </p>
          <p className="mt-1 text-2xl font-black text-blue-950">{items.length}</p>
        </div>
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
          <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-amber-800/80">
            In attesa
          </p>
          <p className="mt-1 text-2xl font-black text-amber-950">{pending.length}</p>
        </div>
        <div className="rounded-2xl border border-sky-100 bg-white px-4 py-3">
          <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-zinc-500">
            Storico
          </p>
          <p className="mt-1 text-2xl font-black text-blue-950">{others.length}</p>
        </div>
      </div>

      {feedback ? (
        <p className="rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm font-medium text-blue-900">
          {feedback}
        </p>
      ) : null}

      <section>
        <div className="mb-3 flex items-center gap-2">
          <Clock3 className="h-5 w-5 text-amber-700" aria-hidden />
          <h2 className="text-base font-black text-blue-950">In attesa ({pending.length})</h2>
        </div>
        {pending.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-sky-200 bg-sky-50/40 px-4 py-4 text-sm text-zinc-600">
            Nessuna richiesta in attesa.
          </p>
        ) : (
          <ul className="grid gap-3">
            {pending.map((item) => (
              <li
                key={item.id}
                className="rounded-3xl border border-amber-200 bg-gradient-to-br from-amber-50 to-white p-4 shadow-sm sm:p-5"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-base font-black text-blue-950">
                      {item.requester.fullName}
                      <span className="mx-1.5 font-semibold text-zinc-400">→</span>
                      {item.athlete.fullName}
                    </p>
                    <span
                      className={`mt-2 inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-bold ${statusBadgeClass(item.status)}`}
                    >
                      {STATUS_LABEL[item.status]}
                    </span>
                  </div>
                </div>

                <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
                  <div>
                    <dt className="text-[10px] font-bold uppercase tracking-[0.12em] text-zinc-500">
                      Richiedente
                    </dt>
                    <dd className="mt-0.5 font-semibold text-blue-950">
                      {item.requester.email}
                      <span className="mt-0.5 block text-xs font-medium text-zinc-600">
                        {item.requester.phone}
                      </span>
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[10px] font-bold uppercase tracking-[0.12em] text-zinc-500">
                      Atleta
                    </dt>
                    <dd className="mt-0.5 font-semibold text-blue-950">
                      CF {item.athlete.taxCode}
                    </dd>
                  </div>
                  <div className="sm:col-span-2">
                    <dt className="text-[10px] font-bold uppercase tracking-[0.12em] text-zinc-500">
                      Genitore principale
                    </dt>
                    <dd className="mt-0.5 font-semibold text-blue-950">
                      {item.primaryParent.fullName}
                      <span className="mt-0.5 block text-xs font-medium text-zinc-600">
                        {item.primaryParent.email}
                      </span>
                    </dd>
                  </div>
                </dl>

                <p className="mt-3 text-xs font-medium text-zinc-500">
                  Richiesta: {new Date(item.createdAt).toLocaleString("it-IT")}
                </p>

                <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                  <button
                    type="button"
                    disabled={isBusy}
                    onClick={() => setConfirmReview({ request: item, action: "APPROVE" })}
                    className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-blue-800 px-4 text-sm font-bold text-white hover:bg-blue-900 disabled:opacity-60"
                  >
                    <Check className="h-4 w-4" aria-hidden />
                    Approva
                  </button>
                  <button
                    type="button"
                    disabled={isBusy}
                    onClick={() => setConfirmReview({ request: item, action: "REJECT" })}
                    className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-red-300 bg-white px-4 text-sm font-bold text-red-700 hover:bg-red-50 disabled:opacity-60"
                  >
                    <X className="h-4 w-4" aria-hidden />
                    Rifiuta
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="text-base font-black text-blue-950">Storico</h2>
        {others.length === 0 ? (
          <p className="mt-3 rounded-2xl border border-dashed border-sky-200 bg-sky-50/40 px-4 py-4 text-sm text-zinc-600">
            Nessuna richiesta gestita.
          </p>
        ) : (
          <ul className="mt-3 grid gap-2">
            {others.map((item) => (
              <li
                key={item.id}
                className="rounded-2xl border border-sky-100 bg-sky-50/40 px-4 py-3 text-sm"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-bold text-blue-950">
                    {item.requester.fullName}
                    <span className="mx-1 font-semibold text-zinc-400">→</span>
                    {item.athlete.fullName}
                  </p>
                  <span
                    className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-bold ${statusBadgeClass(item.status)}`}
                  >
                    {STATUS_LABEL[item.status]}
                  </span>
                </div>
                <p className="mt-1 text-xs font-medium text-zinc-500">
                  {new Date(item.createdAt).toLocaleString("it-IT")}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      {confirmReview ? (
        <div
          className="fixed inset-0 z-[60] flex items-end justify-center bg-zinc-900/45 p-4 sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby="link-review-confirm-title"
        >
          <div className="mb-[max(0.5rem,env(safe-area-inset-bottom))] w-full max-w-md rounded-2xl border border-sky-100 bg-white p-5 shadow-xl sm:mb-0">
            <h2
              id="link-review-confirm-title"
              className="text-lg font-black text-blue-950"
            >
              {confirmIsApprove ? "Conferma approvazione" : "Conferma rifiuto"}
            </h2>
            <p className="mt-2 text-sm text-zinc-600">
              Stai per{" "}
              <span className="font-bold text-blue-950">
                {confirmIsApprove ? "approvare" : "rifiutare"}
              </span>{" "}
              la richiesta di associazione:
            </p>
            <p className="mt-3 rounded-xl border border-sky-100 bg-sky-50/70 px-3 py-3 text-sm font-bold text-blue-950">
              {confirmReview.request.requester.fullName}
              <span className="mx-1.5 font-semibold text-zinc-400">→</span>
              {confirmReview.request.athlete.fullName}
            </p>
            <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                disabled={isBusy}
                onClick={() => setConfirmReview(null)}
                className="inline-flex min-h-11 items-center justify-center rounded-xl border border-sky-200 bg-white px-4 text-sm font-bold text-blue-800 hover:bg-sky-50 disabled:opacity-60"
              >
                Annulla
              </button>
              <button
                type="button"
                disabled={isBusy}
                onClick={() =>
                  void review(confirmReview.request.id, confirmReview.action)
                }
                className={
                  confirmIsApprove
                    ? "inline-flex min-h-11 items-center justify-center rounded-xl bg-blue-800 px-4 text-sm font-bold text-white hover:bg-blue-900 disabled:opacity-60"
                    : "inline-flex min-h-11 items-center justify-center rounded-xl bg-red-700 px-4 text-sm font-bold text-white hover:bg-red-800 disabled:opacity-60"
                }
              >
                {isBusy
                  ? "Operazione in corso..."
                  : confirmIsApprove
                    ? "Conferma approvazione"
                    : "Conferma rifiuto"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
