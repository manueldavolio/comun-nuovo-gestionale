import Link from "next/link";
import { redirect } from "next/navigation";
import { AreaHeader } from "@/components/layout/area-header";
import { CategoryForm } from "@/components/categories/category-form";
import { getAuthSession } from "@/lib/auth";

export default async function AdminCategoryNewPage() {
  const session = await getAuthSession();
  if (!session?.user) {
    redirect("/login?callbackUrl=/admin/categorie/nuovo");
  }

  if (session.user.role !== "ADMIN") {
    redirect("/unauthorized");
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-sky-50 to-blue-100 p-4 md:p-8">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
        <AreaHeader
          title="Nuova categoria (Admin)"
          subtitle="Crea una nuova categoria operativa"
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
          mode="create"
          initialValues={{
            name: "",
            birthYearsLabel: "",
            isActive: true,
          }}
        />
      </div>
    </main>
  );
}
