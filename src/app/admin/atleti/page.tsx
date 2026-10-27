import Link from "next/link";
import { redirect } from "next/navigation";
import { Search, Users } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getAuthSession } from "@/lib/auth";
import {
  ATHLETE_ROSTER_STATUS_LABEL,
  parseAdminAthleteStatusFilter,
  rosterStatusWhereForAdminFilter,
  type AthleteRosterStatus,
} from "@/lib/athlete-roster-status";
import { athleteListWhereForAdminRole } from "@/lib/youth-director-data-access";

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

function RosterBadge({ status }: { status: AthleteRosterStatus }) {
  const active = status === "ACTIVE";
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide ${
        active
          ? "bg-sky-100 text-sky-900 ring-1 ring-sky-200"
          : "bg-slate-100 text-slate-700 ring-1 ring-slate-200"
      }`}
    >
      {ATHLETE_ROSTER_STATUS_LABEL[status]}
    </span>
  );
}

function AthletesDesktopTable({ athletes }: { athletes: AthleteRow[] }) {
  return (
    <div className="hidden overflow-x-auto md:block">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="border-b border-sky-100 text-left text-[11px] font-bold uppercase tracking-[0.12em] text-blue-800/70">
            <th className="px-4 py-3">Atleta</th>
            <th className="px-4 py-3">Data di nascita</th>
            <th className="px-4 py-3">Stato</th>
            <th className="px-4 py-3 text-right">Azioni</th>
          </tr>
        </thead>
        <tbody>
          {athletes.map((athlete) => (
            <tr
              key={athlete.id}
              className="group border-b border-sky-50 transition last:border-0 hover:bg-sky-50/70"
            >
              <td className="px-4 py-3">
                <Link
                  href={`/admin/atleti/${athlete.id}`}
                  className="block font-bold text-blue-950 group-hover:text-blue-800"
                >
                  {athlete.lastName} {athlete.firstName}
                </Link>
              </td>
              <td className="px-4 py-3 whitespace-nowrap text-zinc-600">
                {dateFormatter.format(new Date(athlete.birthDate))}
              </td>
              <td className="px-4 py-3">
                <RosterBadge status={athlete.rosterStatus} />
              </td>
              <td className="px-4 py-3 text-right">
                <Link
                  href={`/admin/atleti/${athlete.id}`}
                  className="inline-flex min-h-10 items-center rounded-xl border border-blue-200 bg-white px-3 text-xs font-bold text-blue-800 transition hover:bg-blue-50"
                >
                  Apri scheda
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AthletesMobileCards({
  athletes,
  categoryName,
}: {
  athletes: AthleteRow[];
  categoryName: string;
}) {
  return (
    <ul className="grid gap-3 md:hidden">
      {athletes.map((athlete) => (
        <li key={athlete.id}>
          <article className="rounded-2xl border border-sky-100 bg-white p-4 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-base font-black text-blue-950">
                  {athlete.lastName} {athlete.firstName}
                </p>
                <p className="mt-1 text-sm text-zinc-600">{categoryName}</p>
                <p className="mt-0.5 text-xs font-medium text-zinc-500">
                  Nato il {dateFormatter.format(new Date(athlete.birthDate))}
                </p>
              </div>
              <RosterBadge status={athlete.rosterStatus} />
            </div>
            <Link
              href={`/admin/atleti/${athlete.id}`}
              className="mt-4 inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-blue-800 px-4 text-sm font-bold text-white transition hover:bg-blue-900"
            >
              Apri scheda
            </Link>
          </article>
        </li>
      ))}
    </ul>
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
  const roleScopeWhere = athleteListWhereForAdminRole(session.user.role);
  if (!roleScopeWhere) {
    redirect("/unauthorized");
  }

  const athletes = await prisma.athlete.findMany({
    where: {
      AND: [
        roleScopeWhere,
        rosterWhere,
        ...(q
          ? [
              {
                OR: [
                  { firstName: { contains: q, mode: "insensitive" as const } },
                  { lastName: { contains: q, mode: "insensitive" as const } },
                ],
              },
            ]
          : []),
      ],
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

  const statusLabel =
    statusFilter === "active" ? "Attivi" : statusFilter === "withdrawn" ? "Ritirati" : "Tutti";

  return (
    <main className="p-4 md:p-6 lg:p-8">
      <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-4 md:gap-5">
        <header className="overflow-hidden rounded-3xl border border-blue-800/30 bg-gradient-to-br from-blue-950 via-blue-900 to-sky-700 text-white shadow-lg shadow-blue-950/15">
          <div className="relative p-5 sm:p-6">
            <div
              className="pointer-events-none absolute -right-8 -top-10 h-40 w-40 rounded-full bg-sky-400/20 blur-2xl"
              aria-hidden
            />
            <div className="relative flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div className="flex items-start gap-3">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/15 ring-1 ring-white/25">
                  <Users className="h-6 w-6" aria-hidden />
                </div>
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-sky-200">
                    Anagrafica sportiva
                  </p>
                  <h1 className="mt-1 text-2xl font-black tracking-tight sm:text-3xl">Atleti</h1>
                  <p className="mt-1 text-sm font-medium text-sky-100">
                    {athletes.length} atleta{athletes.length === 1 ? "" : "i"} ·{" "}
                    {categoryGroups.length} categor{categoryGroups.length === 1 ? "ia" : "ie"} ·{" "}
                    filtro {statusLabel}
                    {q ? ` · “${q}”` : ""}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </header>

        {showDeletedSuccess ? (
          <p className="rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm font-medium text-sky-950 shadow-sm">
            Atleta eliminato correttamente.
          </p>
        ) : null}

        <section className="rounded-3xl border border-sky-100 bg-white/95 p-4 shadow-sm sm:p-5">
          <form method="get" className="flex flex-col gap-3 sm:flex-row sm:items-center">
            {statusFilter !== "active" ? (
              <input type="hidden" name="status" value={statusFilter} />
            ) : null}
            <label className="relative min-w-0 flex-1">
              <span className="sr-only">Cerca atleta</span>
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-blue-400"
                aria-hidden
              />
              <input
                name="q"
                defaultValue={q}
                placeholder="Cerca per nome o cognome"
                className="min-h-12 w-full rounded-2xl border border-sky-200 bg-sky-50/50 py-2.5 pl-10 pr-3 text-sm font-medium text-blue-950 outline-none ring-blue-500 placeholder:text-zinc-400 focus:bg-white focus:ring-2"
              />
            </label>
            <div className="flex flex-wrap gap-2">
              <button
                type="submit"
                className="inline-flex min-h-12 items-center justify-center rounded-2xl bg-blue-800 px-5 text-sm font-bold text-white transition hover:bg-blue-900"
              >
                Cerca
              </button>
              {q ? (
                <Link
                  href={filterHref(statusFilter)}
                  className="inline-flex min-h-12 items-center justify-center rounded-2xl border border-blue-200 bg-white px-4 text-sm font-bold text-blue-800 hover:bg-sky-50"
                >
                  Reset
                </Link>
              ) : null}
            </div>
          </form>

          <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label="Filtro stato rosa">
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
                  className={`inline-flex min-h-11 items-center rounded-full px-4 text-sm font-bold transition ${
                    active
                      ? "bg-blue-900 text-white shadow-sm"
                      : "border border-sky-200 bg-white text-blue-900 hover:bg-sky-50"
                  }`}
                >
                  {label}
                </Link>
              );
            })}
          </div>
        </section>

        {categoryGroups.length === 0 ? (
          <section className="rounded-3xl border border-dashed border-sky-200 bg-white/80 px-5 py-10 text-center shadow-sm">
            <Users className="mx-auto h-10 w-10 text-sky-300" aria-hidden />
            <h2 className="mt-3 text-lg font-black text-blue-950">Nessun atleta trovato</h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-zinc-600">
              {q
                ? `Nessun risultato per “${q}” con filtro “${statusLabel}”. Prova a cambiare ricerca o filtro.`
                : `Non ci sono atleti per il filtro “${statusLabel}”.`}
            </p>
            {q || statusFilter !== "active" ? (
              <Link
                href="/admin/atleti"
                className="mt-5 inline-flex min-h-11 items-center rounded-xl bg-blue-800 px-4 text-sm font-bold text-white hover:bg-blue-900"
              >
                Mostra atleti attivi
              </Link>
            ) : null}
          </section>
        ) : (
          <div className="space-y-4">
            {categoryGroups.map((group) => (
              <section
                key={group.category.id}
                className="overflow-hidden rounded-3xl border border-sky-100 bg-white shadow-sm"
              >
                <div className="flex flex-col gap-1 border-b border-sky-100 bg-gradient-to-r from-sky-50 to-white px-4 py-3 sm:flex-row sm:items-end sm:justify-between sm:px-5">
                  <div>
                    <h2 className="text-base font-black text-blue-950">
                      {group.category.name}{" "}
                      <span className="font-semibold text-sky-800">
                        · {group.category.seasonLabel}
                      </span>
                    </h2>
                    <p className="text-xs font-medium text-zinc-500">
                      {group.category.birthYearsLabel}
                    </p>
                  </div>
                  <p className="text-sm font-bold text-blue-800">
                    {group.athletes.length} atleta{group.athletes.length === 1 ? "" : "i"}
                  </p>
                </div>

                <AthletesDesktopTable athletes={group.athletes} />
                <div className="p-3 md:hidden">
                  <AthletesMobileCards
                    athletes={group.athletes}
                    categoryName={group.category.name}
                  />
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
