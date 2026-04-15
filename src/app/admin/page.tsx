import { redirect } from "next/navigation";
import { AreaHeader } from "@/components/layout/area-header";
import { prisma } from "@/lib/prisma";
import { getAuthSession } from "@/lib/auth";
import { ROLE_HOME_PATH } from "@/lib/permissions";

export default async function AdminDashboardPage() {
  const session = await getAuthSession();
  if (!session?.user) {
    redirect("/login?callbackUrl=/admin");
  }

  if (session.user.role !== "ADMIN" && session.user.role !== "YOUTH_DIRECTOR") {
    redirect(ROLE_HOME_PATH[session.user.role]);
  }

  const [totalUsers, totalCategories, activeCategories] = await Promise.all([
    prisma.user.count(),
    prisma.category.count(),
    prisma.category.count({ where: { isActive: true } }),
  ]);

  return (
    <main className="min-h-screen bg-zinc-100 p-4 md:p-8">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-4">
        <AreaHeader
          title="Dashboard Admin"
          subtitle="Gestione società sportiva"
          userName={session.user.name ?? "Amministratore"}
        />
        <section className="grid gap-4 md:grid-cols-3">
          <article className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
            <p className="text-sm text-zinc-500">Utenti totali</p>
            <p className="mt-1 text-3xl font-semibold text-zinc-900">{totalUsers}</p>
          </article>
          <article className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
            <p className="text-sm text-zinc-500">Categorie totali</p>
            <p className="mt-1 text-3xl font-semibold text-zinc-900">{totalCategories}</p>
          </article>
          <article className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
            <p className="text-sm text-zinc-500">Categorie attive</p>
            <p className="mt-1 text-3xl font-semibold text-zinc-900">{activeCategories}</p>
          </article>
        </section>
      </div>
    </main>
  );
}
