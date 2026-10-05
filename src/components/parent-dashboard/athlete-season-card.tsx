import { Goal, Handshake, Percent, Shirt } from "lucide-react";
import type { SeasonAthleteStats } from "@/lib/parent-season";

type AthleteSeasonCardProps = {
  stats: SeasonAthleteStats;
};

export function AthleteSeasonCard({ stats }: AthleteSeasonCardProps) {
  const items = [
    {
      label: "Presenze partite",
      value: String(stats.matchPresences),
      icon: Shirt,
      tone: "border-blue-200 bg-blue-50",
      iconTone: "bg-blue-700 text-white",
      valueTone: "text-blue-800",
    },
    {
      label: "Gol",
      value: String(stats.goals),
      icon: Goal,
      tone: "border-sky-200 bg-sky-50",
      iconTone: "bg-sky-600 text-white",
      valueTone: "text-sky-900",
    },
    {
      label: "Assist",
      value: String(stats.assists),
      icon: Handshake,
      tone: "border-slate-200 bg-slate-50",
      iconTone: "bg-slate-700 text-white",
      valueTone: "text-slate-900",
    },
    {
      label: "Allenamenti %",
      value: stats.trainingPercent == null ? "—" : `${stats.trainingPercent}%`,
      icon: Percent,
      tone: "border-emerald-200 bg-emerald-50",
      iconTone: "bg-emerald-700 text-white",
      valueTone: "text-emerald-900",
      hint:
        stats.trainingMarked > 0
          ? `${stats.trainingPresent}/${stats.trainingMarked}`
          : null,
    },
  ];

  return (
    <section className="rounded-2xl border border-blue-100 bg-white p-4 shadow-sm">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-blue-800">
        La mia stagione
      </p>
      <p className="mt-1 text-sm text-zinc-600">I tuoi numeri, senza confronti.</p>
      <div className="mt-3 grid grid-cols-2 gap-2.5">
        {items.map((kpi) => {
          const Icon = kpi.icon;
          return (
            <div key={kpi.label} className={`rounded-2xl border px-3 py-3 ${kpi.tone}`}>
              <span
                className={`inline-flex h-8 w-8 items-center justify-center rounded-xl ${kpi.iconTone}`}
              >
                <Icon className="h-4 w-4" aria-hidden />
              </span>
              <p className={`mt-2 text-3xl font-black tracking-tight ${kpi.valueTone}`}>
                {kpi.value}
              </p>
              <p className="mt-0.5 text-[11px] font-semibold uppercase tracking-wide text-zinc-600">
                {kpi.label}
              </p>
              {"hint" in kpi && kpi.hint ? (
                <p className="mt-1 text-[11px] font-medium text-emerald-800">
                  Allenamenti: {kpi.hint}
                </p>
              ) : null}
            </div>
          );
        })}
      </div>
    </section>
  );
}
