import type { PersonalGoalStatus } from "@/lib/athlete-personal-goals";
import { personalGoalStatusLabel } from "@/lib/athlete-personal-goals";

type ParentGoalsCardProps = {
  goals: Array<{
    id: string;
    text: string;
    status: PersonalGoalStatus;
  }>;
};

function statusClasses(status: PersonalGoalStatus): string {
  if (status === "ACHIEVED") return "border-emerald-200 bg-emerald-50 text-emerald-900";
  if (status === "CONTINUE") return "border-amber-200 bg-amber-50 text-amber-950";
  return "border-sky-200 bg-sky-50 text-sky-950";
}

function statusDot(status: PersonalGoalStatus): string {
  if (status === "ACHIEVED") return "bg-emerald-500";
  if (status === "CONTINUE") return "bg-amber-400";
  return "bg-sky-500";
}

export function ParentGoalsCard({ goals }: ParentGoalsCardProps) {
  if (goals.length === 0) return null;

  return (
    <section className="rounded-2xl border border-blue-100 bg-white p-4 shadow-sm">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-blue-800">
        I tuoi obiettivi
      </p>
      <p className="mt-1 text-sm text-zinc-600">
        Percorso personale assegnato dal mister. Nessun voto, nessun confronto.
      </p>
      <ul className="mt-3 space-y-2">
        {goals.map((goal) => (
          <li
            key={goal.id}
            className={`rounded-2xl border px-3 py-3 ${statusClasses(goal.status)}`}
          >
            <div className="flex items-start gap-3">
              <span
                className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${statusDot(goal.status)}`}
                aria-hidden
              />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-zinc-900">{goal.text}</p>
                <p className="mt-1 text-xs font-bold uppercase tracking-wide">
                  {personalGoalStatusLabel(goal.status)}
                </p>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
