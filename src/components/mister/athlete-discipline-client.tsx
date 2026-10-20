"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { CompetitionKind, DisciplinarySanctionType } from "@prisma/client";
import { COMPETITION_KIND_LABEL, COMPETITION_KINDS } from "@/lib/competition-kind";
import { DISCIPLINARY_SANCTION_LABEL } from "@/lib/discipline";

type Opening = {
  priorYellowCards: number;
  priorYellowCardsForAccumulation: number;
  priorRedCards: number;
  openSuspensionMatchdays: number;
  referenceDate: string;
  notes: string | null;
} | null;

type Incident = {
  id: string;
  type: DisciplinarySanctionType;
  status: "ACTIVE" | "VOIDED";
  notes: string | null;
  event: { title: string; startAt: string } | null;
  createdAt: string;
};

type Serving = {
  id: string;
  status: "PENDING" | "SERVED" | "CANCELLED";
  event: { title: string } | null;
};

type Suspension = {
  id: string;
  matchdaysTotal: number;
  officialRef: string | null;
  status: "ACTIVE" | "VOIDED";
  servings: Serving[];
};

type Totals = {
  yellowCards: number;
  yellowCardsForAccumulation: number;
  redCards: number;
  remainingSuspensions: number;
};

type AthleteDisciplineClientProps = {
  athleteId: string;
  athleteName: string;
  seasonLabel: string;
  competitionKind: CompetitionKind;
  opening: Opening;
  incidents: Incident[];
  suspensions: Suspension[];
  totals: Totals;
};

function toDateInput(value: string | undefined) {
  if (!value) return new Date().toISOString().slice(0, 10);
  return value.slice(0, 10);
}

