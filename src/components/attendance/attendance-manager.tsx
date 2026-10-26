"use client";

import { useMemo, useState } from "react";
import type { AttendanceStatus } from "@prisma/client";
import { AlertTriangle, CheckCircle2, MapPin } from "lucide-react";
import { TouchStepper } from "@/components/mister/touch-stepper";
import { ATTENDANCE_STATUS_CHOICES, ATTENDANCE_STATUS_LABEL } from "@/lib/attendance-status";
import {
  formatConvocationWallClockDate,
  formatConvocationWallClockTime,
} from "@/lib/convocation-times";
import {
  buildClassicMatchResultPayload,
  clubOpponentGoalsFromHomeAway,
  clubOpponentToHomeAway,
  computeFourPeriodBreakdown,
  countEnteredPeriods,
  FOUR_PERIOD_COUNT,
  usesFourPeriodScoring,
  type PeriodScoreInput,
} from "@/lib/four-period-scoring";
import {
  formatAthleteRoleDisplay,
  isGoalkeeperRole,
} from "@/lib/athlete-roles";
import { resolveMatchDayOpponentName } from "@/lib/match-day";
import { normalizeStatsForStatus } from "@/lib/mister-incomplete";
import { athleteInitials } from "@/lib/parent-season";

type AthleteRow = {
  id: string;
  firstName: string;
  lastName: string;
  position: string | null;
  shirtNumber: number | null;
  status: AttendanceStatus | null;
  goals?: number;
  assists?: number;
  /** null = non inserito; 0 = clean sheet confermato */
  goalsConceded?: number | null;
};

type PeriodDraft = {
  entered: boolean;
  clubGoals: number;
  opponentGoals: number;
};

type AttendanceManagerProps = {
  eventId: string;
  eventTitle: string;
  eventCategoryName: string;
  eventStartAt: Date | string;
  eventLocation: string | null;
  athletes: AthleteRow[];
  matchMode?: boolean;
  initialMatchResult?: {
    opponentName: string | null;
    homeScore: number | null;
    awayScore: number | null;
    isHome: boolean | null;
  };
  initialPeriodScores?: PeriodScoreInput[];
};

type StatusDraft = AttendanceStatus | null;
type RosterFilter = "ALL" | "UNSET" | "PRESENT" | "ABSENT" | "JUSTIFIED_ABSENCE" | "INJURED";

const CHIP_CLASS: Record<AttendanceStatus, string> = {
  PRESENT: "border-emerald-400 bg-emerald-500 text-white shadow-sm shadow-emerald-200",
  ABSENT: "border-red-400 bg-red-500 text-white shadow-sm shadow-red-200",
  JUSTIFIED_ABSENCE: "border-sky-400 bg-sky-600 text-white shadow-sm shadow-sky-200",
  INJURED: "border-slate-400 bg-slate-600 text-white shadow-sm shadow-slate-200",
};

const CHIP_IDLE =
  "border-zinc-200 bg-white text-zinc-600 hover:border-blue-200 hover:bg-sky-50 active:bg-sky-100";

const SHORT_LABEL: Record<AttendanceStatus, string> = {
  PRESENT: "Presente",
  ABSENT: "Assente",
  JUSTIFIED_ABSENCE: "Giustificato",
  INJURED: "Infortunato",
};

const PERIOD_LABELS = ["", "1° tempo", "2° tempo", "3° tempo", "4° tempo"];

function buildInitialStatus(athletes: AthleteRow[]) {
  return athletes.reduce<Record<string, StatusDraft>>((acc, athlete) => {
    acc[athlete.id] = athlete.status;
    return acc;
  }, {});
}

function buildInitialGoals(athletes: AthleteRow[]) {
  return athletes.reduce<Record<string, number>>((acc, athlete) => {
    acc[athlete.id] = athlete.goals ?? 0;
    return acc;
  }, {});
}

function buildInitialAssists(athletes: AthleteRow[]) {
  return athletes.reduce<Record<string, number>>((acc, athlete) => {
    acc[athlete.id] = athlete.assists ?? 0;
    return acc;
  }, {});
}

function buildInitialGoalsConceded(athletes: AthleteRow[]) {
  return athletes.reduce<Record<string, number | null>>((acc, athlete) => {
    acc[athlete.id] =
      athlete.goalsConceded === undefined ? null : athlete.goalsConceded;
    return acc;
  }, {});
}

function initialResultEntered(initial?: AttendanceManagerProps["initialMatchResult"]) {
  return initial?.homeScore != null && initial?.awayScore != null;
}

