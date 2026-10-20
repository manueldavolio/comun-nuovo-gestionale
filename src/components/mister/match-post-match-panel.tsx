"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { CompetitionKind, DisciplinarySanctionType } from "@prisma/client";
import { COMPETITION_KIND_LABEL } from "@/lib/competition-kind";
import { DISCIPLINARY_SANCTION_LABEL } from "@/lib/discipline";
import {
  MATCH_RATING_CRITERION_LABEL,
  MATCH_RATING_CRITERIA,
  averagePresentScores,
  type MatchRatingScores,
} from "@/lib/match-player-rating";

type AthleteOption = {
  id: string;
  firstName: string;
  lastName: string;
  isPresent: boolean;
};

type ExistingRating = MatchRatingScores & {
  athleteId: string;
  notes: string | null;
};

type ExistingCard = {
  id: string;
  athleteId: string;
  type: DisciplinarySanctionType;
  status: "ACTIVE" | "VOIDED";
};

type MatchPostMatchPanelProps = {
  eventId: string;
  competitionKind: CompetitionKind | null;
  seasonLabel: string | null;
  athletes: AthleteOption[];
  initialRatings: ExistingRating[];
  initialCards: ExistingCard[];
};

const CARD_TYPES: DisciplinarySanctionType[] = [
  "YELLOW_CARD",
  "RED_CARD",
  "SECOND_YELLOW_RED",
];

