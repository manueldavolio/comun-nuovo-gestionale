import Link from "next/link";
import { redirect } from "next/navigation";
import type { Prisma, UserRole } from "@prisma/client";
import { Search, UserCog } from "lucide-react";
import { AdminBackLink } from "@/components/admin/admin-back-link";
import { AdminResetPasswordButton } from "@/components/admin/admin-reset-password-button";
import { ChangeUserRoleInline } from "./change-user-role-inline";
import { getAuthSession } from "@/lib/auth";
import { ADMIN_ASSIGNABLE_ROLES, ROLE_LABEL_IT } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

const ROLE_OPTIONS = ADMIN_ASSIGNABLE_ROLES;
const roleLabelMap = ROLE_LABEL_IT;

type AdminUsersPageProps = {
  searchParams?: Promise<{ q?: string; role?: string }>;
};

type AdminUserListItem = {
  id: string;
  name: string | null;
  email: string | null;
  role: UserRole | null;
  isActive: boolean;
};

function isUserRole(value: string): value is UserRole {
  return ROLE_OPTIONS.includes(value as UserRole);
}

function formatRole(role: UserRole | null): string {
  if (!role) return "—";
  return roleLabelMap[role] ?? role;
}

function roleBadgeClass(role: UserRole | null): string {
  switch (role) {
    case "ADMIN":
      return "bg-blue-900 text-white";
    case "YOUTH_DIRECTOR":
      return "bg-sky-700 text-white";
    case "COACH":
      return "bg-sky-100 text-sky-950 ring-1 ring-sky-200";
    case "PARENT":
      return "bg-blue-50 text-blue-900 ring-1 ring-blue-200";
    case "SOCIAL_MEDIA_MANAGER":
      return "bg-slate-100 text-slate-800 ring-1 ring-slate-200";
    default:
      return "bg-slate-100 text-slate-600 ring-1 ring-slate-200";
  }
}

async function getAdminUsers({
  q,
  role,
}: {
  q: string;
  role: UserRole | "";
}): Promise<AdminUserListItem[]> {
  const filters: Prisma.UserWhereInput[] = [];

  if (q) {
    filters.push({
      OR: [
        { name: { contains: q, mode: "insensitive" as const } },
        { email: { contains: q, mode: "insensitive" as const } },
      ],
    });
  }

  if (role) {
    filters.push({ role });
  }

  return prisma.user.findMany({
    where: filters.length > 0 ? { AND: filters } : undefined,
    orderBy: [{ name: "asc" }],
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      isActive: true,
    },
  });
}