function buildInitialPeriods(
  initialPeriodScores: PeriodScoreInput[] | undefined,
  isHome: boolean | null,
): PeriodDraft[] {
  return Array.from({ length: FOUR_PERIOD_COUNT }, (_, index) => {
    const periodNumber = index + 1;
    const row = initialPeriodScores?.find((item) => item.periodNumber === periodNumber);
    if (row && row.homeScore != null && row.awayScore != null) {
      const mapped = clubOpponentGoalsFromHomeAway({
        homeScore: row.homeScore,
        awayScore: row.awayScore,
        isHome,
      });
      return {
        entered: true,
        clubGoals: mapped.clubGoals,
        opponentGoals: mapped.opponentGoals,
      };
    }
    return { entered: false, clubGoals: 0, opponentGoals: 0 };
  });
}

type AttendanceDraftSnapshotInput = {
  athletes: AthleteRow[];
  statusByAthlete: Record<string, StatusDraft>;
  goalsByAthlete: Record<string, number>;
  assistsByAthlete: Record<string, number>;
  goalsConcededByAthlete: Record<string, number | null>;
  matchMode: boolean;
  clubScore: number;
  opponentScore: number;
  isHome: boolean;
  resultEntered: boolean;
  periods: PeriodDraft[];
};

/** Snapshot UI di tutti i campi modificabili (presenze + partita). Solo dirty tracking. */
function draftSnapshot(input: AttendanceDraftSnapshotInput): string {
  const athletesPart = input.athletes
    .map((athlete) => {
      const id = athlete.id;
      const status = input.statusByAthlete[id] ?? "";
      const goals = input.goalsByAthlete[id] ?? 0;
      const assists = input.assistsByAthlete[id] ?? 0;
      const conceded =
        input.goalsConcededByAthlete[id] === undefined ||
        input.goalsConcededByAthlete[id] === null
          ? "null"
          : String(input.goalsConcededByAthlete[id]);
      return `${id}:${status}:${goals}:${assists}:${conceded}`;
    })
    .join("|");

  if (!input.matchMode) return `attendance:${athletesPart}`;

  const periodsPart = input.periods
    .map(
      (period, index) =>
        `${index}:${period.entered ? 1 : 0}:${period.clubGoals}:${period.opponentGoals}`,
    )
    .join("|");

  return [
    `attendance:${athletesPart}`,
    `match:${input.isHome ? 1 : 0}:${input.resultEntered ? 1 : 0}:${input.clubScore}:${input.opponentScore}`,
    `periods:${periodsPart}`,
  ].join("::");
}

