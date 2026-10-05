"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type SlipEventRow = {
  slipEventId: string;
  categoryName: string;
  homeLabel: string;
  awayLabel: string;
  choice: "HOME" | "DRAW" | "AWAY" | null;
  pickEvaluation: "CORRECT" | "WRONG" | "PENDING" | null;
  outcome: "HOME" | "DRAW" | "AWAY" | "PENDING";
  outcomeLabel: string;
  choiceLabel: string | null;
};

type PredictionSlipPlayerProps = {
  slipId: string;
  prizeText: string;
  title: string;
  lockState: "OPEN" | "LOCKED";
  effectiveClosesAtLabel: string;
  initialEvents: SlipEventRow[];
  hasEntry: boolean;
  evaluation: {
    correct: number;
    wrong: number;
    pending: number;
    total: number;
    perfect: boolean;
    evaluable: boolean;
  } | null;
};

const CHOICES: Array<{ value: "HOME" | "DRAW" | "AWAY"; label: string }> = [
  { value: "HOME", label: "1" },
  { value: "DRAW", label: "X" },
  { value: "AWAY", label: "2" },
];

export function PredictionSlipPlayer({
  slipId,
  prizeText,
  title,
  lockState,
  effectiveClosesAtLabel,
  initialEvents,
  hasEntry,
  evaluation,
}: PredictionSlipPlayerProps) {
  const router = useRouter();
  const [choices, setChoices] = useState<Record<string, "HOME" | "DRAW" | "AWAY" | null>>(
    () =>
      Object.fromEntries(initialEvents.map((event) => [event.slipEventId, event.choice])),
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const complete = useMemo(
    () => initialEvents.every((event) => Boolean(choices[event.slipEventId])),
    [choices, initialEvents],
  );

  const readOnly = lockState === "LOCKED";

  async function onSubmit() {
    if (readOnly || !complete) return;
    setSaving(true);
    setError(null);
    setOk(null);

    try {
      const response = await fetch(`/api/genitore/prediction-slips/${slipId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          picks: initialEvents.map((event) => ({
            slipEventId: event.slipEventId,
            choice: choices[event.slipEventId],
          })),
        }),
      });
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        setError(payload?.error ?? "Salvataggio non riuscito.");
        setSaving(false);
        return;
      }
      setOk("Schedina salvata correttamente.");
      router.refresh();
    } catch {
      setError("Errore di rete. Riprova.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4 pb-28">
      <header className="rounded-2xl border border-blue-100 bg-white p-4 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wide text-blue-800">
          Schedina Comun Nuovo
        </p>
        <h1 className="mt-1 text-xl font-bold text-zinc-900">{title}</h1>
        <p className="mt-1 text-sm font-medium text-blue-900">1 · X · 2 — Indovinale tutte e vinci!</p>
        <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
          Premio: {prizeText}
        </p>
        {!readOnly ? (
          <p className="mt-2 text-xs text-zinc-600">
            Puoi modificarla fino a {effectiveClosesAtLabel}
          </p>
        ) : (
          <p className="mt-2 text-xs font-semibold text-zinc-700">Pronostici chiusi</p>
        )}
      </header>

      {evaluation && hasEntry ? (
        <section className="rounded-2xl border border-blue-100 bg-white p-4 shadow-sm">
          {evaluation.perfect ? (
            <div>
              <p className="text-lg font-bold text-emerald-800">SCHEDINA PERFETTA!</p>
              <p className="text-sm text-emerald-700">
                {evaluation.correct}/{evaluation.total}
              </p>
              <p className="mt-1 text-sm text-zinc-700">
                Complimenti! Hai indovinato tutti i risultati.
              </p>
              <p className="mt-2 text-sm font-medium text-amber-900">Premio: {prizeText}</p>
            </div>
          ) : (
            <p className="text-sm font-semibold text-zinc-900">
              {evaluation.correct}/{evaluation.total} corretti
              {evaluation.wrong > 0 ? ` · ${evaluation.wrong} errati` : ""}
              {evaluation.pending > 0 ? ` · ${evaluation.pending} in attesa` : ""}
            </p>
          )}
        </section>
      ) : null}

      <p className="text-xs text-zinc-600">
        Legenda: <strong>1</strong> = vittoria casa · <strong>X</strong> = pareggio ·{" "}
        <strong>2</strong> = vittoria ospite
      </p>

      <ul className="space-y-3">
        {initialEvents.map((event) => {
          const selected = choices[event.slipEventId] ?? null;
          return (
            <li
              key={event.slipEventId}
              className="rounded-2xl border border-blue-100 bg-white p-4 shadow-sm"
            >
              <p className="text-xs font-semibold uppercase tracking-wide text-blue-800">
                {event.categoryName}
              </p>
              <p className="mt-1 text-base font-bold text-zinc-900">{event.homeLabel}</p>
              <p className="text-xs font-semibold text-zinc-500">vs</p>
              <p className="text-base font-bold text-zinc-900">{event.awayLabel}</p>

              {!readOnly ? (
                <div className="mt-3 grid grid-cols-3 gap-2">
                  {CHOICES.map((choice) => {
                    const active = selected === choice.value;
                    return (
                      <button
                        key={choice.value}
                        type="button"
                        onClick={() =>
                          setChoices((prev) => ({
                            ...prev,
                            [event.slipEventId]: choice.value,
                          }))
                        }
                        className={[
                          "inline-flex min-h-11 items-center justify-center rounded-xl border text-base font-bold transition",
                          active
                            ? "border-blue-700 bg-blue-700 text-white"
                            : "border-blue-200 bg-sky-50 text-blue-900 hover:bg-sky-100",
                        ].join(" ")}
                      >
                        {choice.label}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="mt-3 space-y-1 text-sm">
                  <p>
                    Il tuo pronostico:{" "}
                    <strong>{event.choiceLabel ?? "—"}</strong>
                  </p>
                  {event.pickEvaluation === "CORRECT" ? (
                    <p className="font-semibold text-emerald-700">CORRETTO</p>
                  ) : null}
                  {event.pickEvaluation === "WRONG" ? (
                    <p className="font-semibold text-red-700">
                      ERRATO · Risultato: {event.outcomeLabel}
                    </p>
                  ) : null}
                  {event.pickEvaluation === "PENDING" || event.outcome === "PENDING" ? (
                    <p className="font-semibold text-amber-700">RISULTATO IN ATTESA</p>
                  ) : null}
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {error ? <p className="text-sm text-red-700">{error}</p> : null}
      {ok ? <p className="text-sm text-emerald-700">{ok}</p> : null}

      {!readOnly ? (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-blue-100 bg-white/95 p-3 backdrop-blur md:static md:border-0 md:bg-transparent md:p-0">
          <button
            type="button"
            disabled={!complete || saving}
            onClick={onSubmit}
            className="inline-flex w-full min-h-12 items-center justify-center rounded-2xl bg-blue-700 px-4 text-sm font-bold uppercase tracking-wide text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50 md:w-auto md:px-6"
          >
            {saving
              ? "Salvataggio…"
              : hasEntry
                ? "Salva modifiche"
                : "Conferma schedina"}
          </button>
        </div>
      ) : null}
    </div>
  );
}