export default async function AdminUsersPage({ searchParams }: AdminUsersPageProps) {
  const session = await getAuthSession();

  if (!session?.user) {
    redirect("/login?callbackUrl=/admin/utenti");
  }

  const canManageRoles = session.user.role === "ADMIN";
  if (!canManageRoles && session.user.role !== "YOUTH_DIRECTOR") {
    redirect("/unauthorized");
  }

  const params = searchParams ? await searchParams : {};
  const q = (params?.q ?? "").trim();
  const role = isUserRole(params?.role ?? "") ? (params?.role as UserRole) : "";

  const users = await getAdminUsers({ q, role });
  const activeCount = users.filter((user) => user.isActive).length;

  return (
    <main className="p-4 md:p-6 lg:p-8">
      <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-4 md:gap-5">
        <header className="overflow-hidden rounded-3xl border border-blue-800/30 bg-gradient-to-br from-blue-950 via-blue-900 to-sky-700 text-white shadow-lg shadow-blue-950/15">
          <div className="relative p-5 sm:p-6">
            <div
              className="pointer-events-none absolute -right-8 -top-10 h-40 w-40 rounded-full bg-sky-400/20 blur-2xl"
              aria-hidden
            />
            <div className="relative flex items-start gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/15 ring-1 ring-white/25">
                <UserCog className="h-6 w-6" aria-hidden />
              </div>
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-sky-200">
                  Amministrazione
                </p>
                <h1 className="mt-1 text-2xl font-black tracking-tight sm:text-3xl">Utenti</h1>
                <p className="mt-1 text-sm font-medium text-sky-100">
                  {users.length} utente{users.length === 1 ? "" : "i"} · {activeCount} attiv
                  {activeCount === 1 ? "o" : "i"}
                  {canManageRoles ? "" : " · sola lettura"}
                </p>
              </div>
            </div>
          </div>
        </header>

        <AdminBackLink />

        <section className="rounded-3xl border border-sky-100 bg-white/95 p-4 shadow-sm sm:p-5">
          <form method="get" className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <label className="relative min-w-0 flex-1">
              <span className="sr-only">Cerca utente</span>
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
              aria-label="Filtro ruolo"
              className="min-h-12 rounded-2xl border border-sky-200 bg-white px-3 text-sm font-semibold text-blue-950 outline-none ring-blue-500 focus:ring-2"
            >
              <option value="">Tutti i ruoli</option>
              {ROLE_OPTIONS.map((option) => (
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
                  href="/admin/utenti"
                  className="inline-flex min-h-12 items-center justify-center rounded-2xl border border-blue-200 bg-white px-4 text-sm font-bold text-blue-800 hover:bg-sky-50"
                >
                  Reset
                </Link>
              ) : null}
            </div>
          </form>
        </section>

        {users.length === 0 ? (
          <section className="rounded-3xl border border-dashed border-sky-200 bg-white/80 px-5 py-10 text-center shadow-sm">
            <UserCog className="mx-auto h-10 w-10 text-sky-300" aria-hidden />
            <h2 className="mt-3 text-lg font-black text-blue-950">Nessun utente trovato</h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-zinc-600">
              Nessun risultato con i filtri selezionati. Prova a cambiare ricerca o ruolo.
            </p>
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
                    <th className="px-4 py-3">Stato</th>
                    <th className="px-4 py-3">Azioni</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => (
                    <tr
                      key={user.id}
                      className="border-b border-sky-50 align-top transition last:border-0 hover:bg-sky-50/50"
                    >
                      <td className="px-4 py-3 font-bold text-blue-950">{user.name || "—"}</td>
                      <td className="px-4 py-3 text-zinc-600">{user.email || "—"}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-bold ${roleBadgeClass(user.role)}`}
                        >
                          {formatRole(user.role)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {user.isActive ? (
                          <span className="inline-flex rounded-full bg-sky-100 px-2.5 py-0.5 text-[11px] font-bold text-sky-900 ring-1 ring-sky-200">
                            Attivo
                          </span>
                        ) : (
                          <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-bold text-slate-700 ring-1 ring-slate-200">
                            Disattivato
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {user.role && canManageRoles ? (
                          <div className="flex max-w-sm flex-col gap-2">
                            <ChangeUserRoleInline userId={user.id} currentRole={user.role} />
                            <AdminResetPasswordButton userId={user.id} isActive={user.isActive} />
                          </div>
                        ) : (
                          <span className="text-xs font-medium text-zinc-500">
                            {user.role ? "Solo visualizzazione" : "Ruolo non disponibile"}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <ul className="grid gap-3 md:hidden">
              {users.map((user) => {
                const initials = (user.name ?? "?")
                  .split(/\s+/)
                  .filter(Boolean)
                  .slice(0, 2)
                  .map((part) => part.charAt(0).toUpperCase())
                  .join("");

                return (
                  <li key={user.id}>
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
                              {user.name || "Senza nome"}
                            </h2>
                            <span
                              className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-bold ${roleBadgeClass(user.role)}`}
                            >
                              {formatRole(user.role)}
                            </span>
                          </div>
                          <p className="mt-1 truncate text-sm text-zinc-600">{user.email || "—"}</p>
                          <p className="mt-2">
                            {user.isActive ? (
                              <span className="inline-flex rounded-full bg-sky-100 px-2.5 py-0.5 text-[11px] font-bold text-sky-900 ring-1 ring-sky-200">
                                Attivo
                              </span>
                            ) : (
                              <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-bold text-slate-700 ring-1 ring-slate-200">
                                Disattivato
                              </span>
                            )}
                          </p>
                        </div>
                      </div>

                      <div className="mt-4 border-t border-sky-100 pt-3">
                        {user.role && canManageRoles ? (
                          <div className="flex flex-col gap-2">
                            <ChangeUserRoleInline userId={user.id} currentRole={user.role} />
                            <AdminResetPasswordButton userId={user.id} isActive={user.isActive} />
                          </div>
                        ) : (
                          <p className="text-xs font-medium text-zinc-500">
                            {user.role ? "Solo visualizzazione" : "Ruolo non disponibile"}
                          </p>
                        )}
                      </div>
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
