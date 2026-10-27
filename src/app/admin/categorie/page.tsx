import Link from "next/link";
import { redirect } from "next/navigation";
import { LayoutGrid, Plus, Search, Users } from "lucide-react";
import { AdminBackLink } from "@/components/admin/admin-back-link";
import { CategoryStatusToggleButton } from "@/components/categories/category-status-toggle-button";
import { getAuthSession } from "@/lib/auth";
import { categorySectorLabel, normalizeCategorySector } from "@/lib/category-sector";
import { prisma } from "@/lib/prisma";

const statusLabelMap = {
  all: "Tutte",
  active: "Attive",
  inactive: "Non attive",
} as const;

type StatusFilter = keyof typeof statusLabelMap;

function parseStatus(value: string | undefined): StatusFilter {
  if (value === "active" || value === "inactive") {
    return value;
  }

  return "all";
}

type AdminCategoriesPageProps = {
  searchParams: Promise<{ q?: string; status?: string }>;
};

export default async function AdminCategoriesPage({ searchParams }: AdminCategoriesPageProps) {
  const session = await getAuthSession();
  if (!session?.user) {
    redirect("/login?callbackUrl=/admin/categorie");
  }

  if (session.user.role !== "ADMIN") {
    redirect("/unauthorized");
  }

  const params = await searchParams;
  const q = (params.q ?? "").trim();
  const status = parseStatus(params.status);

  const categories = await prisma.category.findMany({
    where: {
      AND: [
        q
          ? {
              OR: [
                { name: { contains: q, mode: "insensitive" } },
                { birthYearsLabel: { contains: q, mode: "insensitive" } },
              ],
            }
          : {},
        status === "active" ? { isActive: true } : {},
        status === "inactive" ? { isActive: false } : {},
      ],
    },
    orderBy: [{ name: "asc" }],
    select: {
      id: true,
      name: true,
      birthYearsLabel: true,
      seasonLabel: true,
      isActive: true,
      sector: true,
      _count: {
        select: {
          athletes: true,
        },
      },
      coachAssignments: {
        orderBy: [{ coach: { lastName: "asc" } }, { coach: { firstName: "asc" } }],
        select: {
          coach: {
            select: {
              user: {
                select: {
                  name: true,
                },
              },
            },
          },
        },
      },
    },
  });

  const activeCount = categories.filter((c) => c.isActive).length;
  const athleteTotal = categories.reduce((sum, c) => sum + c._count.athletes, 0);

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
                  <LayoutGrid className="h-6 w-6" aria-hidden />
                </div>
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-sky-200">
                    Organizzazione sportiva
                  </p>
                  <h1 className="mt-1 text-2xl font-black tracking-tight sm:text-3xl">Categorie</h1>
                  <p className="mt-1 text-sm font-medium text-sky-100">
                    {categories.length} categor{categories.length === 1 ? "ia" : "ie"} · {activeCount}{" "}
                    attiv{activeCount === 1 ? "a" : "e"} · {athleteTotal} atleti in elenco
                  </p>
                </div>
              </div>
              <Link
                href="/admin/categorie/nuovo"
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-white px-4 text-sm font-bold text-blue-900 shadow-sm transition hover:bg-sky-50"
              >
                <Plus className="h-4 w-4" aria-hidden />
                Nuova categoria
              </Link>
            </div>
          </div>
        </header>

        <AdminBackLink />

        <section className="rounded-3xl border border-sky-100 bg-white/95 p-4 shadow-sm sm:p-5">
          <form method="get" className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <label className="relative min-w-0 flex-1">
              <span className="sr-only">Cerca categoria</span>
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-blue-400"
                aria-hidden
              />
              <input
                name="q"
                defaultValue={q}
                placeholder="Cerca nome o fascia annata"
                className="min-h-12 w-full rounded-2xl border border-sky-200 bg-sky-50/50 py-2.5 pl-10 pr-3 text-sm font-medium text-blue-950 outline-none ring-blue-500 placeholder:text-zinc-400 focus:bg-white focus:ring-2"
              />
            </label>
            <select
              name="status"
              defaultValue={status}
              aria-label="Filtro stato categoria"
              className="min-h-12 rounded-2xl border border-sky-200 bg-white px-3 text-sm font-semibold text-blue-950 outline-none ring-blue-500 focus:ring-2"
            >
              <option value="all">Tutte</option>
              <option value="active">Attive</option>
              <option value="inactive">Non attive</option>
            </select>
            <div className="flex flex-wrap gap-2">
              <button
                type="submit"
                className="inline-flex min-h-12 items-center justify-center rounded-2xl bg-blue-800 px-5 text-sm font-bold text-white transition hover:bg-blue-900"
              >
                Filtra
              </button>
              {q || status !== "all" ? (
                <Link
                  href="/admin/categorie"
                  className="inline-flex min-h-12 items-center justify-center rounded-2xl border border-blue-200 bg-white px-4 text-sm font-bold text-blue-800 hover:bg-sky-50"
                >
                  Reset
                </Link>
              ) : null}
            </div>
          </form>
          <p className="mt-3 text-xs font-medium text-zinc-500">
            Filtro: <span className="font-bold text-blue-900">{statusLabelMap[status]}</span>
            {q ? ` · ricerca “${q}”` : ""}
          </p>
        </section>

        {categories.length === 0 ? (
          <section className="rounded-3xl border border-dashed border-sky-200 bg-white/80 px-5 py-10 text-center shadow-sm">
            <LayoutGrid className="mx-auto h-10 w-10 text-sky-300" aria-hidden />
            <h2 className="mt-3 text-lg font-black text-blue-950">Nessuna categoria trovata</h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-zinc-600">
              Nessun risultato con i filtri selezionati. Prova a cambiare ricerca o stato.
            </p>
            <Link
              href="/admin/categorie/nuovo"
              className="mt-5 inline-flex min-h-11 items-center rounded-xl bg-blue-800 px-4 text-sm font-bold text-white hover:bg-blue-900"
            >
              Crea categoria
            </Link>
          </section>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {categories.map((category) => {
              const assignedCoaches = category.coachAssignments
                .map((assignment) => assignment.coach.user.name.trim())
                .filter(Boolean);
              const sector = normalizeCategorySector(category.sector);
              const sectorLabel = categorySectorLabel(sector);

              return (
                <li key={category.id}>
                  <article className="flex h-full flex-col rounded-3xl border border-sky-100 bg-white p-4 shadow-sm sm:p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h2 className="truncate text-lg font-black text-blue-950">{category.name}</h2>
                        <p className="mt-1 text-sm font-medium text-zinc-600">
                          {category.birthYearsLabel}
                        </p>
                        <p className="mt-0.5 text-xs font-medium text-zinc-500">
                          Stagione {category.seasonLabel}
                        </p>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1.5">
                        {category.isActive ? (
                          <span className="rounded-full bg-sky-100 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-sky-900 ring-1 ring-sky-200">
                            Attiva
                          </span>
                        ) : (
                          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-slate-700 ring-1 ring-slate-200">
                            Non attiva
                          </span>
                        )}
                        <span
                          className={
                            sector == null
                              ? "rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-amber-900 ring-1 ring-amber-200"
                              : sector === "FIRST_TEAM"
                                ? "rounded-full bg-indigo-50 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-indigo-900 ring-1 ring-indigo-200"
                                : "rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-emerald-900 ring-1 ring-emerald-200"
                          }
                        >
                          {sectorLabel}
                        </span>
                      </div>
                    </div>

                    <div className="mt-4 grid grid-cols-2 gap-2">
                      <div className="rounded-2xl border border-sky-100 bg-sky-50/60 px-3 py-2">
                        <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-blue-800/70">
                          Atleti
                        </p>
                        <p className="mt-1 flex items-center gap-1.5 text-xl font-black text-blue-950">
                          <Users className="h-4 w-4 text-sky-600" aria-hidden />
                          {category._count.athletes}
                        </p>
                      </div>
                      <div className="rounded-2xl border border-sky-100 bg-sky-50/60 px-3 py-2">
                        <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-blue-800/70">
                          Staff
                        </p>
                        <p className="mt-1 text-xl font-black text-blue-950">
                          {assignedCoaches.length}
                        </p>
                      </div>
                    </div>

                    <div className="mt-3 min-h-[2.5rem]">
                      <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-zinc-500">
                        Mister assegnati
                      </p>
                      <p className="mt-1 text-sm font-semibold text-blue-950">
                        {assignedCoaches.length > 0 ? assignedCoaches.join(", ") : "Nessuno"}
                      </p>
                    </div>

                    <div className="mt-auto flex flex-col gap-2 border-t border-sky-100 pt-4">
                      <Link
                        href={`/admin/categorie/${category.id}/modifica`}
                        className="inline-flex min-h-11 items-center justify-center rounded-xl bg-blue-800 px-3 text-sm font-bold text-white transition hover:bg-blue-900"
                      >
                        Modifica
                      </Link>
                      <CategoryStatusToggleButton
                        categoryId={category.id}
                        isActive={category.isActive}
                      />
                    </div>
                  </article>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </main>
  );
}
