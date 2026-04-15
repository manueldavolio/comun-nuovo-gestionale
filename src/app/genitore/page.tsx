import { redirect } from "next/navigation";
import { AreaHeader } from "@/components/layout/area-header";
import { prisma } from "@/lib/prisma";
import { getAuthSession } from "@/lib/auth";

export default async function ParentDashboardPage() {
  const session = await getAuthSession();
  if (!session?.user) {
    redirect("/login?callbackUrl=/genitore");
  }

  if (session.user.role !== "PARENT") {
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
          title="Area Genitore"
          subtitle="Panoramica categorie disponibili"
          userName={session.user.name ?? "Genitore"}
        />

        <section className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
          <h2 className="text-lg font-semibold text-zinc-900">Categorie attive</h2>
          <ul className="mt-3 space-y-2">
            {categories.map((category) => (
              <li
                key={category.id}
                className="rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-700"
              >
                <p className="font-medium text-zinc-900">{category.name}</p>
                {category.description && <p>{category.description}</p>}
              </li>
            ))}
          </ul>
        </section>
      </div>
    </main>
  );
}
