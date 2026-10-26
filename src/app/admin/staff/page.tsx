import Link from "next/link";
import { redirect } from "next/navigation";
import type { UserRole } from "@prisma/client";
import { Plus, Search, UserRound } from "lucide-react";
import { AdminBackLink } from "@/components/admin/admin-back-link";
import { getAuthSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { STAFF_ROLE_OPTIONS, roleLabelMap, splitFullName } from "@/lib/staff";

type AdminStaffPageProps = {
  searchParams: Promise<{ q?: string; role?: string }>;
};

function roleBadgeClass(role: UserRole) {
  switch (role) {
    case "ADMIN":
      return "bg-blue-900 text-white";
    case "YOUTH_DIRECTOR":
      return "bg-sky-700 text-white";
    case "COACH":
      return "bg-sky-100 text-sky-950 ring-1 ring-sky-200";
    default:
      return "bg-slate-100 text-slate-800 ring-1 ring-slate-200";
  }
}

export default async function AdminStaffPage({ searchParams }: AdminStaffPageProps) {
  const session = await getAuthSession();
  if (!session?.user) {
    redirect("/login?callbackUrl=/admin/staff");
  }

  if (session.user.role !== "ADMIN") {
    redirect("/unauthorized");
  }

  const params = await searchParams;
  const q = (params.q ?? "").trim();
  const role = STAFF_ROLE_OPTIONS.includes(params.role as UserRole) ? (params.role as UserRole) : "";

  const staff = await prisma.user.findMany({
    where: {
      AND: [
        {
          role: {
            in: STAFF_ROLE_OPTIONS,
          },
        },
        q
          ? {
              OR: [
                { name: { contains: q, mode: "insensitive" } },
                { email: { contains: q, mode: "insensitive" } },
              ],
            }
          : {},
        role ? { role } : {},
      ],
    },
    orderBy: [{ name: "asc" }],
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      coachProfile: {
        select: {
          firstName: true,
          lastName: true,
          categoryAssignments: {
            orderBy: [{ category: { name: "asc" } }],
            select: {
              category: {
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
                  <UserRound className="h-6 w-6" aria-hidden />
                </div>
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-sky-200">
                    Organizzazione tecnica
                  </p>
                  <h1 className="mt-1 text-2xl font-black tracking-tight sm:text-3xl">Staff</h1>
                  <p className="mt-1 text-sm font-medium text-sky-100">
                    {staff.length} profilo{staff.length === 1 ? "" : "i"} · admin, direzione e mister
                  </p>
                </div>
              </div>
              <Link
                href="/admin/staff/nuovo"
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-white px-4 text-sm font-bold text-blue-900 shadow-sm transition hover:bg-sky-50"
              >
                <Plus className="h-4 w-4" aria-hidden />
                Nuovo membro
              </Link>
            </div>
          </div>
        </header>

        <AdminBackLink />

        <section className="rounded-3xl border border-sky-100 bg-white/95 p-4 shadow-sm sm:p-5">
          <form method="get" className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <label className="relative min-w-0 flex-1">
              <span className="sr-only">Cerca staff</span>
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-blue-400"
                aria-hidden
              />
              <input
                name="q"
                defaultValue={q}
                placeholder="Cerca nome o email"
                className="min-h-12 w-full rounded-2xl border border-sky-200 bg-sky-50/50 py-2.5 pl-10 pr-3 text-sm font-medium text-blue-950 outline-none ring-blue-500 placeholder:text-zinc-400 focus:bg-white focus:ring-2"
              />
            </label>
            <select
              name="role"
              defaultValue={role}
              aria-label="Filtro ruolo staff"
              className="min-h-12 rounded-2xl border border-sky-200 bg-white px-3 text-sm font-semibold text-blue-950 outline-none ring-blue-500 focus:ring-2"
            >
              <option value="">Tutti i ruoli staff</option>
              {STAFF_ROLE_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {roleLabelMap[option]}
                </option>
              ))}
            </select>
            <div className="flex flex-wrap gap-2">
              <button
                type="submit"
                className="inline-flex min-h-12 items-center justify-center rounded-2xl bg-blue-800 px-5 text-sm font-bold text-white transition hover:bg-blue-900"
              >
                Filtra
              </button>
              {q || role ? (
                <Link
                  href="/admin/staff"
                  className="inline-flex min-h-12 items-center justify-center rounded-2xl border border-blue-200 bg-white px-4 text-sm font-bold text-blue-800 hover:bg-sky-50"
                >
                  Reset
                </Link>
              ) : null}
            </div>
          </form>
        </section>

        {staff.length === 0 ? (
          <section className="rounded-3xl border border-dashed border-sky-200 bg-white/80 px-5 py-10 text-center shadow-sm">
            <UserRound className="mx-auto h-10 w-10 text-sky-300" aria-hidden />
            <h2 className="mt-3 text-lg font-black text-blue-950">Nessun profilo staff trovato</h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-zinc-600">
              Nessun risultato con i filtri selezionati.
            </p>
            <Link
              href="/admin/staff/nuovo"
              className="mt-5 inline-flex min-h-11 items-center rounded-xl bg-blue-800 px-4 text-sm font-bold text-white hover:bg-blue-900"
            >
              Nuovo membro staff
            </Link>
          </section>
        ) : (
          <>
            <div className="hidden overflow-hidden rounded-3xl border border-sky-100 bg-white shadow-sm md:block">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-sky-100 bg-sky-50/50 text-left text-[11px] font-bold uppercase tracking-[0.12em] text-blue-800/70">
                    <th className="px-4 py-3">Nome</th>
                    <th className="px-4 py-3">Email</th>
                    <th className="px-4 py-3">Ruolo</th>
                    <th className="px-4 py-3">Categorie</th>
                    <th className="px-4 py-3 text-right">Azioni</th>
                  </tr>
                </thead>
                <tbody>
                  {staff.map((staffUser) => {
                    const fallbackName = splitFullName(staffUser.name);
                    const fullName = `${staffUser.coachProfile?.firstName || fallbackName.firstName} ${
                      staffUser.coachProfile?.lastName || fallbackName.lastName
                    }`.trim();
                    const assignedCategories =
                      staffUser.coachProfile?.categoryAssignments.map(
                        (assignment) => assignment.category.name,
                      ) ?? [];

                    return (
                      <tr
                        key={staffUser.id}
                        className="border-b border-sky-50 transition last:border-0 hover:bg-sky-50/60"
                      >
                        <td className="px-4 py-3 font-bold text-blue-950">
                          {fullName || staffUser.name}
                        </td>
                        <td className="px-4 py-3 text-zinc-600">{staffUser.email}</td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-bold ${roleBadgeClass(staffUser.role)}`}
                          >
                            {roleLabelMap[staffUser.role]}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-zinc-700">
                          {assignedCategories.length > 0 ? assignedCategories.join(", ") : "—"}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Link
                            href={`/admin/staff/${staffUser.id}/modifica`}
                            className="inline-flex min-h-10 items-center rounded-xl border border-blue-200 bg-white px-3 text-xs font-bold text-blue-800 hover:bg-blue-50"
                          >
                            Modifica
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <ul className="grid gap-3 md:hidden">
              {staff.map((staffUser) => {
                const fallbackName = splitFullName(staffUser.name);
                const fullName = `${staffUser.coachProfile?.firstName || fallbackName.firstName} ${
                  staffUser.coachProfile?.lastName || fallbackName.lastName
                }`.trim();
                const assignedCategories =
                  staffUser.coachProfile?.categoryAssignments.map(
                    (assignment) => assignment.category.name,
                  ) ?? [];
                const initials = (fullName || staffUser.name)
                  .split(/\s+/)
                  .filter(Boolean)
                  .slice(0, 2)
                  .map((part) => part.charAt(0).toUpperCase())
                  .join("");

                return (
                  <li key={staffUser.id}>
                    <article className="rounded-3xl border border-sky-100 bg-white p-4 shadow-sm">
                      <div className="flex items-start gap-3">
                        <div
                          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-sky-100 text-sm font-black text-blue-900"
                          aria-hidden
                        >
                          {initials || "?"}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <h2 className="text-base font-black text-blue-950">
                              {fullName || staffUser.name}
                            </h2>
                            <span
                              className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-bold ${roleBadgeClass(staffUser.role)}`}
                            >
                              {roleLabelMap[staffUser.role]}
                            </span>
                          </div>
                          <p className="mt-1 truncate text-sm text-zinc-600">{staffUser.email}</p>
                          <p className="mt-2 text-[10px] font-bold uppercase tracking-[0.12em] text-zinc-500">
                            Categorie
                          </p>
                          <p className="mt-1 text-sm font-semibold text-blue-950">
                            {assignedCategories.length > 0
                              ? assignedCategories.join(", ")
                              : "Nessuna assegnazione"}
                          </p>
                        </div>
                      </div>
                      <Link
                        href={`/admin/staff/${staffUser.id}/modifica`}
                        className="mt-4 inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-blue-800 px-4 text-sm font-bold text-white hover:bg-blue-900"
                      >
                        Modifica
                      </Link>
                    </article>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </div>
    </main>
  );
}
