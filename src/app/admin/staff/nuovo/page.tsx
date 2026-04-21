import Link from "next/link";
import { redirect } from "next/navigation";
import { AreaHeader } from "@/components/layout/area-header";
import { StaffForm } from "@/components/staff/staff-form";
import { getAuthSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function AdminStaffNewPage() {
  const session = await getAuthSession();
  if (!session?.user) {
    redirect("/login?callbackUrl=/admin/staff/nuovo");
  }

  if (session.user.role !== "ADMIN") {
    redirect("/unauthorized");
  }

  const categories = await prisma.category.findMany({
    where: { isActive: true },
    orderBy: [{ name: "asc" }],
    select: {
      id: true,
      name: true,
    },
  });

  return (
    <main className="min-h-screen bg-gradient-to-b from-sky-50 to-blue-100 p-4 md:p-8">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
        <AreaHeader
          title="Nuovo membro staff (Admin)"
          subtitle="Crea un nuovo profilo tecnico"
          userName={session.user.name ?? "Amministratore"}
        />

        <div className="flex flex-col gap-2 md:flex-row md:items-center">
          <Link
            href="/admin/staff"
            className="inline-flex w-fit items-center rounded-lg border border-blue-200 bg-white px-3 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-50"
          >
            Torna alla lista
          </Link>
        </div>

        <StaffForm
          mode="create"
          categories={categories}
          initialValues={{
            firstName: "",
            lastName: "",
            email: "",
            role: "COACH",
            categoryIds: [],
          }}
        />
      </div>
    </main>
  );
}
