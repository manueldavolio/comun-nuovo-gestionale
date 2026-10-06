import type { GrowthPathMilestone } from "@/lib/my-comun-nuovo/achievements";

type AthleteGrowthPathSectionProps = {
  reached: GrowthPathMilestone[];
  next: GrowthPathMilestone[];
};

export function AthleteGrowthPathSection({
  reached,
  next,
}: AthleteGrowthPathSectionProps) {
  if (reached.length === 0 && next.length === 0) return null;

  return (
    <section className="rounded-2xl border border-sky-100 bg-white p-4 shadow-sm">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-blue-800">
        Il mio percorso
      </p>
      <p className="mt-1 text-sm text-zinc-600">
        Traguardi personali di presenza e crescita. Solo il tuo cammino.
      </p>

      {reached.length > 0 ? (
        <div className="mt-4">
          <p className="text-xs font-bold uppercase tracking-wide text-emerald-800">
            Raggiunti
          </p>
          <ol className="mt-2 space-y-2">
            {reached.map((item, index) => (
              <li
                key={item.id}
                className="flex items-start gap-3 rounded-2xl border border-emerald-100 bg-emerald-50/60 px-3 py-2.5"
              >
                <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-xs font-bold text-emerald-900">
                  {index + 1}
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-zinc-900">{item.label}</p>
                  <p className="text-xs font-semibold text-emerald-800">Raggiunto ✓</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      ) : null}

      {next.length > 0 ? (
        <div className={reached.length > 0 ? "mt-4" : "mt-4"}>
          <p className="text-xs font-bold uppercase tracking-wide text-blue-800">
            Prossimi traguardi
          </p>
          <ul className="mt-2 space-y-2">
            {next.map((item) => (
              <li
                key={item.id}
                className="rounded-2xl border border-sky-100 bg-sky-50/70 px-3 py-2.5"
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-zinc-900">{item.label}</p>
                  {item.progressLabel ? (
                    <span className="shrink-0 rounded-full border border-blue-100 bg-white px-2.5 py-1 text-xs font-bold tabular-nums text-blue-800">
                      {item.progressLabel}
                    </span>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
