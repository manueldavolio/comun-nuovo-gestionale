"use client";

import { useEffect, useState } from "react";

type LinkRequestRow = {
  id: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  createdAt: string;
  reviewedAt: string | null;
  athleteLabel: string | null;
};

const STATUS_LABEL: Record<LinkRequestRow["status"], string> = {
  PENDING: "In attesa",
  APPROVED: "Approvata",
  REJECTED: "Rifiutata",
};

export function ParentAthleteLinkRequestForm() {
  const [taxCode, setTaxCode] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [pending, setPending] = useState(false);
  const [feedback, setFeedback] = useState<{ error?: string; ok?: string }>({});
  const [requests, setRequests] = useState<LinkRequestRow[]>([]);

  async function loadRequests() {
    try {
      const response = await fetch("/api/genitore/athlete-link-requests");
      const data = (await response.json().catch(() => null)) as
        | { data?: LinkRequestRow[]; error?: string }
        | null;
      if (response.ok && data?.data) {
        setRequests(data.data);
      }
    } catch {
      // Keep UI usable even if history fails.
    }
  }

  useEffect(() => {
    void loadRequests();
  }, []);

  async function submitRequest() {
    setFeedback({});
    setPending(true);
    try {
      const response = await fetch("/api/genitore/athlete-link-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          athleteTaxCode: taxCode,
          athleteBirthDate: birthDate,
        }),
      });
      const data = (await response.json().catch(() => null)) as
        | { error?: string; message?: string }
        | null;

      if (!response.ok) {
        setFeedback({ error: data?.error ?? "Invio richiesta non riuscito." });
        return;
      }

      setFeedback({ ok: data?.message ?? "Richiesta inviata correttamente." });
      setTaxCode("");
      setBirthDate("");
      await loadRequests();
    } catch {
      setFeedback({ error: "Errore imprevisto. Riprova." });
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-4">
      <section className="rounded-xl border border-blue-100 bg-white p-4 shadow-sm">
        <h2 className="text-lg font-semibold text-zinc-900">Associa un figlio già iscritto</h2>
        <p className="mt-1 text-sm text-zinc-600">
          Inserisci codice fiscale e data di nascita dell&apos;atleta. La richiesta sarà valutata dalla
          segreteria. Non verrà creata una nuova iscrizione.
        </p>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="block text-sm text-zinc-700">
            Codice fiscale atleta
            <input
              type="text"
              autoComplete="off"
              value={taxCode}
              onChange={(event) => setTaxCode(event.target.value)}
              className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm uppercase outline-none ring-blue-500 focus:ring-2"
            />
          </label>
          <label className="block text-sm text-zinc-700">
            Data di nascita
            <input
              type="date"
              value={birthDate}
              onChange={(event) => setBirthDate(event.target.value)}
              className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none ring-blue-500 focus:ring-2"
            />
          </label>
        </div>

        {feedback.error ? (
          <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {feedback.error}
          </p>
        ) : null}
        {feedback.ok ? (
          <p className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
            {feedback.ok}
          </p>
        ) : null}

        <button
          type="button"
          disabled={pending}
          onClick={submitRequest}
          className="mt-4 rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-800 disabled:opacity-60"
        >
          {pending ? "Invio..." : "Invia richiesta"}
        </button>
      </section>

      <section className="rounded-xl border border-blue-100 bg-white p-4 shadow-sm">
        <h3 className="text-base font-semibold text-zinc-900">Le tue richieste</h3>
        {requests.length === 0 ? (
          <p className="mt-2 text-sm text-zinc-600">Nessuna richiesta inviata.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {requests.map((request) => (
              <li
                key={request.id}
                className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-800"
              >
                <p className="font-semibold">
                  {request.athleteLabel ?? "Atleta"} — {STATUS_LABEL[request.status]}
                </p>
                <p className="text-xs text-zinc-500">
                  Inviata: {new Date(request.createdAt).toLocaleString("it-IT")}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
