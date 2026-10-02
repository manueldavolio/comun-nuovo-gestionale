"use client";

import { useEffect, useState } from "react";

type AdminLinkRequest = {
  id: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  createdAt: string;
  reviewedAt: string | null;
  requester: { fullName: string; email: string; phone: string };
  athlete: { id: string; fullName: string; taxCode: string };
  primaryParent: { fullName: string; email: string };
};

const STATUS_LABEL: Record<AdminLinkRequest["status"], string> = {
  PENDING: "In attesa",
  APPROVED: "Approvata",
  REJECTED: "Rifiutata",
};

export function AdminAthleteLinkRequestsPanel() {
  const [items, setItems] = useState<AdminLinkRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

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

  async function review(requestId: string, action: "APPROVE" | "REJECT") {
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
      await load();
    } catch {
      setFeedback("Errore imprevisto.");
    } finally {
      setPendingId(null);
    }
  }

  if (loading) {
    return <p className="text-sm text-zinc-600">Caricamento richieste...</p>;
  }

  if (error) {
    return <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>;
  }

  const pending = items.filter((item) => item.status === "PENDING");
  const others = items.filter((item) => item.status !== "PENDING");

  return (
    <div className="space-y-4">
      {feedback ? (
        <p className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-800">{feedback}</p>
      ) : null}

      <section>
        <h2 className="text-base font-semibold text-zinc-900">
          In attesa ({pending.length})
        </h2>
        {pending.length === 0 ? (
          <p className="mt-2 text-sm text-zinc-600">Nessuna richiesta in attesa.</p>
        ) : (
          <ul className="mt-3 space-y-3">
            {pending.map((item) => (
              <li key={item.id} className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                <p className="text-sm font-semibold text-zinc-900">
                  {item.requester.fullName} → {item.athlete.fullName}
                </p>
                <p className="mt-1 text-xs text-zinc-600">
                  Richiedente: {item.requester.email} · {item.requester.phone}
                </p>
                <p className="text-xs text-zinc-600">
                  Atleta CF: {item.athlete.taxCode}
                </p>
                <p className="text-xs text-zinc-600">
                  Genitore principale: {item.primaryParent.fullName} ({item.primaryParent.email})
                </p>
                <p className="text-xs text-zinc-500">
                  Richiesta: {new Date(item.createdAt).toLocaleString("it-IT")}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={pendingId === item.id}
                    onClick={() => review(item.id, "APPROVE")}
                    className="rounded-lg bg-emerald-700 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-60"
                  >
                    Approva
                  </button>
                  <button
                    type="button"
                    disabled={pendingId === item.id}
                    onClick={() => review(item.id, "REJECT")}
                    className="rounded-lg border border-red-300 bg-white px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:opacity-60"
                  >
                    Rifiuta
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="text-base font-semibold text-zinc-900">Storico</h2>
        {others.length === 0 ? (
          <p className="mt-2 text-sm text-zinc-600">Nessuna richiesta gestita.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {others.map((item) => (
              <li key={item.id} className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm">
                <p className="font-semibold text-zinc-900">
                  {item.requester.fullName} → {item.athlete.fullName} ({STATUS_LABEL[item.status]})
                </p>
                <p className="text-xs text-zinc-500">
                  {new Date(item.createdAt).toLocaleString("it-IT")}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
