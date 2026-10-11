import Link from "next/link";
import { redirect } from "next/navigation";
import { AreaHeader } from "@/components/layout/area-header";
import { prisma } from "@/lib/prisma";
import { getAuthSession } from "@/lib/auth";
import {
  ATHLETE_ROSTER_STATUS_LABEL,
  parseAdminAthleteStatusFilter,
  rosterStatusWhereForAdminFilter,
  type AthleteRosterStatus,
} from "@/lib/athlete-roster-status";

const dateFormatter = new Intl.DateTimeFormat("it-IT", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

type AdminAthletesPageProps = {
  searchParams: Promise<{ q?: string; deleted?: string; status?: string }>;
};

type AthleteRow = {
  id: string;
  firstName: string;
  lastName: string;
  birthDate: Date;
  rosterStatus: AthleteRosterStatus;
  category: {
    id: string;
    name: string;
    seasonLabel: string;
    birthYearsLabel: string;
  };
};

type CategoryGroup = {
  category: AthleteRow["category"];
  athletes: AthleteRow[];
};

function groupAthletesByCategory(athletes: AthleteRow[]): CategoryGroup[] {
  const groups = new Map<string, CategoryGroup>();

  for (const athlete of athletes) {
    const existing = groups.get(athlete.category.id);
    if (existing) {
      existing.athletes.push(athlete);
      continue;
    }

    groups.set(athlete.category.id, {
      category: athlete.category,
      athletes: [athlete],
    });
  }

  return [...groups.values()]
    .map((group) => ({
      ...group,
      athletes: [...group.athletes].sort((a, b) => {
        const lastNameCompare = a.lastName.localeCompare(b.lastName, "it", { sensitivity: "base" });
        if (lastNameCompare !== 0) {
          return lastNameCompare;
        }
        return a.firstName.localeCompare(b.firstName, "it", { sensitivity: "base" });
      }),
    }))
    .sort((a, b) => {
      const nameCompare = a.category.name.localeCompare(b.category.name, "it", { sensitivity: "base" });
      if (nameCompare !== 0) {
        return nameCompare;
      }
      return a.category.seasonLabel.localeCompare(b.category.seasonLabel, "it", { sensitivity: "base" });
    });
}

function AthletesTable({ athletes }: { athletes: AthleteRow[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-blue-100 text-sm">
        <thead>
          <tr className="text-left text-xs uppercase tracking-wide text-blue-800">
            <th className="px-3 py-2 font-semibold">Nome</th>
            <th className="px-3 py-2 font-semibold">Cognome</th>
            <th className="px-3 py-2 font-semibold">Data di nascita</th>
            <th className="px-3 py-2 font-semibold">Stato</th>
            <th className="px-3 py-2 font-semibold">Azioni</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-blue-50 text-zinc-700">
          {athletes.map((athlete) => (
            <tr key={athlete.id}>
              <td className="px-3 py-2 font-medium text-zinc-900">{athlete.firstName}</td>
              <td className="px-3 py-2 font-medium text-zinc-900">{athlete.lastName}</td>
              <td className="px-3 py-2 whitespace-nowrap">
                {dateFormatter.format(new Date(athlete.birthDate))}
              </td>
              <td className="px-3 py-2">
                <span
                  className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-bold uppercase ${
                    athlete.rosterStatus === "ACTIVE"
                      ? "bg-emerald-50 text-emerald-900"
                      : "bg-amber-50 text-amber-900"
                  }`}
                >
                  {ATHLETE_ROSTER_STATUS_LABEL[athlete.rosterStatus]}
                </span>
              </td>
              <td className="px-3 py-2">
                <Link
                  href={`/admin/atleti/${athlete.id}`}
                  className="inline-flex items-center rounded-md border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-100"
                >
                  Dettaglio
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default async function AdminAthletesPage({ searchParams }: AdminAthletesPageProps) {
  const session = await getAuthSession();
  if (!session?.user) {
    redirect("/login?callbackUrl=/admin/atleti");
  }

  if (session.user.role !== "ADMIN" && session.user.role !== "YOUTH_DIRECTOR") {
    redirect("/unauthorized");
  }

  const params = await searchParams;
  const q = (params.q ?? "").trim();
  const showDeletedSuccess = params.deleted === "1";
  const statusFilter = parseAdminAthleteStatusFilter(params.status);
  const rosterWhere = rosterStatusWhereForAdminFilter(statusFilter);

  const athletes = await prisma.athlete.findMany({
    where: {
      ...rosterWhere,
      ...(q
        ? {
            OR: [
              { firstName: { contains: q, mode: "insensitive" as const } },
              { lastName: { contains: q, mode: "insensitive" as const } },
            ],
          }
        : {}),
    },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    select: {
      id: true,
      firstName: true,
      lastName: true,
      birthDate: true,
      rosterStatus: true,
      category: {
        select: {
          id: true,
          name: true,
          seasonLabel: true,
          birthYearsLabel: true,
        },
      },
    },
  });

  const categoryGroups = groupAthletesByCategory(athletes);

  const filterHref = (status: string) => {
    const search = new URLSearchParams();
    if (q) search.set("q", q);
    if (status !== "active") search.set("status", status);
    const qs = search.toString();
    return qs ? `/admin/atleti?${qs}` : "/admin/atleti";
  };

  return (
    <main className="min-h-screen bg-gradient-to-b from-sky-50 to-blue-100 p-4 md:p-8">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-4">
        <AreaHeader title="Atleti (Admin)" subtitle="Anagrafiche e documenti" userName={session.user.name ?? "Amministratore"} />

        {showDeletedSuccess ? (
          <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 shadow-sm">
            Atleta eliminato correttamente.
          </p>
        ) : null}

        <section className="rounded-xl border border-blue-100 bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm text-zinc-600">
                {athletes.length} atleta/i in {categoryGroups.length} categorie
              </p>
              <p className="mt-1 text-xs text-zinc-500">
                Filtro:{" "}
                {statusFilter === "active"
                  ? "Attivi"
                  : statusFilter === "withdrawn"
                    ? "Ritirati"
                    : "Tutti"}
                {q ? ` · ricerca “${q}”` : ""}
              </p>
            </div>

            <form method="get" className="flex w-full flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
              {statusFilter !== "active" ? (
                <input type="hidden" name="status" value={statusFilter} />
              ) : null}
              <input
                name="q"
                defaultValue={q}
                placeholder="Cerca per nome o cognome"
                className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm outline-none ring-blue-500 focus:ring-2 sm:w-72"
              />
              <button
                type="submit"
                className="inline-flex w-fit items-center justify-center rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-800"
              >
                Cerca
              </button>
              {q ? (
                <Link
                  href={filterHref(statusFilter)}
                  className="inline-flex w-fit items-center justify-center rounded-lg border border-blue-200 bg-white px-3 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-50"
                >
                  Reset
                </Link>
              ) : null}
            </form>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {(
              [
                ["active", "Attivi"],
                ["withdrawn", "Ritirati"],
                ["all", "Tutti"],
              ] as const
            ).map(([value, label]) => {
              const active = statusFilter === value;
              return (
                <Link
                  key={value}
                  href={filterHref(value)}
                  className={`inline-flex min-h-11 items-center rounded-xl px-4 text-sm font-bold ${
                    active
                      ? "bg-blue-800 text-white"
                      : "border border-blue-200 bg-white text-blue-800 hover:bg-sky-50"
                  }`}
                >
                  {label}
                </Link>
              );
            })}
          </div>

          {categoryGroups.length === 0 ? (
            <p className="mt-4 rounded-lg border border-zinc-200 bg-white p-4 text-sm text-zinc-700">
              Nessun atleta trovato.
            </p>
          ) : (
            <div className="mt-6 space-y-6">
              {categoryGroups.map((group) => (
                <section
                  key={group.category.id}
                  className="rounded-xl border border-blue-100 bg-sky-50/40 p-4"
                >
                  <div className="flex flex-col gap-1 border-b border-blue-100 pb-3 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                      <h2 className="text-base font-semibold text-zinc-900">
                        {group.category.name}{" "}
                        <span className="font-normal text-zinc-600">({group.category.seasonLabel})</span>
                      </h2>
                      <p className="text-xs text-zinc-500">{group.category.birthYearsLabel}</p>
                    </div>
                    <p className="text-sm font-medium text-blue-800">
                      {group.athletes.length} atleta/i
                    </p>
                  </div>

                  <div className="mt-4">
                    <AthletesTable athletes={group.athletes} />
                  </div>
                </section>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
