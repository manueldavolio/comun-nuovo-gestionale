import Link from "next/link";
import { redirect } from "next/navigation";
import { AreaHeader } from "@/components/layout/area-header";
import { StaffForm } from "@/components/staff/staff-form";
import { getAuthSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { STAFF_ROLE_OPTIONS, splitFullName } from "@/lib/staff";

type AdminStaffEditPageProps = {
  params: Promise<{ staffId: string }>;
};

export default async function AdminStaffEditPage({ params }: AdminStaffEditPageProps) {
  const { staffId } = await params;

  const session = await getAuthSession();
  if (!session?.user) {
    redirect(`/login?callbackUrl=/admin/staff/${staffId}/modifica`);
  }

  if (session.user.role !== "ADMIN") {
    redirect("/unauthorized");
  }

  const [staffUser, categories] = await Promise.all([
    prisma.user.findUnique({
      where: { id: staffId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        coachProfile: {
          select: {
            firstName: true,
            lastName: true,
            categoryAssignments: {
              select: {
                categoryId: true,
              },
            },
          },
        },
      },
    }),
    prisma.category.findMany({
      where: { isActive: true },
      orderBy: [{ name: "asc" }],
      select: {
        id: true,
        name: true,
      },
    }),
  ]);

  if (!staffUser || !STAFF_ROLE_OPTIONS.includes(staffUser.role)) {
    redirect("/unauthorized");
  }

  const fallbackName = splitFullName(staffUser.name);
  const firstName = staffUser.coachProfile?.firstName || fallbackName.firstName;
  const lastName = staffUser.coachProfile?.lastName || fallbackName.lastName;
  const categoryIds = staffUser.coachProfile?.categoryAssignments.map((assignment) => assignment.categoryId) ?? [];

  return (
    <main className="min-h-screen bg-gradient-to-b from-sky-50 to-blue-100 p-4 md:p-8">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
        <AreaHeader
          title="Modifica membro staff (Admin)"
          subtitle="Aggiorna anagrafica, ruolo e categorie"
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
          mode="edit"
          staffId={staffUser.id}
          categories={categories}
          initialValues={{
            firstName,
            lastName,
            email: staffUser.email,
            role: staffUser.role,
            categoryIds,
          }}
        />
      </div>
    </main>
  );
}
