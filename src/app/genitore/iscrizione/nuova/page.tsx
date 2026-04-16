import Link from "next/link";
import { redirect } from "next/navigation";
import { AreaHeader } from "@/components/layout/area-header";
import { NewEnrollmentForm } from "@/components/enrollment/new-enrollment-form";
import { getAuthSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const DEFAULT_CATEGORY_ID = "__DEFAULT_CATEGORY__";

function getDefaultSeasonLabel() {
  const now = new Date();
  const year = now.getMonth() >= 6 ? now.getFullYear() : now.getFullYear() - 1;
  return `${year}/${year + 1}`;
}

export default async function NewParentEnrollmentPage() {
  const session = await getAuthSession();

  if (!session?.user) {
    redirect("/login?callbackUrl=/genitore/iscrizione/nuova");
  }

  if (session.user.role !== "PARENT") {
    redirect("/unauthorized");
  }

  const [categories, parentProfile] = await Promise.all([
    prisma.category.findMany({
      // Temporary bypass: allow enrollments even if categories were marked inactive.
      orderBy: [{ seasonLabel: "desc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        birthYearsLabel: true,
        seasonLabel: true,
      },
    }),
    prisma.parentProfile.findUnique({
      where: { userId: session.user.id },
      select: {
        firstName: true,
        lastName: true,
        taxCode: true,
        phone: true,
        address: true,
        city: true,
        postalCode: true,
        province: true,
        user: {
          select: {
            email: true,
          },
        },
      },
    }),
  ]);

  if (!parentProfile) {
    redirect("/unauthorized");
  }

  const categoriesForForm =
    categories.length > 0
      ? categories
      : [
          {
            id: DEFAULT_CATEGORY_ID,
            name: "Iscrizione generale",
            birthYearsLabel: "Tutte le annate",
            seasonLabel: getDefaultSeasonLabel(),
          },
        ];

  return (
    <main className="min-h-screen bg-gradient-to-b from-sky-50 to-blue-100 p-4 md:p-8">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-4">
        <AreaHeader
          title="Nuova iscrizione"
          subtitle="Iscrizione atleta Comun Nuovo Calcio"
          userName={session.user.name ?? "Genitore"}
        />

        <section className="rounded-xl border border-blue-100 bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-zinc-900">Compila tutti i dati richiesti</h2>
              <p className="text-sm text-zinc-600">
                L&apos;invio genera automaticamente atleta, iscrizione e due scadenze economiche.
              </p>
            </div>
            <Link
              href="/genitore"
              className="inline-flex items-center justify-center rounded-lg border border-blue-200 px-3 py-2 text-sm font-medium text-blue-800 hover:bg-blue-50"
            >
              Torna alla dashboard
            </Link>
          </div>
        </section>

        <NewEnrollmentForm
          categories={categoriesForForm}
          defaultParentData={{
            firstName: parentProfile.firstName,
            lastName: parentProfile.lastName,
            taxCode: parentProfile.taxCode,
            phone: parentProfile.phone,
            address: parentProfile.address,
            city: parentProfile.city,
            postalCode: parentProfile.postalCode,
            province: parentProfile.province,
            email: parentProfile.user.email,
          }}
        />
      </div>
    </main>
  );
}
