import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { CategoryForm } from "@/components/categories/category-form";
import { CategoryDeleteButton } from "@/components/categories/category-delete-button";
import { getAuthSession } from "@/lib/auth";
import { resolvePlayersPerSide } from "@/lib/category-format";
import { prisma } from "@/lib/prisma";

type AdminCategoryEditPageProps = {
  params: Promise<{ categoryId: string }>;
};

export default async function AdminCategoryEditPage({ params }: AdminCategoryEditPageProps) {
  const { categoryId } = await params;

  const session = await getAuthSession();
  if (!session?.user) {
    redirect(`/login?callbackUrl=/admin/categorie/${categoryId}/modifica`);
  }

  if (session.user.role !== "ADMIN") {
    redirect("/unauthorized");
  }

  const category = await prisma.category.findUnique({
    where: { id: categoryId },
    select: {
      id: true,
      name: true,
      birthYearsLabel: true,
      isActive: true,
      playersPerSide: true,
    },
  });

  if (!category) {
    redirect("/unauthorized");
  }

  return (
    <main className="p-4 md:p-6 lg:p-8">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
        <Link
          href="/admin/categorie"
          className="inline-flex w-fit min-h-11 items-center gap-2 rounded-xl border border-sky-200 bg-white px-3 text-sm font-bold text-blue-800 shadow-sm hover:bg-sky-50"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Torna alle categorie
        </Link>

        <header className="rounded-3xl border border-blue-800/30 bg-gradient-to-br from-blue-950 via-blue-900 to-sky-700 px-5 py-5 text-white shadow-lg shadow-blue-950/15 sm:px-6">
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-sky-200">Categorie</p>
          <h1 className="mt-1 text-2xl font-black tracking-tight">Modifica categoria</h1>
          <p className="mt-1 text-sm font-medium text-sky-100">{category.name}</p>
        </header>

        <CategoryForm
          mode="edit"
          categoryId={category.id}
          initialValues={{
            name: category.name,
            birthYearsLabel: category.birthYearsLabel,
            isActive: category.isActive,
            playersPerSide: resolvePlayersPerSide(category),
          }}
        />

        <div className="rounded-3xl border border-red-200 bg-red-50/70 p-4 shadow-sm sm:p-5">
          <h2 className="text-base font-black text-red-800">Zona pericolo</h2>
          <p className="mt-1 text-sm text-red-700">
            L&apos;eliminazione resta soggetta alle regole esistenti (categoria senza vincoli
            bloccanti).
          </p>
          <div className="mt-4">
            <CategoryDeleteButton categoryId={category.id} />
          </div>
        </div>
      </div>
    </main>
  );
}
