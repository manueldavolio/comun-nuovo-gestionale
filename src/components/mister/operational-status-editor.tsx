"use client";

import { useState } from "react";
import {
  PARTICIPATION_CAN_LABEL,
  PARTICIPATION_CANNOT_LABEL,
} from "@/lib/health-data-access";
import { validUntilDateInputValue } from "@/lib/athlete-operational-status";
import { nowAsEuropeRomeWallClockUtc, toDateInputValueUTC } from "@/lib/date-input";

type OperationalStatusEditorProps = {
  athleteId: string;
  athleteName: string;
  /** Solo partecipazione: true = può, false = non può. */
  initialCanParticipate: boolean;
  initialValidUntil: string | null;
  onSaved?: (next: {
    canParticipate: boolean;
    validUntilDate: string | null;
  }) => void;
};

function dateInputFromOffset(dayOffset: number): string {
  const wallNow = nowAsEuropeRomeWallClockUtc();
  const day = new Date(
    Date.UTC(
      wallNow.getUTCFullYear(),
      wallNow.getUTCMonth(),
      wallNow.getUTCDate() + dayOffset,
      12,
      0,
      0,
      0,
    ),
  );
  return toDateInputValueUTC(day);
}

function pillClass(canParticipate: boolean): string {
  return canParticipate
    ? "border-emerald-200 bg-emerald-50 text-emerald-900"
    : "border-slate-200 bg-slate-100 text-slate-800";
}

export function OperationalStatusEditor({
  athleteId,
  athleteName,
  initialCanParticipate,
  initialValidUntil,
  onSaved,
}: OperationalStatusEditorProps) {
  const [open, setOpen] = useState(false);
  const [canParticipate, setCanParticipate] = useState(initialCanParticipate);
  const [validUntilDate, setValidUntilDate] = useState(initialValidUntil ?? "");
  const [pending, setPending] = useState(false);
  const [feedback, setFeedback] = useState("");

  async function save() {
    setPending(true);
    setFeedback("");
    try {
      const response = await fetch(`/api/mister/athletes/${athleteId}/operational-status`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: canParticipate ? "AVAILABLE" : "ABSENT",
          note: null,
          validUntilDate: canParticipate ? null : validUntilDate || null,
        }),
      });
      const data = (await response.json().catch(() => null)) as {
        error?: string;
        canParticipate?: boolean;
        validUntil?: string | Date | null;
      } | null;
      if (!response.ok) {
        setFeedback(data?.error ?? "Salvataggio non riuscito.");
        return;
      }
      const nextCan = data?.canParticipate ?? canParticipate;
      const nextValid =
        !nextCan && data?.validUntil != null
          ? validUntilDateInputValue(new Date(data.validUntil))
          : null;
      setCanParticipate(nextCan);
      setValidUntilDate(nextValid ?? "");
      onSaved?.({
        canParticipate: nextCan,
        validUntilDate: nextValid,
      });
      setOpen(false);
      setFeedback("Disponibilità aggiornata.");
    } catch {
      setFeedback("Errore imprevisto.");
    } finally {
      setPending(false);
    }
  }

  const label = canParticipate ? PARTICIPATION_CAN_LABEL : PARTICIPATION_CANNOT_LABEL;

  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className={`inline-flex min-h-11 items-center rounded-full border px-3 text-xs font-bold ${pillClass(canParticipate)}`}
        aria-label={`Partecipazione di ${athleteName}`}
      >
        {label}
      </button>

      {open ? (
        <div className="mt-3 rounded-2xl border border-blue-100 bg-white p-3 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-wide text-blue-900">
            Stato operativo
          </p>
          <p className="mt-1 text-[11px] text-zinc-500">
            Nessuna informazione sanitaria: solo se l&apos;atleta può partecipare o meno.
          </p>
          <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
            {(
              [
                { value: true, text: PARTICIPATION_CAN_LABEL },
                { value: false, text: PARTICIPATION_CANNOT_LABEL },
              ] as const
            ).map((option) => {
              const active = canParticipate === option.value;
              return (
                <button
                  key={option.text}
                  type="button"
                  onClick={() => setCanParticipate(option.value)}
                  className={`min-h-11 rounded-xl border px-2 text-xs font-bold ${
                    active
                      ? `${pillClass(option.value)} ring-2 ring-blue-500`
                      : "border-zinc-200 bg-white text-zinc-700"
                  }`}
                >
                  {option.text}
                </button>
              );
            })}
          </div>

          {!canParticipate ? (
            <>
              <p className="mt-4 text-xs font-bold uppercase tracking-wide text-blue-900">
                Fino a
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setValidUntilDate(dateInputFromOffset(0))}
                  className="min-h-11 rounded-xl border border-zinc-200 bg-white px-3 text-xs font-bold text-zinc-700"
                >
                  Oggi
                </button>
                <button
                  type="button"
                  onClick={() => setValidUntilDate(dateInputFromOffset(1))}
                  className="min-h-11 rounded-xl border border-zinc-200 bg-white px-3 text-xs font-bold text-zinc-700"
                >
                  Domani
                </button>
                <button
                  type="button"
                  onClick={() => setValidUntilDate("")}
                  className="min-h-11 rounded-xl border border-zinc-200 bg-white px-3 text-xs font-bold text-zinc-700"
                >
                  Senza scadenza
                </button>
              </div>
              <label className="mt-2 block text-xs font-medium text-zinc-700">
                Data personalizzata
                <input
                  type="date"
                  value={validUntilDate}
                  onChange={(event) => setValidUntilDate(event.target.value)}
                  className="mt-1 block min-h-11 w-full rounded-xl border border-zinc-300 px-3 text-sm outline-none ring-blue-500 focus:ring-2"
                />
              </label>
            </>
          ) : (
            <p className="mt-3 text-xs text-zinc-600">
              Segnando «Può partecipare» lo stato operativo viene azzerato.
            </p>
          )}

          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={pending}
              onClick={() => void save()}
              className="min-h-11 rounded-xl bg-blue-800 px-4 text-sm font-bold text-white disabled:opacity-60"
            >
              Salva
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="min-h-11 rounded-xl border border-zinc-200 bg-white px-4 text-sm font-bold text-zinc-700"
            >
              Chiudi
            </button>
          </div>
          {feedback ? <p className="mt-2 text-xs font-semibold text-zinc-600">{feedback}</p> : null}
        </div>
      ) : null}
    </div>
  );
}
