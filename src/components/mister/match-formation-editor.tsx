"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  formatPlayersPerSideLabel,
  type PlayersPerSide,
} from "@/lib/category-format";
import {
  buildStarterSlotsForModule,
  emptyCustomStarterSlots,
  formationModuleOptionsForPlayersPerSide,
  isFormationModuleId,
  isModuleCompatibleWithPlayersPerSide,
  nextBenchSlotKey,
  nextCustomStarterSlotKey,
  pitchLinesForModule,
  type FormationModuleId,
} from "@/lib/match-formation";
import { athleteInitials } from "@/lib/parent-season";

export type FormationAthleteOption = {
  id: string;
  firstName: string;
  lastName: string;
  position: string | null;
  shirtNumber: number | null;
  operationalLabel: string;
  inConvocation: boolean | null;
  notInConvocationWarning: string | null;
};

type SlotDraft = {
  slotKey: string;
  athleteId: string | null;
  isBench: boolean;
};

type MatchFormationEditorProps = {
  eventId: string;
  eventTitle: string;
  opponentName: string | null;
  categoryName: string | null;
  playersPerSide: PlayersPerSide;
  backHref: string;
  hasConvocation: boolean;
  pool: FormationAthleteOption[];
  roster: FormationAthleteOption[];
  initialModule: FormationModuleId;
  initialSlots: SlotDraft[];
  /** true se il modulo salvato non è più compatibile col formato categoria */
  savedModuleIncompatible: boolean;
};

function slotsForModule(
  module: FormationModuleId,
  previous: SlotDraft[],
  playersPerSide: PlayersPerSide,
): SlotDraft[] {
  if (module === "CUSTOM") {
    const customs = previous.filter((s) => !s.isBench && s.slotKey.startsWith("CUSTOM_"));
    const bench = previous.filter((s) => s.isBench);
    if (customs.length === 0) {
      return [...emptyCustomStarterSlots(playersPerSide), ...bench];
    }
    return [...customs, ...bench];
  }
  const templates = buildStarterSlotsForModule(module);
  const prevByKey = new Map(previous.map((s) => [s.slotKey, s.athleteId]));
  const starters: SlotDraft[] = templates.map((t) => ({
    slotKey: t.slotKey,
    athleteId: prevByKey.get(t.slotKey) ?? null,
    isBench: false,
  }));
  const bench = previous.filter((s) => s.isBench);
  const used = new Set<string>();
  for (const slot of starters) {
    if (slot.athleteId) {
      if (used.has(slot.athleteId)) slot.athleteId = null;
      else used.add(slot.athleteId);
    }
  }
  for (const slot of bench) {
    if (slot.athleteId && used.has(slot.athleteId)) slot.athleteId = null;
    else if (slot.athleteId) used.add(slot.athleteId);
  }
  return [...starters, ...bench];
}