export function MatchPostMatchPanel({
  eventId,
  competitionKind,
  seasonLabel,
  athletes,
  initialRatings,
  initialCards,
}: MatchPostMatchPanelProps) {
  const router = useRouter();
  const presentAthletes = useMemo(
    () => athletes.filter((athlete) => athlete.isPresent),
    [athletes],
  );
  const [selectedId, setSelectedId] = useState(presentAthletes[0]?.id ?? "");
  const [cardType, setCardType] = useState<DisciplinarySanctionType>("YELLOW_CARD");
  const [scores, setScores] = useState<MatchRatingScores>({
    possessionScore: null,
    outOfPossessionScore: null,
    attitudeScore: null,
    teamworkScore: null,
  });
  const [notes, setNotes] = useState("");
  const [pending, setPending] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const selected = presentAthletes.find((athlete) => athlete.id === selectedId) ?? null;
  const selectedCards = initialCards.filter(
    (card) => card.athleteId === selectedId && card.status === "ACTIVE",
  );
  const matchAverage = averagePresentScores(scores);

  function loadAthlete(athleteId: string) {
    setSelectedId(athleteId);
    const rating = initialRatings.find((row) => row.athleteId === athleteId);
    setScores({
      possessionScore: rating?.possessionScore ?? null,
      outOfPossessionScore: rating?.outOfPossessionScore ?? null,
      attitudeScore: rating?.attitudeScore ?? null,
      teamworkScore: rating?.teamworkScore ?? null,
    });
    setNotes(rating?.notes ?? "");
    setFeedback(null);
    setError(null);
  }

  async function saveCard() {
    if (!selected || !competitionKind) {
      setError("Competizione evento mancante: aggiorna l'evento o applica la migration.");
      return;
    }
    setPending(true);
    setError(null);
    setFeedback(null);
    try {
      const response = await fetch("/api/mister/discipline/incidents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          athleteId: selected.id,
          eventId,
          type: cardType,
          competitionKind,
          seasonLabel,
        }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(payload.error ?? "Salvataggio cartellino non riuscito.");
        return;
      }
      setFeedback("Cartellino registrato.");
      router.refresh();
    } catch {
      setError("Errore di rete.");
    } finally {
      setPending(false);
    }
  }

  async function saveRatings() {
    if (!selected) return;
    setPending(true);
    setError(null);
    setFeedback(null);
    try {
      const response = await fetch(
        `/api/mister/events/${eventId}/ratings/${selected.id}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...scores, notes }),
        },
      );
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(payload.error ?? "Salvataggio voti non riuscito.");
        return;
      }
      setFeedback("Valutazione salvata.");
      router.refresh();
    } catch {
      setError("Errore di rete.");
    } finally {
      setPending(false);
    }
  }

  if (presentAthletes.length === 0) {
    return (
      <section className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
        <h2 className="text-base font-bold text-zinc-900">Disciplina e valutazioni</h2>
        <p className="mt-2 text-sm text-zinc-600">
          Segna almeno un presente per registrare cartellini e voti.
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-blue-100 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-base font-bold text-zinc-900">Disciplina e valutazioni</h2>
          <p className="mt-0.5 text-xs text-zinc-600">
            Postpartita ·{" "}
            {competitionKind
              ? COMPETITION_KIND_LABEL[competitionKind]
              : "competizione non impostata"}
          </p>
        </div>
      </div>

      <label className="mt-3 block text-xs font-semibold uppercase tracking-wide text-zinc-500">
        Giocatore
        <select
          className="mt-1 w-full rounded-xl border border-blue-200 bg-white px-3 py-3 text-sm font-semibold text-zinc-900"
          value={selectedId}
          onChange={(event) => loadAthlete(event.target.value)}
        >
          {presentAthletes.map((athlete) => (
            <option key={athlete.id} value={athlete.id}>
              {athlete.lastName} {athlete.firstName}
            </option>
          ))}
        </select>
      </label>

      {selectedCards.length > 0 ? (
        <ul className="mt-3 space-y-1">
          {selectedCards.map((card) => (
            <li
              key={card.id}
              className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-950"
            >
              {DISCIPLINARY_SANCTION_LABEL[card.type]}
            </li>
          ))}
        </ul>
      ) : null}

      <div className="mt-4 rounded-xl border border-amber-100 bg-amber-50/60 p-3">
        <p className="text-xs font-bold uppercase tracking-wide text-amber-900">Cartellino</p>
        <div className="mt-2 grid gap-2 sm:grid-cols-3">
          {CARD_TYPES.map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => setCardType(type)}
              className={`rounded-xl border px-3 py-2.5 text-left text-xs font-semibold ${
                cardType === type
                  ? "border-amber-400 bg-amber-200 text-amber-950"
                  : "border-amber-200 bg-white text-amber-900"
              }`}
            >
              {DISCIPLINARY_SANCTION_LABEL[type]}
            </button>
          ))}
        </div>
        <button
          type="button"
          disabled={pending || !competitionKind}
          onClick={() => void saveCard()}
          className="mt-3 inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-amber-600 px-4 text-sm font-bold text-white hover:bg-amber-700 disabled:opacity-60"
        >
          Registra cartellino
        </button>
        <p className="mt-2 text-[11px] text-amber-800">
          Nessuna squalifica automatica: le giornate si assegnano dopo il comunicato.
        </p>
      </div>

      <div className="mt-4 rounded-xl border border-blue-100 bg-sky-50/50 p-3">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-bold uppercase tracking-wide text-blue-900">
            Valutazioni (1–10)
          </p>
          {matchAverage != null ? (
            <span className="rounded-full bg-blue-800 px-2.5 py-1 text-xs font-bold text-white">
              Media {matchAverage}
            </span>
          ) : null}
        </div>
        <div className="mt-3 grid gap-3">
          {MATCH_RATING_CRITERIA.map((key) => (
            <label key={key} className="block text-xs font-semibold text-zinc-700">
              {MATCH_RATING_CRITERION_LABEL[key]}
              <select
                className="mt-1 w-full rounded-xl border border-blue-200 bg-white px-3 py-3 text-sm font-semibold"
                value={scores[key] ?? ""}
                onChange={(event) => {
                  const raw = event.target.value;
                  setScores((prev) => ({
                    ...prev,
                    [key]: raw === "" ? null : Number(raw),
                  }));
                }}
              >
                <option value="">Non valutato</option>
                {Array.from({ length: 10 }, (_, index) => index + 1).map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </label>
          ))}
        </div>
        <label className="mt-3 block text-xs font-semibold text-zinc-700">
          Nota (opzionale)
          <textarea
            className="mt-1 min-h-20 w-full rounded-xl border border-blue-200 bg-white px-3 py-2 text-sm"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            maxLength={500}
          />
        </label>
        <button
          type="button"
          disabled={pending}
          onClick={() => void saveRatings()}
          className="mt-3 inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-blue-800 px-4 text-sm font-bold text-white hover:bg-blue-900 disabled:opacity-60"
        >
          Salva valutazione
        </button>
        <p className="mt-2 text-[11px] text-zinc-500">
          I voti sono riservati allo staff. Non vengono mostrati ai genitori.
        </p>
      </div>

      {error ? (
        <p className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      ) : null}
      {feedback ? (
        <p className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          {feedback}
        </p>
      ) : null}
    </section>
  );
}
