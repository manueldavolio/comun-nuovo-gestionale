import Link from "next/link";
import { redirect } from "next/navigation";
import type { Prisma, UserRole } from "@prisma/client";
import { AreaHeader } from "@/components/layout/area-header";
import { ChangeUserRoleInline } from "./change-user-role-inline";
import { getAuthSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const ROLE_OPTIONS: UserRole[] = ["ADMIN", "YOUTH_DIRECTOR", "COACH", "PARENT"];

const roleLabelMap: Record<UserRole, string> = {
  ADMIN: "Admin",
  YOUTH_DIRECTOR: "Direttore settore giovanile",
  COACH: "Mister",
  PARENT: "Genitore",
};

type AdminUsersPageProps = {
  searchParams?: Promise<{ q?: string; role?: string }>;
};

type AdminUserListItem = {
  id: string;
  name: string | null;
  email: string | null;
  role: UserRole | null;
};

function isUserRole(value: string): value is UserRole {
  return ROLE_OPTIONS.includes(value as UserRole);
}

function formatRole(role: UserRole | null): string {
  if (!role) return "-";
  return roleLabelMap[role] ?? role;
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
    },
  });
}

export default async function AdminUsersPage({ searchParams }: AdminUsersPageProps) {
  const session = await getAuthSession();

  if (!session?.user) {
    redirect("/login?callbackUrl=/admin/utenti");
  }

  if (session.user.role !== "ADMIN") {
    redirect("/unauthorized");
  }

  const params = searchParams ? await searchParams : {};
  const q = (params?.q ?? "").trim();
  const role = isUserRole(params?.role ?? "") ? (params?.role as UserRole) : "";

  const users = await getAdminUsers({ q, role });

  return (
    <main className="min-h-screen bg-gradient-to-b from-sky-50 to-blue-100 p-4 md:p-8">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-4">
        <AreaHeader
          title="Utenti (Admin)"
          subtitle="Elenco utenti piattaforma"
          userName={session.user.name ?? "Amministratore"}
        />

        <section className="rounded-xl border border-blue-100 bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm text-zinc-600">{users.length} utente/i</p>
              <p className="mt-1 text-xs text-zinc-500">
                Cerca per nome o email, con filtro ruolo opzionale.
              </p>
            </div>

            <form method="get" className="flex w-full flex-col gap-2 md:w-auto md:flex-row md:items-center">
              <input
                name="q"
                defaultValue={q}
                placeholder="Cerca nome o email"
                className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm outline-none ring-blue-500 focus:ring-2 md:w-64"
              />

              <select
                name="role"
                defaultValue={role}
                className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm outline-none ring-blue-500 focus:ring-2"
              >
                <option value="">Tutti i ruoli</option>
                {ROLE_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {roleLabelMap[option]}
                  </option>
                ))}
              </select>

              <button
                type="submit"
                className="inline-flex items-center justify-center rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-800"
              >
                Filtra
              </button>

              {(q || role) && (
                <Link
                  href="/admin/utenti"
                  className="inline-flex items-center justify-center rounded-lg border border-blue-200 bg-white px-3 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-50"
                >
                  Reset
                </Link>
              )}
            </form>
          </div>

          {users.length === 0 ? (
            <p className="mt-4 rounded-lg border border-zinc-200 bg-white p-4 text-sm text-zinc-700">
              Nessun utente trovato con i filtri selezionati.
            </p>
          ) : (
            <div className="mt-4 overflow-x-auto">
              <table className="min-w-full divide-y divide-blue-100 text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wide text-blue-800">
                    <th className="px-3 py-2 font-semibold">Nome</th>
                    <th className="px-3 py-2 font-semibold">Email</th>
                    <th className="px-3 py-2 font-semibold">Ruolo</th>
                    <th className="px-3 py-2 font-semibold">Azioni</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-blue-50 text-zinc-700">
                  {users.map((user) => (
                    <tr key={user.id}>
                      <td className="px-3 py-2 font-medium text-zinc-900">{user.name || "-"}</td>
                      <td className="px-3 py-2">{user.email || "-"}</td>
                      <td className="px-3 py-2">{formatRole(user.role)}</td>
                      <td className="px-3 py-2">
                        {user.role ? (
                          <ChangeUserRoleInline userId={user.id} currentRole={user.role} />
                        ) : (
                          <span className="text-xs text-zinc-500">Ruolo non disponibile</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
