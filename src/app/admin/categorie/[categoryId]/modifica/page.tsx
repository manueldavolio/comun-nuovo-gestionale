import Link from "next/link";
import { redirect } from "next/navigation";
import { AreaHeader } from "@/components/layout/area-header";
import { CategoryForm } from "@/components/categories/category-form";
import { getAuthSession } from "@/lib/auth";
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
    },
  });

  if (!category) {
    redirect("/unauthorized");
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-sky-50 to-blue-100 p-4 md:p-8">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
        <AreaHeader
          title="Modifica categoria (Admin)"
          subtitle="Aggiorna i dati della categoria"
          userName={session.user.name ?? "Amministratore"}
        />

        <div className="flex flex-col gap-2 md:flex-row md:items-center">
          <Link
            href="/admin/categorie"
            className="inline-flex w-fit items-center rounded-lg border border-blue-200 bg-white px-3 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-50"
          >
            Torna alla lista
          </Link>
        </div>

        <CategoryForm
          mode="edit"
          categoryId={category.id}
          initialValues={{
            name: category.name,
            birthYearsLabel: category.birthYearsLabel,
            isActive: category.isActive,
          }}
        />
      </div>
    </main>
  );
}