export function MatchFormationEditor({
  eventId,
  eventTitle,
  opponentName,
  categoryName,
  playersPerSide,
  backHref,
  hasConvocation,
  pool,
  roster,
  initialModule,
  initialSlots,
  savedModuleIncompatible,
}: MatchFormationEditorProps) {
  const moduleOptions = formationModuleOptionsForPlayersPerSide(playersPerSide);
  const initialCompatible = isModuleCompatibleWithPlayersPerSide(
    initialModule,
    playersPerSide,
  );

  const [module, setModule] = useState<FormationModuleId | "">(
    initialCompatible ? initialModule : "",
  );
  const [slots, setSlots] = useState<SlotDraft[]>(initialSlots);
  const [pending, setPending] = useState(false);
  const [feedback, setFeedback] = useState<{ error?: string; ok?: string }>({});
  const [hasChosenModule, setHasChosenModule] = useState(initialCompatible);

  const athleteById = useMemo(() => {
    const map = new Map<string, FormationAthleteOption>();
    for (const a of roster) map.set(a.id, a);
    for (const a of pool) map.set(a.id, a);
    return map;
  }, [pool, roster]);

  const selectPool = useMemo(() => {
    const byId = new Map<string, FormationAthleteOption>();
    for (const a of pool) byId.set(a.id, a);
    for (const a of roster) {
      if (!byId.has(a.id)) byId.set(a.id, a);
    }
    return [...byId.values()];
  }, [pool, roster]);

  const usedAthleteIds = useMemo(() => {
    const set = new Set<string>();
    for (const slot of slots) {
      if (slot.athleteId) set.add(slot.athleteId);
    }
    return set;
  }, [slots]);

  const activeModule: FormationModuleId | null =
    module && isFormationModuleId(module) ? module : null;
  const pitchLines = useMemo(
    () => (activeModule && activeModule !== "CUSTOM" ? pitchLinesForModule(activeModule) : []),
    [activeModule],
  );

  const starterCount = slots.filter((s) => !s.isBench).length;
  const formatLabel = formatPlayersPerSideLabel(playersPerSide);
  const needsModuleChoice = savedModuleIncompatible || !hasChosenModule || !activeModule;

  function setModuleAndRebuild(next: FormationModuleId) {
    setModule(next);
    setHasChosenModule(true);
    setSlots((prev) => slotsForModule(next, prev, playersPerSide));
    setFeedback({});
  }

  function assignSlot(slotKey: string, athleteId: string | null) {
    setSlots((prev) =>
      prev.map((slot) => {
        if (slot.slotKey === slotKey) return { ...slot, athleteId };
        if (athleteId && slot.athleteId === athleteId) {
          return { ...slot, athleteId: null };
        }
        return slot;
      }),
    );
  }

  function addBench() {
    setSlots((prev) => [
      ...prev,
      {
        slotKey: nextBenchSlotKey(prev.map((s) => s.slotKey)),
        athleteId: null,
        isBench: true,
      },
    ]);
  }

  function addCustomStarter() {
    setSlots((prev) => {
      const starters = prev.filter((s) => !s.isBench);
      const bench = prev.filter((s) => s.isBench);
      return [
        ...starters,
        {
          slotKey: nextCustomStarterSlotKey(prev.map((s) => s.slotKey)),
          athleteId: null,
          isBench: false,
        },
        ...bench,
      ];
    });
  }

  function removeSlot(slotKey: string) {
    setSlots((prev) => prev.filter((s) => s.slotKey !== slotKey));
  }

  async function save() {
    if (!activeModule || !isModuleCompatibleWithPlayersPerSide(activeModule, playersPerSide)) {
      setFeedback({
        error: `Scegli un modulo compatibile con ${formatLabel} prima di salvare.`,
      });
      return;
    }
    setPending(true);
    setFeedback({});
    try {
      const res = await fetch(`/api/mister/events/${eventId}/formation`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          module: activeModule,
          slots: slots.map((slot, index) => ({
            slotKey: slot.slotKey,
            athleteId: slot.athleteId,
            isBench: slot.isBench,
            sortOrder: index,
          })),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setFeedback({ error: data.error ?? "Salvataggio non riuscito." });
        return;
      }
      setFeedback({ ok: "Formazione salvata (privata — solo staff)." });
    } catch {
      setFeedback({ error: "Errore di rete." });
    } finally {
      setPending(false);
    }
  }

  const starters = slots.filter((s) => !s.isBench);
  const bench = slots.filter((s) => s.isBench);

  function renderPlayerSelect(slot: SlotDraft) {
    const selected = slot.athleteId ? athleteById.get(slot.athleteId) : null;
    const warning = selected?.notInConvocationWarning;
    return (
      <div className="space-y-1">
        <select
          value={slot.athleteId ?? ""}
          onChange={(e) => assignSlot(slot.slotKey, e.target.value || null)}
          className="min-h-11 w-full rounded-xl border border-zinc-300 bg-white px-3 text-sm outline-none ring-blue-500 focus:ring-2"
        >
          <option value="">Seleziona giocatore</option>
          {selectPool.map((athlete) => {
            const taken =
              usedAthleteIds.has(athlete.id) && athlete.id !== slot.athleteId;
            return (
              <option key={athlete.id} value={athlete.id} disabled={taken}>
                {athlete.lastName} {athlete.firstName}
                {athlete.shirtNumber != null ? ` · #${athlete.shirtNumber}` : ""}
                {` · ${athlete.operationalLabel}`}
                {taken ? " (già inserito)" : ""}
              </option>
            );
          })}
        </select>
        {warning ? (
          <p className="text-xs font-medium text-amber-800">{warning}</p>
        ) : null}
      </div>
    );
  }

  function pitchLabel(slotKey: string) {
    const slot = slots.find((s) => s.slotKey === slotKey);
    if (!slot?.athleteId) return "—";
    const athlete = athleteById.get(slot.athleteId);
    if (!athlete) return "—";
    return athleteInitials(athlete.firstName, athlete.lastName);
  }

  function pitchName(slotKey: string) {
    const slot = slots.find((s) => s.slotKey === slotKey);
    if (!slot?.athleteId) return "";
    const athlete = athleteById.get(slot.athleteId);
    if (!athlete) return "";
    return `${athlete.lastName}`;
  }

  return (
    <div className="space-y-4">
      <Link
        href={backHref}
        className="inline-flex min-h-11 items-center rounded-xl border border-blue-200 bg-white px-3 text-sm font-semibold text-blue-800 hover:bg-sky-50"
      >
        ← Match Center
      </Link>

      <section className="rounded-2xl border border-blue-700 bg-blue-800 p-5 text-white shadow-md">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-sky-200">
          Formazione privata
        </p>
        <h1 className="mt-1 text-2xl font-black tracking-tight">
          Formazione{categoryName ? ` — ${categoryName}` : ""}
        </h1>
        <p className="mt-1 text-base font-semibold text-sky-100">{formatLabel}</p>
        <p className="mt-2 text-sm text-sky-100">
          {opponentName ? `vs ${opponentName}` : eventTitle}
          {" · "}Visibile solo allo staff.
          {hasConvocation
            ? " Pool preferito: convocati."
            : " Nessuna convocazione: pool = rosa categoria."}
        </p>
      </section>

      {needsModuleChoice ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          <p className="font-bold">Modulo da aggiornare</p>
          <p className="mt-1">
            {savedModuleIncompatible
              ? `La formazione salvata usa un modulo non più compatibile con ${formatLabel}. Scegli un nuovo modulo prima di salvare: i dati non vengono cancellati finché non selezioni e salvi.`
              : `Seleziona un modulo compatibile con ${formatLabel}.`}
          </p>
        </div>
      ) : null}

      <section className="rounded-2xl border border-blue-100 bg-white p-4 shadow-sm">
        <label className="block text-sm font-semibold text-zinc-800">
          Modulo
          <select
            value={module}
            onChange={(e) => {
              const value = e.target.value;
              if (isFormationModuleId(value)) setModuleAndRebuild(value);
            }}
            className="mt-1 block min-h-11 w-full max-w-xs rounded-xl border border-zinc-300 bg-white px-3 text-sm"
          >
            {!initialCompatible && !hasChosenModule ? (
              <option value="" disabled>
                Scegli modulo…
              </option>
            ) : null}
            {moduleOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>
        {activeModule === "CUSTOM" ? (
          <p className="mt-2 text-sm text-zinc-600">
            {formatLabel} — {playersPerSide} titolari previsti (panchina esclusa). Ora:{" "}
            <span className="font-semibold text-zinc-900">{starterCount}</span>
          </p>
        ) : null}
      </section>

      {activeModule && activeModule !== "CUSTOM" ? (
        <section className="overflow-hidden rounded-2xl border border-emerald-800/30 bg-[#1a5c38] p-3 shadow-sm sm:p-4">
          <p className="mb-3 text-center text-[11px] font-bold uppercase tracking-wide text-emerald-100/90">
            Campo · {activeModule}
          </p>
          <div className="space-y-3">
            {pitchLines.map((line) => (
              <div
                key={line.role}
                className="flex flex-wrap items-center justify-center gap-2"
              >
                {line.slotKeys.map((slotKey) => (
                  <div
                    key={slotKey}
                    className="flex h-14 w-[4.5rem] flex-col items-center justify-center rounded-xl border border-white/25 bg-white/15 px-1 text-center sm:h-16 sm:w-20"
                  >
                    <span className="text-sm font-black text-white">
                      {pitchLabel(slotKey)}
                    </span>
                    <span className="truncate text-[10px] font-medium text-emerald-50/90">
                      {pitchName(slotKey) || slotKey}
                    </span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <section className="rounded-2xl border border-blue-100 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-bold uppercase tracking-wide text-blue-800">
          Titolari
        </h2>
        <div className="mt-3 space-y-3">
          {starters.map((slot) => (
            <div key={slot.slotKey} className="rounded-xl border border-sky-100 bg-sky-50/40 p-3">
              <div className="mb-1 flex items-center justify-between gap-2">
                <p className="text-xs font-bold uppercase tracking-wide text-zinc-500">
                  {slot.slotKey}
                </p>
                {activeModule === "CUSTOM" ? (
                  <button
                    type="button"
                    onClick={() => removeSlot(slot.slotKey)}
                    className="min-h-11 px-2 text-xs font-semibold text-red-700"
                  >
                    Rimuovi slot
                  </button>
                ) : null}
              </div>
              {renderPlayerSelect(slot)}
            </div>
          ))}
        </div>
        {activeModule === "CUSTOM" ? (
          <button
            type="button"
            onClick={addCustomStarter}
            className="mt-3 inline-flex min-h-11 items-center rounded-xl border border-blue-200 px-4 text-sm font-bold text-blue-800"
          >
            + Aggiungi slot titolare
          </button>
        ) : null}
      </section>

      <section className="rounded-2xl border border-blue-100 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-bold uppercase tracking-wide text-blue-800">
          Panchina
        </h2>
        <div className="mt-3 space-y-3">
          {bench.length === 0 ? (
            <p className="text-sm text-zinc-500">Nessun giocatore in panchina.</p>
          ) : (
            bench.map((slot) => (
              <div key={slot.slotKey} className="rounded-xl border border-zinc-200 p-3">
                <div className="mb-1 flex items-center justify-between">
                  <p className="text-xs font-bold uppercase text-zinc-500">{slot.slotKey}</p>
                  <button
                    type="button"
                    onClick={() => removeSlot(slot.slotKey)}
                    className="min-h-11 px-2 text-xs font-semibold text-red-700"
                  >
                    Rimuovi
                  </button>
                </div>
                {renderPlayerSelect(slot)}
              </div>
            ))
          )}
        </div>
        <button
          type="button"
          onClick={addBench}
          className="mt-3 inline-flex min-h-11 items-center rounded-xl border border-blue-200 px-4 text-sm font-bold text-blue-800"
        >
          + Aggiungi giocatore
        </button>
      </section>

      {feedback.error ? (
        <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {feedback.error}
        </p>
      ) : null}
      {feedback.ok ? (
        <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
          {feedback.ok}
        </p>
      ) : null}

      <button
        type="button"
        disabled={pending}
        onClick={() => void save()}
        className="flex min-h-12 w-full items-center justify-center rounded-xl bg-blue-800 text-sm font-bold uppercase tracking-wide text-white hover:bg-blue-900 disabled:opacity-60"
      >
        {pending ? "Salvataggio…" : "Salva formazione"}
      </button>
    </div>
  );
}