export function AthleteDisciplineClient({
  athleteId,
  athleteName,
  seasonLabel,
  competitionKind: initialKind,
  opening,
  incidents,
  suspensions,
  totals,
}: AthleteDisciplineClientProps) {
  const router = useRouter();
  const [competitionKind, setCompetitionKind] = useState(initialKind);
  const [showOpening, setShowOpening] = useState(false);
  const [priorYellow, setPriorYellow] = useState(opening?.priorYellowCards ?? 0);
  const [priorYellowAcc, setPriorYellowAcc] = useState(
    opening?.priorYellowCardsForAccumulation ?? opening?.priorYellowCards ?? 0,
  );
  const [priorRed, setPriorRed] = useState(opening?.priorRedCards ?? 0);
  const [openDays, setOpenDays] = useState(opening?.openSuspensionMatchdays ?? 0);
  const [referenceDate, setReferenceDate] = useState(toDateInput(opening?.referenceDate));
  const [openingNotes, setOpeningNotes] = useState(opening?.notes ?? "");
  const [matchdays, setMatchdays] = useState(1);
  const [officialRef, setOfficialRef] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  async function saveOpening() {
    setPending(true);
    setError(null);
    setOk(null);
    try {
      const response = await fetch(`/api/mister/discipline/athletes/${athleteId}/opening`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          seasonLabel,
          competitionKind,
          priorYellowCards: priorYellow,
          priorYellowCardsForAccumulation: priorYellowAcc,
          priorRedCards: priorRed,
          openSuspensionMatchdays: openDays,
          referenceDate: `${referenceDate}T12:00:00.000Z`,
          notes: openingNotes,
        }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(payload.error ?? "Salvataggio non riuscito.");
        return;
      }
      setOk("Situazione iniziale salvata.");
      setShowOpening(false);
      router.refresh();
    } catch {
      setError("Errore di rete.");
    } finally {
      setPending(false);
    }
  }

  async function createSuspension() {
    setPending(true);
    setError(null);
    setOk(null);
    try {
      const response = await fetch("/api/mister/discipline/suspensions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          athleteId,
          seasonLabel,
          competitionKind,
          matchdaysTotal: matchdays,
          officialRef: officialRef || null,
          decidedAt: new Date().toISOString(),
        }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(payload.error ?? "Assegnazione non riuscita.");
        return;
      }
      setOk("Squalifica registrata (giornate in attesa di conferma).");
      router.refresh();
    } catch {
      setError("Errore di rete.");
    } finally {
      setPending(false);
    }
  }

  async function confirmServing(servingId: string) {
    setPending(true);
    setError(null);
    setOk(null);
    try {
      const response = await fetch(`/api/mister/discipline/servings/${servingId}/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(payload.error ?? "Conferma non riuscita.");
        return;
      }
      setOk("Giornata confermata come scontata.");
      router.refresh();
    } catch {
      setError("Errore di rete.");
    } finally {
      setPending(false);
    }
  }

  async function voidIncident(incidentId: string) {
    if (!window.confirm("Annullare questo cartellino? Lo storico resta consultabile.")) {
      return;
    }
    setPending(true);
    setError(null);
    try {
      const response = await fetch(`/api/mister/discipline/incidents/${incidentId}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ voidReason: "Correzione mister" }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(payload.error ?? "Annullamento non riuscito.");
        return;
      }
      setOk("Cartellino annullato.");
      router.refresh();
    } catch {
      setError("Errore di rete.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <section className="rounded-2xl border border-blue-100 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-lg font-bold text-zinc-900">{athleteName}</h2>
            <p className="text-xs text-zinc-600">
              Stagione {seasonLabel} · {COMPETITION_KIND_LABEL[competitionKind]}
            </p>
          </div>
          <label className="text-xs font-semibold text-zinc-600">
            Competizione
            <select
              className="ml-2 rounded-lg border border-blue-200 px-2 py-1.5 text-sm"
              value={competitionKind}
              onChange={(event) => {
                const next = event.target.value as CompetitionKind;
                setCompetitionKind(next);
                const url = new URL(window.location.href);
                url.searchParams.set("competitionKind", next);
                router.push(url.pathname + "?" + url.searchParams.toString());
              }}
            >
              {COMPETITION_KINDS.map((kind) => (
                <option key={kind} value={kind}>
                  {COMPETITION_KIND_LABEL[kind]}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
            <p className="text-[10px] font-bold uppercase text-amber-800">Ammonizioni</p>
            <p className="text-2xl font-black text-amber-950">{totals.yellowCards}</p>
            <p className="text-[10px] text-amber-800">
              Accumulo: {totals.yellowCardsForAccumulation}
            </p>
          </div>
          <div className="rounded-xl border border-red-200 bg-red-50 p-3">
            <p className="text-[10px] font-bold uppercase text-red-700">Espulsioni</p>
            <p className="text-2xl font-black text-red-900">{totals.redCards}</p>
          </div>
          <div className="rounded-xl border border-violet-200 bg-violet-50 p-3">
            <p className="text-[10px] font-bold uppercase text-violet-800">Residue</p>
            <p className="text-2xl font-black text-violet-950">{totals.remainingSuspensions}</p>
          </div>
          <button
            type="button"
            onClick={() => setShowOpening((value) => !value)}
            className="rounded-xl border border-blue-200 bg-blue-50 p-3 text-left text-sm font-bold text-blue-900 hover:bg-blue-100"
          >
            Inserisci / modifica situazione iniziale
          </button>
        </div>
      </section>

      {showOpening ? (
        <section className="rounded-2xl border border-blue-200 bg-white p-4 shadow-sm">
          <h3 className="text-sm font-bold text-zinc-900">Situazione disciplinare iniziale</h3>
          <p className="mt-1 text-xs text-zinc-600">
            Usa il pregresso se il campionato è già iniziato. Le gare successive alla data di
            riferimento non vengono conteggiate due volte.
          </p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="text-xs font-semibold">
              Ammonizioni pregresse
              <input
                type="number"
                min={0}
                className="mt-1 w-full rounded-xl border px-3 py-2 text-sm"
                value={priorYellow}
                onChange={(e) => setPriorYellow(Number(e.target.value))}
              />
            </label>
            <label className="text-xs font-semibold">
              Di cui per accumulo
              <input
                type="number"
                min={0}
                className="mt-1 w-full rounded-xl border px-3 py-2 text-sm"
                value={priorYellowAcc}
                onChange={(e) => setPriorYellowAcc(Number(e.target.value))}
              />
            </label>
            <label className="text-xs font-semibold">
              Espulsioni pregresse
              <input
                type="number"
                min={0}
                className="mt-1 w-full rounded-xl border px-3 py-2 text-sm"
                value={priorRed}
                onChange={(e) => setPriorRed(Number(e.target.value))}
              />
            </label>
            <label className="text-xs font-semibold">
              Giornate ancora da scontare
              <input
                type="number"
                min={0}
                className="mt-1 w-full rounded-xl border px-3 py-2 text-sm"
                value={openDays}
                onChange={(e) => setOpenDays(Number(e.target.value))}
              />
            </label>
            <label className="text-xs font-semibold">
              Data di riferimento
              <input
                type="date"
                className="mt-1 w-full rounded-xl border px-3 py-2 text-sm"
                value={referenceDate}
                onChange={(e) => setReferenceDate(e.target.value)}
              />
            </label>
            <label className="text-xs font-semibold sm:col-span-2">
              Note
              <textarea
                className="mt-1 w-full rounded-xl border px-3 py-2 text-sm"
                value={openingNotes}
                onChange={(e) => setOpeningNotes(e.target.value)}
              />
            </label>
          </div>
          <button
            type="button"
            disabled={pending}
            onClick={() => void saveOpening()}
            className="mt-3 inline-flex min-h-11 items-center justify-center rounded-xl bg-blue-800 px-4 text-sm font-bold text-white disabled:opacity-60"
          >
            Salva situazione iniziale
          </button>
        </section>
      ) : null}

      <section className="rounded-2xl border border-blue-100 bg-white p-4 shadow-sm">
        <h3 className="text-sm font-bold text-zinc-900">Storico cartellini</h3>
        {incidents.length === 0 ? (
          <p className="mt-2 text-sm text-zinc-600">Nessun cartellino registrato.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {incidents.map((incident) => (
              <li
                key={incident.id}
                className={`rounded-xl border px-3 py-2 ${
                  incident.status === "VOIDED"
                    ? "border-zinc-200 bg-zinc-50 opacity-70"
                    : "border-amber-100 bg-amber-50/50"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-zinc-900">
                      {DISCIPLINARY_SANCTION_LABEL[incident.type]}
                      {incident.status === "VOIDED" ? " (annullato)" : ""}
                    </p>
                    <p className="text-xs text-zinc-600">
                      {incident.event
                        ? `${incident.event.title}`
                        : "Senza gara collegata"}
                    </p>
                  </div>
                  {incident.status === "ACTIVE" ? (
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => void voidIncident(incident.id)}
                      className="text-xs font-semibold text-red-700"
                    >
                      Annulla
                    </button>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-2xl border border-violet-100 bg-white p-4 shadow-sm">
        <h3 className="text-sm font-bold text-zinc-900">Squalifiche</h3>
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          <label className="text-xs font-semibold">
            Giornate assegnate
            <input
              type="number"
              min={1}
              className="mt-1 w-full rounded-xl border px-3 py-2 text-sm"
              value={matchdays}
              onChange={(e) => setMatchdays(Number(e.target.value))}
            />
          </label>
          <label className="text-xs font-semibold sm:col-span-2">
            Riferimento comunicato (opz.)
            <input
              className="mt-1 w-full rounded-xl border px-3 py-2 text-sm"
              value={officialRef}
              onChange={(e) => setOfficialRef(e.target.value)}
              placeholder="es. CU n. 12"
            />
          </label>
        </div>
        <button
          type="button"
          disabled={pending}
          onClick={() => void createSuspension()}
          className="mt-3 inline-flex min-h-11 items-center justify-center rounded-xl border border-violet-300 bg-violet-50 px-4 text-sm font-bold text-violet-900 disabled:opacity-60"
        >
          Assegna squalifica
        </button>

        {suspensions.length === 0 ? (
          <p className="mt-3 text-sm text-zinc-600">Nessuna squalifica in ledger.</p>
        ) : (
          <ul className="mt-3 space-y-3">
            {suspensions.map((suspension) => (
              <li key={suspension.id} className="rounded-xl border border-violet-100 bg-violet-50/40 p-3">
                <p className="text-sm font-semibold text-zinc-900">
                  {suspension.matchdaysTotal} giornate
                  {suspension.officialRef ? ` · ${suspension.officialRef}` : ""}
                  {suspension.status === "VOIDED" ? " (annullata)" : ""}
                </p>
                <ul className="mt-2 space-y-1">
                  {suspension.servings.map((serving, index) => (
                    <li
                      key={serving.id}
                      className="flex items-center justify-between gap-2 rounded-lg bg-white px-2 py-1.5 text-xs"
                    >
                      <span>
                        Giornata {index + 1}:{" "}
                        <strong>
                          {serving.status === "SERVED"
                            ? "Scontata"
                            : serving.status === "CANCELLED"
                              ? "Annullata"
                              : "Da scontare"}
                        </strong>
                      </span>
                      {serving.status === "PENDING" && suspension.status === "ACTIVE" ? (
                        <button
                          type="button"
                          disabled={pending}
                          onClick={() => void confirmServing(serving.id)}
                          className="font-bold text-violet-800"
                        >
                          Conferma scontata
                        </button>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        )}
      </section>

      {error ? (
        <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      ) : null}
      {ok ? (
        <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          {ok}
        </p>
      ) : null}
    </div>
  );
}
