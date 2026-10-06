"use client";

import { useState } from "react";
import {
  OPERATIONAL_STATUS_LABEL,
  OPERATIONAL_STATUS_NOTE_MAX,
  OPERATIONAL_STATUS_TYPES,
  operationalStatusPillClass,
  type OperationalStatusType,
  validUntilDateInputValue,
} from "@/lib/athlete-operational-status";
import { nowAsEuropeRomeWallClockUtc, toDateInputValueUTC } from "@/lib/date-input";

type OperationalStatusEditorProps = {
  athleteId: string;
  athleteName: string;
  initialStatus: OperationalStatusType;
  initialNote: string | null;
  initialValidUntil: string | null;
  onSaved?: (next: {
    status: OperationalStatusType;
    note: string | null;
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

export function OperationalStatusEditor({
  athleteId,
  athleteName,
  initialStatus,
  initialNote,
  initialValidUntil,
  onSaved,
}: OperationalStatusEditorProps) {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<OperationalStatusType>(initialStatus);
  const [note, setNote] = useState(initialNote ?? "");
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
          status,
          note: note.trim() || null,
          validUntilDate: status === "AVAILABLE" ? null : validUntilDate || null,
        }),
      });
      const data = (await response.json().catch(() => null)) as {
        error?: string;
        status?: OperationalStatusType;
        note?: string | null;
        validUntil?: string | Date | null;
      } | null;
      if (!response.ok) {
        setFeedback(data?.error ?? "Salvataggio non riuscito.");
        return;
      }
      const nextStatus = data?.status ?? status;
      const nextNote = data?.note ?? null;
      const nextValid =
        data?.validUntil != null
          ? validUntilDateInputValue(new Date(data.validUntil))
          : null;
      setStatus(nextStatus);
      setNote(nextNote ?? "");
      setValidUntilDate(nextValid ?? "");
      onSaved?.({
        status: nextStatus,
        note: nextNote,
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

  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className={`inline-flex min-h-11 items-center rounded-full border px-3 text-xs font-bold ${operationalStatusPillClass(status)}`}
        aria-label={`Disponibilità di ${athleteName}`}
      >
        {OPERATIONAL_STATUS_LABEL[status]}
      </button>

      {open ? (
        <div className="mt-3 rounded-2xl border border-blue-100 bg-white p-3 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-wide text-blue-900">Stato</p>
          <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {OPERATIONAL_STATUS_TYPES.map((option) => {
              const active = status === option;
              return (
                <button
                  key={option}
                  type="button"
                  onClick={() => setStatus(option)}
                  className={`min-h-11 rounded-xl border px-2 text-xs font-bold ${
                    active
                      ? `${operationalStatusPillClass(option)} ring-2 ring-blue-500`
                      : "border-zinc-200 bg-white text-zinc-700"
                  }`}
                >
                  {OPERATIONAL_STATUS_LABEL[option]}
                </button>
              );
            })}
          </div>

          {status !== "AVAILABLE" ? (
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

              <label className="mt-3 block text-xs font-medium text-zinc-700">
                Nota organizzativa — non inserire informazioni mediche.
                <textarea
                  value={note}
                  maxLength={OPERATIONAL_STATUS_NOTE_MAX}
                  rows={2}
                  onChange={(event) => setNote(event.target.value)}
                  placeholder="Es. Non disponibile martedì"
                  className="mt-1 block w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm outline-none ring-blue-500 focus:ring-2"
                />
              </label>
            </>
          ) : (
            <p className="mt-3 text-xs text-zinc-600">
              Segnando Disponibile lo stato operativo viene azzerato.
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
