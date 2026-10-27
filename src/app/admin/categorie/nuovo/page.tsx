import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
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
          <h1 className="mt-1 text-2xl font-black tracking-tight">Nuova categoria</h1>
          <p className="mt-1 text-sm font-medium text-sky-100">
            Crea una fascia operativa per la stagione
          </p>
        </header>

        <CategoryForm
          mode="create"
          initialValues={{
            name: "",
            birthYearsLabel: "",
            isActive: true,
            playersPerSide: 11,
            sector: null,
          }}
        />
      </div>
    </main>
  );
}
