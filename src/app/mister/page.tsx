import { redirect } from "next/navigation";
import { AreaHeader } from "@/components/layout/area-header";
import { prisma } from "@/lib/prisma";
import { getAuthSession } from "@/lib/auth";

export default async function CoachDashboardPage() {
  const session = await getAuthSession();
  if (!session?.user) {
    redirect("/login?callbackUrl=/mister");
  }

  if (session.user.role !== "COACH") {
    redirect("/unauthorized");
  }

  const categories = await prisma.category.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
  });

  return (
    <main className="min-h-screen bg-zinc-100 p-4 md:p-8">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-4">
        <AreaHeader
          title="Area Mister"
          subtitle="Categorie seguite dal settore tecnico"
          userName={session.user.name ?? "Mister"}
        />
        <section className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
          <h2 className="text-lg font-semibold text-zinc-900">Elenco categorie</h2>
          <div className="mt-3 grid gap-2 md:grid-cols-2">
            {categories.map((category) => (
              <article
                key={category.id}
                className="rounded-lg border border-zinc-200 px-3 py-2"
              >
                <p className="font-medium text-zinc-900">{category.name}</p>
                <p className="text-sm text-zinc-600">
                  {category.description ?? "Nessuna descrizione disponibile."}
                </p>
              </article>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
