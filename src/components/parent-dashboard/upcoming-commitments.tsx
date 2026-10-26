import Link from "next/link";
import { CalendarDays, MapPin, Shirt, Trophy } from "lucide-react";
import {
  formatConvocationWallClockDate,
  formatConvocationWallClockTime,
} from "@/lib/convocation-times";

type Commitment = {
  id: string;
  title: string;
  startAt: Date;
  location: string | null;
  opponentName?: string | null;
};

type UpcomingCommitmentsProps = {
  nextTraining: Commitment | null;
  nextMatch: Commitment | null;
};

function CommitmentCard({
  kind,
  item,
}: {
  kind: "training" | "match";
  item: Commitment;
}) {
  const isMatch = kind === "match";
  const Icon = isMatch ? Trophy : Shirt;
  const headline =
    isMatch && item.opponentName?.trim()
      ? `vs ${item.opponentName.trim()}`
      : item.title;

  return (
    <article
      className={[
        "relative overflow-hidden rounded-3xl border p-4 shadow-sm transition hover:shadow-md",
        isMatch
          ? "border-blue-200 bg-gradient-to-br from-blue-800 via-blue-800 to-sky-700 text-white"
          : "border-sky-200 bg-white text-blue-950",
      ].join(" ")}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p
            className={[
              "text-[11px] font-bold uppercase tracking-[0.14em]",
              isMatch ? "text-sky-200" : "text-sky-700",
            ].join(" ")}
          >
            {isMatch ? "Prossima partita" : "Prossimo allenamento"}
          </p>
          <h3 className="mt-1 text-lg font-black tracking-tight">{headline}</h3>
        </div>
        <span
          className={[
            "inline-flex h-11 w-11 items-center justify-center rounded-2xl",
            isMatch ? "bg-white/15 text-white" : "bg-sky-100 text-blue-800",
          ].join(" ")}
        >
          <Icon className="h-5 w-5" aria-hidden />
        </span>
      </div>

      <div
        className={[
          "mt-3 space-y-1.5 text-sm font-medium",
          isMatch ? "text-sky-50" : "text-zinc-600",
        ].join(" ")}
      >
        <p className="inline-flex items-center gap-2">
          <CalendarDays className="h-4 w-4 shrink-0 opacity-80" aria-hidden />
          {formatConvocationWallClockDate(item.startAt)} ·{" "}
          {formatConvocationWallClockTime(item.startAt)}
        </p>
        {item.location ? (
          <p className="inline-flex items-start gap-2">
            <MapPin className="mt-0.5 h-4 w-4 shrink-0 opacity-80" aria-hidden />
            <span>{item.location}</span>
          </p>
        ) : null}
      </div>
    </article>
  );
}

export function UpcomingCommitments({
  nextTraining,
  nextMatch,
}: UpcomingCommitmentsProps) {
  if (!nextTraining && !nextMatch) return null;

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-2 px-0.5">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-blue-800">
            Prossimi impegni
          </p>
          <p className="mt-0.5 text-sm text-zinc-600">Dal calendario della squadra</p>
        </div>
        <Link
          href="/genitore/calendario"
          className="inline-flex min-h-11 items-center rounded-xl border border-blue-200 bg-white px-3 text-sm font-bold text-blue-800 shadow-sm transition hover:bg-sky-50"
        >
          Calendario completo
        </Link>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {nextTraining ? (
          <CommitmentCard kind="training" item={nextTraining} />
        ) : (
          <div className="rounded-3xl border border-dashed border-sky-200 bg-sky-50/50 p-4 text-sm text-zinc-600">
            Nessun allenamento in programma.
          </div>
        )}
        {nextMatch ? (
          <CommitmentCard kind="match" item={nextMatch} />
        ) : (
          <div className="rounded-3xl border border-dashed border-blue-200 bg-blue-50/40 p-4 text-sm text-zinc-600">
            Nessuna partita in programma.
          </div>
        )}
      </div>
    </section>
  );
}
