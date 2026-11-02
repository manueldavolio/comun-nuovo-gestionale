"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

export type MediaReviewAthleteOption = {
  id: string;
  label: string;
  consentGranted: boolean;
  consentSource: "event" | "enrollment" | "none";
};

export type MediaReviewItem = {
  id: string;
  title: string;
  mediaType: string;
  categoryId: string;
  categoryName: string;
  reviewStatus: "DRAFT" | "READY" | "NEEDS_REVIEW" | "BLOCKED_CONSENT";
  subjectsDeclaredComplete: boolean;
  publishedAt: string | null;
  mediaUrl: string | null;
  filePath: string | null;
  selectedAthleteIds: string[];
  athletes: MediaReviewAthleteOption[];
};

function statusLabel(status: MediaReviewItem["reviewStatus"]) {
  switch (status) {
    case "READY":
      return "Pronto / pubblicabile";
    case "BLOCKED_CONSENT":
      return "Bloccato: consenso mancante o revocato";
    case "DRAFT":
      return "Bozza";
    default:
      return "In revisione";
  }
}

export function MediaReviewPanel({ items }: { items: MediaReviewItem[] }) {
  const router = useRouter();
  const [drafts, setDrafts] = useState<Record<string, { selected: string[]; complete: boolean }>>(
    () =>
      Object.fromEntries(
        items.map((item) => [
          item.id,
          {
            selected: item.selectedAthleteIds,
            complete: item.subjectsDeclaredComplete,
          },
        ]),
      ),
  );
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reviewQueue = useMemo(
    () =>
      items.filter(
        (item) =>
          item.reviewStatus === "NEEDS_REVIEW" ||
          item.reviewStatus === "BLOCKED_CONSENT" ||
          !item.publishedAt,
      ),
    [items],
  );

  async function saveItem(item: MediaReviewItem, publish: boolean) {
    const draft = drafts[item.id] ?? { selected: [], complete: false };
    setPendingId(item.id);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch(`/api/admin/media/${item.id}/subjects`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subjectAthleteIds: draft.selected,
          subjectsDeclaredComplete: draft.complete,
          publish,
        }),
      });
      const body = (await response.json().catch(() => null)) as {
        error?: string;
        missingConsentCount?: number;
        data?: { reviewStatus?: string };
      } | null;
      if (!response.ok) {
        setError(body?.error ?? "Operazione non riuscita.");
        return;
      }
      setMessage(
        publish
          ? "Pubblicazione verso i genitori confermata."
          : `Salvataggio revisione ok (${body?.data?.reviewStatus ?? "aggiornato"}).`,
      );
      router.refresh();
    } catch {
      setError("Errore di rete. Riprova.");
    } finally {
      setPendingId(null);
    }
  }

  function toggleAthlete(mediaId: string, athleteId: string) {
    setDrafts((prev) => {
      const current = prev[mediaId] ?? { selected: [], complete: false };
      const exists = current.selected.includes(athleteId);
      return {
        ...prev,
        [mediaId]: {
          ...current,
          selected: exists
            ? current.selected.filter((id) => id !== athleteId)
            : [...current.selected, athleteId],
        },
      };
    });
  }

  if (items.length === 0) {
    return (
      <p className="rounded-xl border border-zinc-200 bg-white p-4 text-sm text-zinc-700">
        Nessun media da gestire.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <section className="rounded-xl border border-amber-200 bg-amber-50 p-4 shadow-sm">
        <h2 className="text-lg font-semibold text-zinc-900">Coda revisione foto/video</h2>
        <p className="mt-1 text-sm text-zinc-700">
          In coda (da revisionare, bloccati o non ancora pubblicati ai genitori):{" "}
          <strong>{reviewQueue.length}</strong>. I media storici restano disponibili qui per la
          revisione; non sono cancellati.
        </p>
      </section>

      {error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      ) : null}
      {message ? (
        <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          {message}
        </p>
      ) : null}

      <ul className="space-y-4">
        {items.map((item) => {
          const draft = drafts[item.id] ?? {
            selected: item.selectedAthleteIds,
            complete: item.subjectsDeclaredComplete,
          };
          const selectedAthletes = item.athletes.filter((athlete) =>
            draft.selected.includes(athlete.id),
          );
          const missingConsent = selectedAthletes.filter((athlete) => !athlete.consentGranted);
          const canPublish =
            draft.complete &&
            draft.selected.length > 0 &&
            missingConsent.length === 0;

          return (
            <li
              key={item.id}
              className="rounded-xl border border-blue-100 bg-white p-4 shadow-sm"
            >
              <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h3 className="text-base font-semibold text-zinc-900">{item.title}</h3>
                  <p className="text-sm text-zinc-600">
                    {item.categoryName} · {item.mediaType} · {statusLabel(item.reviewStatus)}
                  </p>
                  <p className="text-xs text-zinc-500">
                    Pubblicazione genitori:{" "}
                    {item.publishedAt && item.reviewStatus === "READY"
                      ? new Date(item.publishedAt).toLocaleString("it-IT")
                      : "non attiva"}
                  </p>
                </div>
                {(item.mediaUrl || item.filePath) && (
                  <a
                    href={item.mediaUrl || item.filePath || "#"}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm font-semibold text-blue-700 underline"
                  >
                    Apri media
                  </a>
                )}
              </div>

              <div className="mt-3 rounded-lg border border-zinc-200 bg-zinc-50 p-3">
                <p className="text-sm font-medium text-zinc-800">
                  Atleti riconoscibili (non tutta la categoria)
                </p>
                <p className="mt-1 text-xs text-zinc-600">
                  Seleziona solo i soggetti identificabili. Se non sei sicuro, lascia la
                  dichiarazione incompleta: il contenuto resta in revisione e non va ai genitori.
                </p>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {item.athletes.map((athlete) => {
                    const checked = draft.selected.includes(athlete.id);
                    return (
                      <label
                        key={athlete.id}
                        className="flex items-start gap-2 rounded-lg border border-zinc-200 bg-white p-2 text-sm"
                      >
                        <input
                          type="checkbox"
                          className="mt-1"
                          checked={checked}
                          onChange={() => toggleAthlete(item.id, athlete.id)}
                        />
                        <span>
                          <span className="font-medium text-zinc-900">{athlete.label}</span>
                          <span className="mt-0.5 block text-xs text-zinc-600">
                            Consenso immagini:{" "}
                            {athlete.consentGranted ? (
                              <span className="font-semibold text-emerald-700">presente</span>
                            ) : (
                              <span className="font-semibold text-red-700">
                                mancante o revocato
                              </span>
                            )}
                            {athlete.consentSource === "enrollment"
                              ? " (da iscrizione)"
                              : athlete.consentSource === "event"
                                ? " (aggiornato)"
                                : ""}
                          </span>
                        </span>
                      </label>
                    );
                  })}
                </div>

                <label className="mt-3 flex items-start gap-2 text-sm text-zinc-800">
                  <input
                    type="checkbox"
                    className="mt-1"
                    checked={draft.complete}
                    onChange={(event) =>
                      setDrafts((prev) => ({
                        ...prev,
                        [item.id]: {
                          ...(prev[item.id] ?? { selected: [], complete: false }),
                          complete: event.target.checked,
                        },
                      }))
                    }
                  />
                  <span>
                    Dichiaro che l&apos;elenco selezionato include tutti i soggetti identificabili
                    in questo media (obbligatorio per pubblicare).
                  </span>
                </label>

                {missingConsent.length > 0 ? (
                  <p className="mt-2 rounded-md border border-red-200 bg-red-50 px-2 py-1.5 text-xs text-red-800">
                    Consensi mancanti/revocati: {missingConsent.map((a) => a.label).join(", ")}.
                    Pubblicazione genitori non consentita.
                  </p>
                ) : null}
                {!draft.complete ? (
                  <p className="mt-2 rounded-md border border-amber-200 bg-amber-50 px-2 py-1.5 text-xs text-amber-900">
                    Dichiarazione incompleta: gestione prudente — il media resta in revisione
                    admin e non è visibile ai genitori.
                  </p>
                ) : null}
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={pendingId === item.id}
                  onClick={() => saveItem(item, false)}
                  className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-semibold text-zinc-800 hover:bg-zinc-50 disabled:opacity-50"
                >
                  Salva revisione
                </button>
                <button
                  type="button"
                  disabled={pendingId === item.id || !canPublish}
                  onClick={() => saveItem(item, true)}
                  className="rounded-lg bg-blue-700 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Approva pubblicazione genitori
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