export function AttendanceManager({
  eventId,
  eventTitle,
  eventCategoryName,
  eventStartAt,
  eventLocation,
  athletes,
  matchMode = false,
  initialMatchResult,
  initialPeriodScores,
}: AttendanceManagerProps) {
  const startAt = typeof eventStartAt === "string" ? new Date(eventStartAt) : eventStartAt;
  const opponent = resolveMatchDayOpponentName({
    opponentName: initialMatchResult?.opponentName,
    title: eventTitle,
  });
  const fourPeriodMode = usesFourPeriodScoring(eventCategoryName);

  const initialStatus = buildInitialStatus(athletes);
  const initialGoals = buildInitialGoals(athletes);
  const initialAssists = buildInitialAssists(athletes);
  const initialConceded = buildInitialGoalsConceded(athletes);
  const initialClubScore =
    initialMatchResult?.isHome === false
      ? (initialMatchResult.awayScore ?? 0)
      : (initialMatchResult?.homeScore ?? 0);
  const initialOpponentScore =
    initialMatchResult?.isHome === false
      ? (initialMatchResult.homeScore ?? 0)
      : (initialMatchResult?.awayScore ?? 0);
  const initialIsHome = initialMatchResult?.isHome ?? true;
  const initialResultEnteredFlag = initialResultEntered(initialMatchResult);
  const initialPeriods = buildInitialPeriods(
    initialPeriodScores,
    initialMatchResult?.isHome ?? true,
  );

  const [statusByAthlete, setStatusByAthlete] =
    useState<Record<string, StatusDraft>>(initialStatus);
  const [goalsByAthlete, setGoalsByAthlete] = useState(initialGoals);
  const [assistsByAthlete, setAssistsByAthlete] = useState(initialAssists);
  const [goalsConcededByAthlete, setGoalsConcededByAthlete] = useState(initialConceded);
  const [clubScore, setClubScore] = useState(initialClubScore);
  const [opponentScore, setOpponentScore] = useState(initialOpponentScore);
  const [isHome, setIsHome] = useState(initialIsHome);
  const [resultEntered, setResultEntered] = useState(initialResultEnteredFlag);
  const [periods, setPeriods] = useState<PeriodDraft[]>(initialPeriods);
  const [savedDraftSnapshot, setSavedDraftSnapshot] = useState(() =>
    draftSnapshot({
      athletes,
      statusByAthlete: initialStatus,
      goalsByAthlete: initialGoals,
      assistsByAthlete: initialAssists,
      goalsConcededByAthlete: initialConceded,
      matchMode,
      clubScore: initialClubScore,
      opponentScore: initialOpponentScore,
      isHome: initialIsHome,
      resultEntered: initialResultEnteredFlag,
      periods: initialPeriods,
    }),
  );
  const [pending, setPending] = useState(false);
  const [feedback, setFeedback] = useState<{ error?: string; ok?: string }>({});
  const [filter, setFilter] = useState<RosterFilter>("ALL");

  const summary = useMemo(() => {
    const counts = {
      unset: 0,
      PRESENT: 0,
      ABSENT: 0,
      JUSTIFIED_ABSENCE: 0,
      INJURED: 0,
    };
    for (const athlete of athletes) {
      const status = statusByAthlete[athlete.id];
      if (!status) counts.unset += 1;
      else counts[status] += 1;
    }
    return counts;
  }, [athletes, statusByAthlete]);

  const registeredCount =
    summary.PRESENT + summary.ABSENT + summary.JUSTIFIED_ABSENCE + summary.INJURED;
  const presencePercent =
    registeredCount > 0 ? Math.round((summary.PRESENT / registeredCount) * 100) : null;

  const missingToday = useMemo(
    () =>
      athletes.filter((athlete) => {
        const status = statusByAthlete[athlete.id];
        return (
          status === "ABSENT" ||
          status === "JUSTIFIED_ABSENCE" ||
          status === "INJURED"
        );
      }),
    [athletes, statusByAthlete],
  );

  const currentDraftSnapshot = useMemo(
    () =>
      draftSnapshot({
        athletes,
        statusByAthlete,
        goalsByAthlete,
        assistsByAthlete,
        goalsConcededByAthlete,
        matchMode,
        clubScore,
        opponentScore,
        isHome,
        resultEntered,
        periods,
      }),
    [
      athletes,
      statusByAthlete,
      goalsByAthlete,
      assistsByAthlete,
      goalsConcededByAthlete,
      matchMode,
      clubScore,
      opponentScore,
      isHome,
      resultEntered,
      periods,
    ],
  );

  const dirty = currentDraftSnapshot !== savedDraftSnapshot;

  const filteredAthletes = useMemo(() => {
    if (filter === "ALL") return athletes;
    if (filter === "UNSET") return athletes.filter((a) => !statusByAthlete[a.id]);
    return athletes.filter((a) => statusByAthlete[a.id] === filter);
  }, [athletes, filter, statusByAthlete]);

  const periodInputs: PeriodScoreInput[] = useMemo(
    () =>
      periods.map((period, index) => {
        if (!period.entered) {
          return { periodNumber: index + 1, homeScore: null, awayScore: null };
        }
        const mapped = clubOpponentToHomeAway({
          clubGoals: period.clubGoals,
          opponentGoals: period.opponentGoals,
          isHome,
        });
        return {
          periodNumber: index + 1,
          homeScore: mapped.homeScore,
          awayScore: mapped.awayScore,
        };
      }),
    [periods, isHome],
  );

  const periodBreakdown = useMemo(
    () => computeFourPeriodBreakdown(periodInputs, isHome),
    [periodInputs, isHome],
  );
  const periodsEnteredCount = countEnteredPeriods(periodInputs);

  function setStatus(athleteId: string, status: AttendanceStatus) {
    setStatusByAthlete((prev) => ({ ...prev, [athleteId]: status }));
    if (status !== "PRESENT") {
      setGoalsByAthlete((prev) => ({ ...prev, [athleteId]: 0 }));
      setAssistsByAthlete((prev) => ({ ...prev, [athleteId]: 0 }));
      setGoalsConcededByAthlete((prev) => ({ ...prev, [athleteId]: null }));
    }
    setFeedback({});
  }

  function bumpClubScore(value: number) {
    setClubScore(value);
    if (!resultEntered && value !== 0) setResultEntered(true);
  }

  function bumpOpponentScore(value: number) {
    setOpponentScore(value);
    if (!resultEntered && value !== 0) setResultEntered(true);
  }

  function updatePeriod(
    index: number,
    patch: Partial<PeriodDraft> & { markEntered?: boolean },
  ) {
    setPeriods((prev) =>
      prev.map((period, i) => {
        if (i !== index) return period;
        const next = { ...period, ...patch };
        if (patch.markEntered) next.entered = true;
        return next;
      }),
    );
  }

  async function saveAttendance() {
    if (pending) return;
    setFeedback({});

    const unset = athletes.filter((athlete) => !statusByAthlete[athlete.id]);
    if (unset.length > 0) {
      setFeedback({
        error: `Seleziona lo stato presenza per tutti gli atleti (${unset.length} da registrare).`,
      });
      setFilter("UNSET");
      return;
    }

    setPending(true);

    try {
      const entries = athletes.map((athlete) => {
        const status = statusByAthlete[athlete.id] ?? "PRESENT";
        const stats = normalizeStatsForStatus({
          status,
          goals: goalsByAthlete[athlete.id] ?? 0,
          assists: assistsByAthlete[athlete.id] ?? 0,
        });
        const isGk = isGoalkeeperRole(athlete.position);
        return {
          athleteId: athlete.id,
          status,
          ...(matchMode
            ? {
                ...stats,
                // Solo POR: invia sempre (anche null) per distinguere da client legacy.
                ...(isGk
                  ? {
                      goalsConceded:
                        status === "PRESENT"
                          ? (goalsConcededByAthlete[athlete.id] ?? null)
                          : null,
                    }
                  : {}),
              }
            : {}),
        };
      });

      const body: Record<string, unknown> = { entries };
      const opponentName =
        (initialMatchResult?.opponentName ?? "").trim() ||
        (opponent !== "Avversario" ? opponent : null);

      if (matchMode) {
        if (fourPeriodMode) {
          body.matchResult = { opponentName, isHome };
          body.periodScores = periodInputs;
        } else {
          body.matchResult = buildClassicMatchResultPayload({
            resultEntered,
            clubScore,
            opponentScore,
            isHome,
            opponentName,
          });
        }
      }

      const response = await fetch(`/api/events/${eventId}/attendance`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = (await response.json().catch(() => null)) as
        | { error?: string; updated?: number }
        | null;

      if (!response.ok) {
        setFeedback({ error: data?.error ?? "Salvataggio non riuscito." });
        return;
      }

      setSavedDraftSnapshot(
        draftSnapshot({
          athletes,
          statusByAthlete,
          goalsByAthlete,
          assistsByAthlete,
          goalsConcededByAthlete,
          matchMode,
          clubScore,
          opponentScore,
          isHome,
          resultEntered,
          periods,
        }),
      );
      setFeedback({
        ok: matchMode
          ? `Partita salvata (${data?.updated ?? entries.length} atleti).`
          : `Presenze salvate (${data?.updated ?? entries.length}).`,
      });
    } catch {
      setFeedback({ error: "Errore imprevisto. Riprova." });
    } finally {
      setPending(false);
    }
  }

  const venueLabel =
    isHome === true ? "Casa" : isHome === false ? "Trasferta" : "—";

  const filterChips: Array<{ id: RosterFilter; label: string; count: number }> = [
    { id: "ALL", label: "Tutti", count: athletes.length },
    { id: "UNSET", label: "Da gestire", count: summary.unset },
    { id: "PRESENT", label: "Presenti", count: summary.PRESENT },
    { id: "ABSENT", label: "Assenti", count: summary.ABSENT },
    { id: "JUSTIFIED_ABSENCE", label: "Giustificati", count: summary.JUSTIFIED_ABSENCE },
    { id: "INJURED", label: "Infortunati", count: summary.INJURED },
  ];

  return (
    <div className="space-y-4">
      <section className="overflow-hidden rounded-2xl border border-blue-700 bg-gradient-to-br from-blue-800 via-blue-800 to-sky-700 text-white shadow-md">
        <div className="p-4 sm:p-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-sky-200">
            {matchMode ? "Match Center" : "Presenze allenamento"} · {eventCategoryName}
          </p>
          <h2 className="mt-2 text-2xl font-black tracking-tight sm:text-3xl">
            {matchMode ? (
              <>
                Comun Nuovo <span className="text-sky-200">vs</span> {opponent}
              </>
            ) : (
              eventTitle
            )}
          </h2>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-sky-100">
            <span>
              {formatConvocationWallClockDate(startAt)} · {formatConvocationWallClockTime(startAt)}
            </span>
            {matchMode ? <span className="font-semibold text-white">{venueLabel}</span> : null}
            {eventLocation ? (
              <span className="inline-flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5" />
                {eventLocation}
              </span>
            ) : null}
          </div>
        </div>
      </section>

      {/* Contatori live */}
      <section className="sticky top-0 z-30 -mx-1 rounded-2xl border border-blue-100 bg-white/95 p-3 shadow-sm backdrop-blur sm:static sm:mx-0 sm:p-4">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          <div className="rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-center">
            <p className="text-[10px] font-bold uppercase tracking-wide text-sky-800">Da gestire</p>
            <p className="text-2xl font-black text-blue-900">{summary.unset}</p>
          </div>
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-center">
            <p className="text-[10px] font-bold uppercase tracking-wide text-emerald-800">Presenti</p>
            <p className="text-2xl font-black text-emerald-900">{summary.PRESENT}</p>
          </div>
          <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-center">
            <p className="text-[10px] font-bold uppercase tracking-wide text-red-800">Assenti</p>
            <p className="text-2xl font-black text-red-900">{summary.ABSENT}</p>
          </div>
          <div className="rounded-xl border border-sky-200 bg-sky-50/80 px-3 py-2 text-center">
            <p className="text-[10px] font-bold uppercase tracking-wide text-sky-800">Giustificati</p>
            <p className="text-2xl font-black text-blue-900">{summary.JUSTIFIED_ABSENCE}</p>
          </div>
          <div className="col-span-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-center sm:col-span-1">
            <p className="text-[10px] font-bold uppercase tracking-wide text-slate-700">Infortunati</p>
            <p className="text-2xl font-black text-slate-900">{summary.INJURED}</p>
          </div>
        </div>

        {dirty ? (
          <div className="mt-3 flex items-start gap-2 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-950">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
            <p className="font-semibold">
              Modifiche non salvate. Tocca “Salva” in basso per confermare.
            </p>
          </div>
        ) : null}
      </section>

      {/* Riepilogo semplice */}
      <section className="rounded-2xl border border-blue-100 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold uppercase tracking-wide text-blue-800">Riepilogo</h3>
            <p className="mt-1 text-sm text-zinc-600">
              {presencePercent == null
                ? "Registra le presenze per vedere la percentuale."
                : `${presencePercent}% presenti tra i ${registeredCount} già registrati`}
            </p>
          </div>
          <div className="rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-center">
            <p className="text-[10px] font-bold uppercase tracking-wide text-sky-800">Presenza</p>
            <p className="text-xl font-black text-blue-900">
              {presencePercent == null ? "—" : `${presencePercent}%`}
            </p>
          </div>
        </div>
        <div className="mt-3">
          <p className="text-xs font-bold uppercase tracking-wide text-zinc-500">Chi manca oggi</p>
          {missingToday.length === 0 ? (
            <p className="mt-1 text-sm text-zinc-600">
              Nessun assente/giustificato/infortunato al momento.
            </p>
          ) : (
            <ul className="mt-2 flex flex-wrap gap-2">
              {missingToday.map((athlete) => {
                const status = statusByAthlete[athlete.id];
                return (
                  <li
                    key={athlete.id}
                    className="inline-flex items-center gap-2 rounded-full border border-blue-100 bg-sky-50 px-2.5 py-1 text-xs font-semibold text-blue-950"
                  >
                    <span>
                      {athlete.firstName} {athlete.lastName}
                    </span>
                    {status ? (
                      <span className="rounded-full bg-white px-1.5 py-0.5 text-[10px] font-bold uppercase text-zinc-600">
                        {SHORT_LABEL[status]}
                      </span>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </section>

      {matchMode && fourPeriodMode ? (
        <section className="rounded-2xl border border-blue-100 bg-white p-4 shadow-sm sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-bold uppercase tracking-wide text-blue-800">
              Risultato per tempi
            </h3>
            <span className="rounded-full border border-sky-200 bg-sky-50 px-2.5 py-0.5 text-[11px] font-bold text-sky-900">
              {periodsEnteredCount}/{FOUR_PERIOD_COUNT} tempi
            </span>
          </div>

          <div className="mt-4 space-y-4">
            {periods.map((period, index) => (
              <div
                key={index}
                className="rounded-2xl border border-sky-100 bg-sky-50/50 p-3 sm:p-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-bold uppercase tracking-wide text-blue-900">
                    {PERIOD_LABELS[index + 1]}
                  </p>
                  {period.entered ? (
                    <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-bold uppercase text-emerald-800">
                      Inserito
                    </span>
                  ) : (
                    <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-bold uppercase text-amber-800">
                      Da inserire
                    </span>
                  )}
                </div>

                <div className="mt-3 space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="min-w-0 flex-1 text-sm font-bold text-zinc-900">Comun Nuovo</p>
                    <TouchStepper
                      value={period.clubGoals}
                      aria-label={`Gol Comun Nuovo ${PERIOD_LABELS[index + 1]}`}
                      onChange={(value) =>
                        updatePeriod(index, {
                          clubGoals: value,
                          markEntered: !period.entered && value !== 0 ? true : undefined,
                          ...(value !== 0 || period.opponentGoals !== 0
                            ? { entered: true }
                            : {}),
                        })
                      }
                    />
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <p className="min-w-0 flex-1 truncate text-sm font-bold text-zinc-900">
                      {opponent}
                    </p>
                    <TouchStepper
                      value={period.opponentGoals}
                      aria-label={`Gol ${opponent} ${PERIOD_LABELS[index + 1]}`}
                      onChange={(value) =>
                        updatePeriod(index, {
                          opponentGoals: value,
                          ...(value !== 0 || period.clubGoals !== 0 ? { entered: true } : {}),
                        })
                      }
                    />
                  </div>
                </div>

                {!period.entered && period.clubGoals === 0 && period.opponentGoals === 0 ? (
                  <button
                    type="button"
                    onClick={() => updatePeriod(index, { entered: true, clubGoals: 0, opponentGoals: 0 })}
                    className="mt-3 min-h-11 w-full rounded-xl border border-blue-300 bg-white px-4 text-xs font-bold uppercase tracking-wide text-blue-900 hover:bg-sky-50 sm:w-auto"
                  >
                    Conferma 0-0
                  </button>
                ) : null}
              </div>
            ))}
          </div>

          <div className="mt-5 rounded-2xl border border-blue-100 bg-blue-50/60 p-4">
            {periodBreakdown.complete ? (
              <>
                <p className="text-[11px] font-bold uppercase tracking-wide text-blue-800">
                  Risultato finale per tempi
                </p>
                <p className="mt-1 text-xl font-black text-blue-950">
                  Comun Nuovo {periodBreakdown.finalClubPoints} - {periodBreakdown.finalOpponentPoints}{" "}
                  {opponent}
                </p>
              </>
            ) : (
              <>
                <p className="text-[11px] font-bold uppercase tracking-wide text-amber-800">
                  Parziale per tempi · {periodsEnteredCount}/{FOUR_PERIOD_COUNT}
                </p>
                <p className="mt-1 text-lg font-bold text-zinc-900">
                  Comun Nuovo {periodBreakdown.finalClubPoints} - {periodBreakdown.finalOpponentPoints}{" "}
                  {opponent}
                </p>
                <p className="mt-1 text-xs text-amber-800">
                  Manca almeno un tempo: il risultato Event resterà non inserito.
                </p>
              </>
            )}
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setIsHome(true)}
              className={`min-h-11 rounded-xl px-4 text-sm font-semibold ${
                isHome ? "bg-blue-800 text-white" : "border border-blue-200 bg-white text-blue-800"
              }`}
            >
              Casa
            </button>
            <button
              type="button"
              onClick={() => setIsHome(false)}
              className={`min-h-11 rounded-xl px-4 text-sm font-semibold ${
                !isHome ? "bg-blue-800 text-white" : "border border-blue-200 bg-white text-blue-800"
              }`}
            >
              Trasferta
            </button>
          </div>
        </section>
      ) : null}

      {matchMode && !fourPeriodMode ? (
        <section className="rounded-2xl border border-blue-100 bg-white p-4 shadow-sm sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-bold uppercase tracking-wide text-blue-800">Risultato</h3>
            {!resultEntered ? (
              <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-amber-800">
                Da inserire
              </span>
            ) : (
              <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-emerald-800">
                Inserito
              </span>
            )}
          </div>

          <div className="mt-4 space-y-4">
            <div className="flex items-center justify-between gap-3">
              <p className="min-w-0 flex-1 text-base font-bold text-zinc-900">Comun Nuovo</p>
              <TouchStepper
                value={clubScore}
                size="lg"
                aria-label="Gol Comun Nuovo"
                onChange={bumpClubScore}
              />
            </div>
            <div className="border-t border-blue-50" />
            <div className="flex items-center justify-between gap-3">
              <p className="min-w-0 flex-1 truncate text-base font-bold text-zinc-900">{opponent}</p>
              <TouchStepper
                value={opponentScore}
                size="lg"
                aria-label={`Gol ${opponent}`}
                onChange={bumpOpponentScore}
              />
            </div>
          </div>

          {!resultEntered && clubScore === 0 && opponentScore === 0 ? (
            <button
              type="button"
              onClick={() => setResultEntered(true)}
              className="mt-4 min-h-11 w-full rounded-xl border border-blue-300 bg-sky-50 px-4 text-sm font-bold uppercase tracking-wide text-blue-900 hover:bg-sky-100 sm:w-auto"
            >
              Conferma 0-0
            </button>
          ) : null}

          {resultEntered ? (
            <p className="mt-3 text-sm font-semibold text-zinc-800">
              Comun Nuovo {clubScore} - {opponentScore} {opponent}
            </p>
          ) : (
            <p className="mt-3 text-sm text-zinc-500">
              Il risultato non verrà salvato finché non lo inserisci o confermi 0-0.
            </p>
          )}

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setIsHome(true)}
              className={`min-h-11 rounded-xl px-4 text-sm font-semibold ${
                isHome ? "bg-blue-800 text-white" : "border border-blue-200 bg-white text-blue-800"
              }`}
            >
              Casa
            </button>
            <button
              type="button"
              onClick={() => setIsHome(false)}
              className={`min-h-11 rounded-xl px-4 text-sm font-semibold ${
                !isHome ? "bg-blue-800 text-white" : "border border-blue-200 bg-white text-blue-800"
              }`}
            >
              Trasferta
            </button>
          </div>
        </section>
      ) : null}

      <section className="rounded-2xl border border-blue-100 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h3 className="text-sm font-bold uppercase tracking-wide text-blue-800">Rosa</h3>
            <p className="mt-1 text-sm text-zinc-600">
              {summary.unset > 0
                ? `${summary.unset} da registrare · tap rapido sugli stati`
                : `${summary.PRESENT} presenti · ${summary.ABSENT + summary.JUSTIFIED_ABSENCE + summary.INJURED} non disponibili`}
            </p>
          </div>
          <p className="text-xs font-semibold text-zinc-500">
            {filteredAthletes.length}/{athletes.length} in elenco
          </p>
        </div>

        <div className="-mx-1 mt-3 flex gap-2 overflow-x-auto px-1 pb-1 sm:flex-wrap sm:overflow-visible">
          {filterChips.map((chip) => {
            const active = filter === chip.id;
            return (
              <button
                key={chip.id}
                type="button"
                onClick={() => setFilter(chip.id)}
                className={`inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-full border px-3 text-xs font-bold uppercase tracking-wide ${
                  active
                    ? "border-blue-700 bg-blue-800 text-white"
                    : "border-blue-100 bg-sky-50 text-blue-900"
                }`}
              >
                {chip.label}
                <span
                  className={`rounded-full px-1.5 py-0.5 text-[10px] ${
                    active ? "bg-white/20 text-white" : "bg-white text-blue-800"
                  }`}
                >
                  {chip.count}
                </span>
              </button>
            );
          })}
        </div>

        <ul className="mt-4 space-y-3 pb-28 md:grid md:grid-cols-2 md:gap-3 md:space-y-0 md:pb-4">
          {filteredAthletes.length === 0 ? (
            <li className="rounded-2xl border border-dashed border-blue-200 bg-sky-50/50 p-6 text-center text-sm text-zinc-600 md:col-span-2">
              Nessun giocatore in questo filtro.
            </li>
          ) : null}
          {filteredAthletes.map((athlete) => {
            const status = statusByAthlete[athlete.id] ?? null;
            const present = status === "PRESENT";
            const initials = athleteInitials(athlete.firstName, athlete.lastName);
            const attendanceSegment =
              currentDraftSnapshot.split("::")[0]?.replace(/^attendance:/, "") ?? "";
            const savedAttendanceSegment =
              savedDraftSnapshot.split("::")[0]?.replace(/^attendance:/, "") ?? "";
            const currentAthleteToken = attendanceSegment
              .split("|")
              .find((part) => part.startsWith(`${athlete.id}:`));
            const savedAthleteToken = savedAttendanceSegment
              .split("|")
              .find((part) => part.startsWith(`${athlete.id}:`));
            const dirtyRow = currentAthleteToken !== savedAthleteToken;

            return (
              <li
                key={athlete.id}
                className={`rounded-2xl border p-3 sm:p-4 ${
                  !status
                    ? "border-sky-200 bg-sky-50/50"
                    : dirtyRow
                      ? "border-sky-300 bg-sky-50/70 ring-1 ring-sky-200"
                      : "border-sky-100 bg-white"
                }`}
              >
                <div className="flex items-start gap-3">
                  <div
                    className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-base font-black tracking-wide text-white shadow-sm ${
                      status === "PRESENT"
                        ? "bg-emerald-600"
                        : status === "ABSENT"
                          ? "bg-red-600"
                          : status === "JUSTIFIED_ABSENCE"
                            ? "bg-sky-600"
                            : status === "INJURED"
                              ? "bg-slate-600"
                              : "bg-blue-800"
                    }`}
                    aria-hidden
                  >
                    {initials}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-base font-black leading-tight text-zinc-900 sm:text-lg">
                      {athlete.firstName}{" "}
                      <span className="text-blue-950">{athlete.lastName}</span>
                    </p>
                    <p className="mt-0.5 text-xs font-medium text-zinc-500">
                      {athlete.shirtNumber != null ? `#${athlete.shirtNumber}` : "Maglia —"}
                      {" · "}
                      {formatAthleteRoleDisplay(athlete.position)}
                    </p>
                    {!status ? (
                      <span className="mt-1 inline-flex rounded-full border border-amber-300 bg-amber-100 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-amber-900">
                        Da registrare
                      </span>
                    ) : (
                      <span
                        className={`mt-1 inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold ${
                          status === "PRESENT"
                            ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                            : status === "ABSENT"
                              ? "border-red-200 bg-red-50 text-red-800"
                              : status === "JUSTIFIED_ABSENCE"
                                ? "border-sky-200 bg-sky-50 text-sky-900"
                                : "border-slate-300 bg-slate-100 text-slate-800"
                        }`}
                      >
                        {ATTENDANCE_STATUS_LABEL[status]}
                      </span>
                    )}
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {ATTENDANCE_STATUS_CHOICES.map((choice) => {
                    const active = status === choice.value;
                    return (
                      <button
                        key={choice.value}
                        type="button"
                        onClick={() => setStatus(athlete.id, choice.value)}
                        className={`min-h-12 rounded-xl border px-2 text-[11px] font-bold uppercase tracking-wide transition sm:min-h-11 sm:text-xs ${
                          active ? CHIP_CLASS[choice.value] : CHIP_IDLE
                        }`}
                      >
                        {SHORT_LABEL[choice.value]}
                      </button>
                    );
                  })}
                </div>

                {matchMode ? (
                  <div className="mt-3 space-y-3 border-t border-blue-100/80 pt-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <p className="mb-1 text-[11px] font-bold uppercase tracking-wide text-zinc-500">
                          Gol
                        </p>
                        <TouchStepper
                          value={present ? (goalsByAthlete[athlete.id] ?? 0) : 0}
                          disabled={!present}
                          aria-label={`Gol ${athlete.firstName}`}
                          onChange={(value) =>
                            setGoalsByAthlete((prev) => ({ ...prev, [athlete.id]: value }))
                          }
                        />
                      </div>
                      <div>
                        <p className="mb-1 text-[11px] font-bold uppercase tracking-wide text-zinc-500">
                          Assist
                        </p>
                        <TouchStepper
                          value={present ? (assistsByAthlete[athlete.id] ?? 0) : 0}
                          disabled={!present}
                          aria-label={`Assist ${athlete.firstName}`}
                          onChange={(value) =>
                            setAssistsByAthlete((prev) => ({ ...prev, [athlete.id]: value }))
                          }
                        />
                      </div>
                    </div>

                    {isGoalkeeperRole(athlete.position) ? (
                      <div>
                        <p className="mb-1 text-[11px] font-bold uppercase tracking-wide text-zinc-500">
                          Gol subiti
                        </p>
                        {!present ? (
                          <p className="text-sm text-zinc-400">—</p>
                        ) : goalsConcededByAthlete[athlete.id] == null ? (
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-amber-800">
                              Da inserire
                            </span>
                            <button
                              type="button"
                              onClick={() =>
                                setGoalsConcededByAthlete((prev) => ({
                                  ...prev,
                                  [athlete.id]: 0,
                                }))
                              }
                              className="min-h-11 rounded-xl border border-blue-300 bg-white px-4 text-xs font-bold uppercase tracking-wide text-blue-900 hover:bg-sky-50"
                            >
                              Conferma 0
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                setGoalsConcededByAthlete((prev) => ({
                                  ...prev,
                                  [athlete.id]: 1,
                                }))
                              }
                              className="min-h-11 min-w-11 rounded-xl border border-zinc-300 bg-white text-sm font-bold text-zinc-800 hover:bg-zinc-50"
                              aria-label={`Imposta 1 gol subito ${athlete.firstName}`}
                            >
                              +
                            </button>
                          </div>
                        ) : (
                          <TouchStepper
                            value={goalsConcededByAthlete[athlete.id] ?? 0}
                            aria-label={`Gol subiti ${athlete.firstName}`}
                            onChange={(value) =>
                              setGoalsConcededByAthlete((prev) => ({
                                ...prev,
                                [athlete.id]: value,
                              }))
                            }
                          />
                        )}
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      </section>

      {feedback.error ? (
        <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">
          {feedback.error}
        </p>
      ) : null}
      {feedback.ok ? (
        <p className="inline-flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800">
          <CheckCircle2 className="h-4 w-4" />
          {feedback.ok}
        </p>
      ) : null}

      <div className="fixed inset-x-0 bottom-0 z-50 border-t border-blue-100 bg-white/95 p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] backdrop-blur md:static md:border-0 md:bg-transparent md:p-0 md:backdrop-blur-none">
        <div className="mx-auto flex w-full max-w-[1100px] flex-col gap-2 sm:flex-row sm:items-center">
          {dirty ? (
            <p className="text-center text-xs font-bold uppercase tracking-wide text-amber-700 sm:text-left">
              Modifiche non salvate
            </p>
          ) : (
            <p className="text-center text-xs font-semibold text-zinc-500 sm:text-left">
              {summary.unset > 0
                ? `${summary.unset} ancora da gestire`
                : "Tutto registrato"}
            </p>
          )}
          <button
            type="button"
            onClick={saveAttendance}
            disabled={pending || athletes.length === 0}
            className="flex min-h-12 flex-1 items-center justify-center rounded-xl bg-blue-800 px-4 text-sm font-bold uppercase tracking-wide text-white shadow-md transition hover:bg-blue-900 disabled:opacity-60 sm:ml-auto sm:max-w-sm"
          >
            {pending
              ? "Salvataggio..."
              : matchMode
                ? "Salva partita"
                : "Salva presenze"}
          </button>
        </div>
      </div>
    </div>
  );
}
