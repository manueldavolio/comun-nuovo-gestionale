"use client";

import { useMemo, useState, type DragEvent } from "react";
import Link from "next/link";
import {
  formatPlayersPerSideLabel,
  type PlayersPerSide,
} from "@/lib/category-format";
import {
  formationDraftSnapshot,
  formationModuleOptionsForPlayersPerSide,
  isFormationModuleId,
  isModuleCompatibleWithPlayersPerSide,
  moduleChangeWouldReassignAthletes,
  nextBenchSlotKey,
  nextCustomStarterSlotKey,
  pitchLinesForModule,
  placeAthleteOnSlot,
  remapSlotsForModule,
  swapFormationSlots,
  type FormationModuleId,
  type FormationSlotDraft,
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

type SlotDraft = FormationSlotDraft;

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

type Selection =
  | { kind: "athlete"; athleteId: string }
  | { kind: "slot"; slotKey: string }
  | null;

const DRAG_MIME = "application/x-comun-formation";

function cloneSlots(list: SlotDraft[]): SlotDraft[] {
  return list.map((s) => ({ ...s }));
}

function shortName(athlete: FormationAthleteOption): string {
  const last = athlete.lastName.trim();
  if (last.length <= 10) return last;
  return `${last.slice(0, 9)}…`;
}

function displayNumber(athlete: FormationAthleteOption): string {
  return athlete.shirtNumber != null ? String(athlete.shirtNumber) : "—";
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
  const [slots, setSlots] = useState<SlotDraft[]>(() => cloneSlots(initialSlots));
  const [pending, setPending] = useState(false);
  const [feedback, setFeedback] = useState<{ error?: string; ok?: string }>({});
  const [hasChosenModule, setHasChosenModule] = useState(initialCompatible);
  const [selection, setSelection] = useState<Selection>(null);
  const [dragOverKey, setDragOverKey] = useState<string | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const [pendingModule, setPendingModule] = useState<FormationModuleId | null>(null);

  /** Ultima formazione salvata (o caricata) — target di Ripristina. */
  const [baselineModule, setBaselineModule] = useState<FormationModuleId | "">(
    initialCompatible ? initialModule : "",
  );
  const [baselineSlots, setBaselineSlots] = useState<SlotDraft[]>(() =>
    cloneSlots(initialSlots),
  );
  const [savedSnapshot, setSavedSnapshot] = useState(() =>
    formationDraftSnapshot(initialCompatible ? initialModule : "", initialSlots),
  );

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
    return [...byId.values()].sort((a, b) =>
      `${a.lastName} ${a.firstName}`.localeCompare(`${b.lastName} ${b.firstName}`, "it"),
    );
  }, [pool, roster]);

  const usedAthleteIds = useMemo(() => {
    const set = new Set<string>();
    for (const slot of slots) {
      if (slot.athleteId) set.add(slot.athleteId);
    }
    return set;
  }, [slots]);

  const availableAthletes = useMemo(
    () => selectPool.filter((a) => !usedAthleteIds.has(a.id)),
    [selectPool, usedAthleteIds],
  );

  const activeModule: FormationModuleId | null =
    module && isFormationModuleId(module) ? module : null;
  const pitchLines = useMemo(
    () => (activeModule && activeModule !== "CUSTOM" ? pitchLinesForModule(activeModule) : []),
    [activeModule],
  );

  const starterCount = slots.filter((s) => !s.isBench).length;
  const formatLabel = formatPlayersPerSideLabel(playersPerSide);
  const needsModuleChoice = savedModuleIncompatible || !hasChosenModule || !activeModule;

  const currentSnapshot = useMemo(
    () => formationDraftSnapshot(activeModule ?? "", slots),
    [activeModule, slots],
  );
  const dirty = currentSnapshot !== savedSnapshot;

  function applyModuleChange(next: FormationModuleId) {
    setModule(next);
    setHasChosenModule(true);
    setSlots((prev) => remapSlotsForModule(next, prev, playersPerSide));
    setSelection(null);
    setFeedback({});
    setConfirmReset(false);
    setPendingModule(null);
  }

  function requestModuleChange(next: FormationModuleId) {
    if (next === activeModule) return;
    const from = activeModule;
    const needsConfirm =
      from != null &&
      moduleChangeWouldReassignAthletes(from, next, slots, playersPerSide);
    if (needsConfirm) {
      setPendingModule(next);
      setConfirmReset(false);
      setFeedback({});
      return;
    }
    applyModuleChange(next);
  }

  function placeOnSlot(targetSlotKey: string, athleteId: string | null) {
    setSlots((prev) => placeAthleteOnSlot(prev, targetSlotKey, athleteId));
    setSelection(null);
    setFeedback({});
    setConfirmReset(false);
  }

  function handleSlotActivate(slotKey: string) {
    const slot = slots.find((s) => s.slotKey === slotKey);
    if (!slot) return;

    if (selection?.kind === "athlete") {
      placeOnSlot(slotKey, selection.athleteId);
      return;
    }
    if (selection?.kind === "slot") {
      if (selection.slotKey === slotKey) {
        setSelection(null);
        return;
      }
      setSlots((prev) => swapFormationSlots(prev, selection.slotKey, slotKey));
      setSelection(null);
      setFeedback({});
      return;
    }

    if (slot.athleteId) {
      setSelection({ kind: "slot", slotKey });
    } else {
      setSelection({ kind: "slot", slotKey });
    }
  }

  function handleAthleteActivate(athleteId: string) {
    if (selection?.kind === "slot") {
      placeOnSlot(selection.slotKey, athleteId);
      return;
    }
    setSelection((prev) =>
      prev?.kind === "athlete" && prev.athleteId === athleteId
        ? null
        : { kind: "athlete", athleteId },
    );
  }

  function clearSlot(slotKey: string) {
    placeOnSlot(slotKey, null);
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
    setFeedback({});
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
    setFeedback({});
  }

  function removeSlot(slotKey: string) {
    setSlots((prev) => prev.filter((s) => s.slotKey !== slotKey));
    setSelection(null);
    setFeedback({});
  }

  function resetLocal() {
    setModule(baselineModule);
    setHasChosenModule(Boolean(baselineModule));
    setSlots(cloneSlots(baselineSlots));
    setSelection(null);
    setFeedback({});
    setConfirmReset(false);
    setPendingModule(null);
    setSavedSnapshot(formationDraftSnapshot(baselineModule, baselineSlots));
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
      const savedSlots = cloneSlots(slots);
      setBaselineModule(activeModule);
      setBaselineSlots(savedSlots);
      setSavedSnapshot(formationDraftSnapshot(activeModule, savedSlots));
      setFeedback({ ok: "Formazione salvata (privata — solo staff)." });
    } catch {
      setFeedback({ error: "Errore di rete." });
    } finally {
      setPending(false);
    }
  }

  const starters = slots.filter((s) => !s.isBench);
  const bench = slots.filter((s) => s.isBench);

  function onDragStartAthlete(e: DragEvent, athleteId: string) {
    e.dataTransfer.setData(DRAG_MIME, JSON.stringify({ type: "athlete", athleteId }));
    e.dataTransfer.effectAllowed = "move";
  }

  function onDragStartSlot(e: DragEvent, slotKey: string) {
    e.dataTransfer.setData(DRAG_MIME, JSON.stringify({ type: "slot", slotKey }));
    e.dataTransfer.effectAllowed = "move";
  }

  function onDropOnSlot(e: DragEvent, targetSlotKey: string) {
    e.preventDefault();
    setDragOverKey(null);
    const raw = e.dataTransfer.getData(DRAG_MIME);
    if (!raw) return;
    try {
      const payload = JSON.parse(raw) as
        | { type: "athlete"; athleteId: string }
        | { type: "slot"; slotKey: string };
      if (payload.type === "athlete") {
        placeOnSlot(targetSlotKey, payload.athleteId);
      } else if (payload.type === "slot") {
        if (payload.slotKey === targetSlotKey) return;
        setSlots((prev) => swapFormationSlots(prev, payload.slotKey, targetSlotKey));
        setSelection(null);
        setFeedback({});
      }
    } catch {
      /* ignore malformed drag payload */
    }
  }

  function renderSlotToken(slot: SlotDraft, compact = false) {
    const athlete = slot.athleteId ? athleteById.get(slot.athleteId) : null;
    const selected =
      selection?.kind === "slot" && selection.slotKey === slot.slotKey;
    const warning = athlete?.notInConvocationWarning;
    const over = dragOverKey === slot.slotKey;

    return (
      <div
        role="button"
        tabIndex={0}
        draggable={Boolean(athlete)}
        onDragStart={(e) => {
          if (!athlete) {
            e.preventDefault();
            return;
          }
          onDragStartSlot(e, slot.slotKey);
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOverKey(slot.slotKey);
        }}
        onDragLeave={() => setDragOverKey((k) => (k === slot.slotKey ? null : k))}
        onDrop={(e) => onDropOnSlot(e, slot.slotKey)}
        onClick={() => handleSlotActivate(slot.slotKey)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            handleSlotActivate(slot.slotKey);
          }
        }}
        className={`relative flex touch-manipulation flex-col items-center justify-center rounded-2xl border text-center transition ${
          compact
            ? "min-h-[4.25rem] w-[4.6rem] px-1 py-1 sm:min-h-[4.75rem] sm:w-20"
            : "min-h-[4.75rem] w-full px-2 py-2"
        } ${
          selected
            ? "border-sky-300 bg-sky-100 ring-2 ring-sky-400"
            : over
              ? "border-white bg-white/30 ring-2 ring-white/70"
              : athlete
                ? "border-white/35 bg-white/20"
                : "border-dashed border-white/35 bg-black/10"
        }`}
        aria-label={
          athlete
            ? `Posizione ${slot.slotKey}: ${athlete.firstName} ${athlete.lastName}`
            : `Posizione vuota ${slot.slotKey}`
        }
      >
        {athlete ? (
          <>
            <span className="text-[10px] font-bold uppercase tracking-wide text-emerald-50/90">
              #{displayNumber(athlete)}
            </span>
            <span className="text-sm font-black leading-none text-white sm:text-base">
              {athleteInitials(athlete.firstName, athlete.lastName)}
            </span>
            <span className="mt-0.5 max-w-full truncate text-[10px] font-semibold text-emerald-50">
              {shortName(athlete)}
            </span>
            {warning ? (
              <span className="mt-0.5 rounded-full bg-sky-950/50 px-1.5 text-[9px] font-bold uppercase tracking-wide text-sky-100">
                Non convocato
              </span>
            ) : null}
          </>
        ) : (
          <>
            <span className="text-[10px] font-bold uppercase tracking-wide text-emerald-100/80">
              {slot.slotKey}
            </span>
            <span className="text-xs font-semibold text-white/70">Libero</span>
          </>
        )}
        {athlete ? (
          <button
            type="button"
            className="absolute -right-1 -top-1 flex h-6 w-6 items-center justify-center rounded-full border border-white/40 bg-blue-950/80 text-[10px] font-bold text-white"
            aria-label={`Rimuovi ${athlete.lastName} da ${slot.slotKey}`}
            onClick={(e) => {
              e.stopPropagation();
              clearSlot(slot.slotKey);
            }}
          >
            ×
          </button>
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-28 md:pb-6">
      <Link
        href={backHref}
        className="inline-flex min-h-11 items-center rounded-xl border border-blue-200 bg-white px-3 text-sm font-semibold text-blue-800 hover:bg-sky-50"
      >
        ← Match Center
      </Link>

      <section className="rounded-2xl border border-blue-700 bg-gradient-to-br from-blue-800 via-blue-800 to-sky-700 p-5 text-white shadow-md">
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
        <p className="mt-2 text-xs font-medium text-sky-100/90">
          Trascina i giocatori sul campo oppure tocca un giocatore e poi una posizione.
        </p>
      </section>

      {dirty ? (
        <div className="rounded-xl border border-sky-300 bg-sky-50 px-3 py-2 text-sm font-semibold text-blue-950">
          Modifiche non salvate — salva o ripristina prima di uscire.
        </div>
      ) : null}

      {needsModuleChoice ? (
        <div className="rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-blue-950">
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
              if (isFormationModuleId(value)) requestModuleChange(value);
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
        <section className="overflow-hidden rounded-2xl border border-emerald-900/20 bg-[#0f6b3c] p-3 shadow-md sm:p-4">
          <div
            className="relative overflow-hidden rounded-2xl border border-white/15 bg-[linear-gradient(180deg,rgba(255,255,255,0.08),transparent_28%,transparent_72%,rgba(0,0,0,0.12)),repeating-linear-gradient(90deg,rgba(255,255,255,0.04)_0_12px,transparent_12px_24px)] p-3 sm:p-4"
            style={{ minHeight: "22rem" }}
          >
            <div className="pointer-events-none absolute inset-x-6 top-1/2 h-px -translate-y-1/2 bg-white/25" />
            <div className="pointer-events-none absolute left-1/2 top-1/2 h-20 w-20 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/20 sm:h-24 sm:w-24" />
            <p className="mb-4 text-center text-[11px] font-bold uppercase tracking-[0.16em] text-emerald-50/90">
              Campo · {activeModule}
            </p>
            <div className="relative z-10 space-y-4 sm:space-y-5">
              {pitchLines.map((line) => (
                <div key={line.role} className="flex flex-wrap items-center justify-center gap-2 sm:gap-3">
                  {line.slotKeys.map((slotKey) => {
                    const slot = slots.find((s) => s.slotKey === slotKey);
                    if (!slot) return null;
                    return <div key={slotKey}>{renderSlotToken(slot, true)}</div>;
                  })}
                </div>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {activeModule === "CUSTOM" ? (
        <section className="rounded-2xl border border-blue-100 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-bold uppercase tracking-wide text-blue-800">
            Titolari personalizzati
          </h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {starters.map((slot) => (
              <div key={slot.slotKey} className="rounded-2xl border border-sky-100 bg-sky-50/40 p-3">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <p className="text-xs font-bold uppercase tracking-wide text-zinc-500">
                    {slot.slotKey}
                  </p>
                  <button
                    type="button"
                    onClick={() => removeSlot(slot.slotKey)}
                    className="min-h-10 px-2 text-xs font-semibold text-red-700"
                  >
                    Rimuovi
                  </button>
                </div>
                {renderSlotToken(slot)}
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={addCustomStarter}
            className="mt-3 inline-flex min-h-11 items-center rounded-xl border border-blue-200 px-4 text-sm font-bold text-blue-800"
          >
            + Aggiungi slot titolare
          </button>
        </section>
      ) : null}

      <section className="rounded-2xl border border-blue-100 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="text-sm font-bold uppercase tracking-wide text-blue-800">
              Panchina
            </h2>
            <p className="mt-1 text-sm text-zinc-600">
              Trascina qui dai titolari o assegna dalla rosa libera.
            </p>
          </div>
          <button
            type="button"
            onClick={addBench}
            className="inline-flex min-h-11 items-center rounded-xl border border-blue-200 bg-sky-50 px-4 text-sm font-bold text-blue-800"
          >
            + Slot panchina
          </button>
        </div>
        <div
          className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
          onDragOver={(e) => e.preventDefault()}
        >
          {bench.length === 0 ? (
            <p className="text-sm text-zinc-500 sm:col-span-2">Nessun giocatore in panchina.</p>
          ) : (
            bench.map((slot) => (
              <div key={slot.slotKey} className="rounded-2xl border border-blue-100 bg-sky-50/30 p-3">
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-xs font-bold uppercase text-zinc-500">{slot.slotKey}</p>
                  <button
                    type="button"
                    onClick={() => removeSlot(slot.slotKey)}
                    className="min-h-10 px-2 text-xs font-semibold text-red-700"
                  >
                    Rimuovi
                  </button>
                </div>
                <div className="rounded-2xl bg-[#0f6b3c] p-2">{renderSlotToken(slot)}</div>
              </div>
            ))
          )}
        </div>
      </section>

      <section className="rounded-2xl border border-blue-100 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-bold uppercase tracking-wide text-blue-800">
          Rosa disponibile
        </h2>
        <p className="mt-1 text-sm text-zinc-600">
          Tocca un giocatore, poi una posizione libera o occupata (scambio).
        </p>
        {availableAthletes.length === 0 ? (
          <p className="mt-3 text-sm text-zinc-500">Tutti i giocatori del pool sono in campo o in panchina.</p>
        ) : (
          <ul className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {availableAthletes.map((athlete) => {
              const selected =
                selection?.kind === "athlete" && selection.athleteId === athlete.id;
              const warning = athlete.notInConvocationWarning;
              return (
                <li key={athlete.id}>
                  <button
                    type="button"
                    draggable
                    onDragStart={(e) => onDragStartAthlete(e, athlete.id)}
                    onClick={() => handleAthleteActivate(athlete.id)}
                    className={`flex min-h-14 w-full items-center gap-3 rounded-2xl border px-3 text-left transition ${
                      selected
                        ? "border-blue-700 bg-blue-800 text-white ring-2 ring-sky-300"
                        : "border-blue-100 bg-sky-50/60 text-blue-950 hover:bg-sky-50"
                    }`}
                  >
                    <span
                      className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-sm font-black ${
                        selected ? "bg-white/15 text-white" : "bg-blue-800 text-white"
                      }`}
                    >
                      {athleteInitials(athlete.firstName, athlete.lastName)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-bold">
                        {athlete.firstName} {athlete.lastName}
                      </span>
                      <span
                        className={`block text-xs ${selected ? "text-sky-100" : "text-zinc-500"}`}
                      >
                        #{displayNumber(athlete)} · {athlete.operationalLabel}
                      </span>
                      {warning ? (
                        <span
                          className={`mt-0.5 block text-[11px] font-semibold ${
                            selected ? "text-sky-100" : "text-sky-800"
                          }`}
                        >
                          Non in convocazione
                        </span>
                      ) : null}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {selection ? (
        <p className="rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-sm font-semibold text-blue-950">
          {selection.kind === "athlete"
            ? `Selezionato: ${athleteById.get(selection.athleteId)?.lastName ?? "giocatore"} — tocca una posizione.`
            : `Posizione ${selection.slotKey} selezionata — tocca un’altra posizione per scambiare, o un giocatore libero.`}
          {" "}
          <button
            type="button"
            className="underline"
            onClick={() => setSelection(null)}
          >
            Annulla
          </button>
        </p>
      ) : null}

      {feedback.error ? (
        <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-800">
          {feedback.error}
        </p>
      ) : null}
      {feedback.ok ? (
        <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-900">
          {feedback.ok}
        </p>
      ) : null}

      {pendingModule ? (
        <div className="rounded-2xl border border-sky-200 bg-sky-50 p-4 text-sm text-blue-950">
          <p className="font-bold">Cambiare modulo in {pendingModule}?</p>
          <p className="mt-1">
            Le posizioni verranno ricalcolate. I giocatori senza slot corrispondente restano
            assegnati (slot liberi o panchina): nessuno viene eliminato in silenzio.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => applyModuleChange(pendingModule)}
              className="min-h-11 rounded-xl bg-blue-800 px-4 text-sm font-bold text-white"
            >
              Sì, cambia modulo
            </button>
            <button
              type="button"
              onClick={() => setPendingModule(null)}
              className="min-h-11 rounded-xl border border-blue-200 bg-white px-4 text-sm font-bold text-blue-900"
            >
              Annulla
            </button>
          </div>
        </div>
      ) : null}

      {confirmReset ? (
        <div className="rounded-2xl border border-sky-200 bg-sky-50 p-4 text-sm text-blue-950">
          <p className="font-bold">Ripristinare le modifiche locali?</p>
          <p className="mt-1">
            Tornerai all’ultima formazione salvata. Le modifiche non salvate andranno perse.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={resetLocal}
              className="min-h-11 rounded-xl bg-blue-800 px-4 text-sm font-bold text-white"
            >
              Sì, ripristina
            </button>
            <button
              type="button"
              onClick={() => setConfirmReset(false)}
              className="min-h-11 rounded-xl border border-blue-200 bg-white px-4 text-sm font-bold text-blue-900"
            >
              Annulla
            </button>
          </div>
        </div>
      ) : null}

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-blue-100 bg-white/95 p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] backdrop-blur md:static md:border-0 md:bg-transparent md:p-0 md:backdrop-blur-none">
        <div className="mx-auto flex w-full max-w-[1100px] flex-col gap-2 sm:flex-row">
          <button
            type="button"
            disabled={!dirty || pending}
            onClick={() => setConfirmReset(true)}
            className="min-h-12 flex-1 rounded-xl border border-blue-200 bg-sky-50 px-4 text-sm font-bold uppercase tracking-wide text-blue-900 disabled:opacity-50"
          >
            Ripristina
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => void save()}
            className="min-h-12 flex-[1.4] rounded-xl bg-blue-800 px-4 text-sm font-bold uppercase tracking-wide text-white hover:bg-blue-900 disabled:opacity-60"
          >
            {pending ? "Salvataggio…" : "Salva formazione"}
          </button>
        </div>
      </div>
    </div>
  );
}
