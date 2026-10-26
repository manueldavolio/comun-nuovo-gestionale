import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
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
  const categoryIds =
    staffUser.coachProfile?.categoryAssignments.map((assignment) => assignment.categoryId) ?? [];

  return (
    <main className="p-4 md:p-6 lg:p-8">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
        <Link
          href="/admin/staff"
          className="inline-flex w-fit min-h-11 items-center gap-2 rounded-xl border border-sky-200 bg-white px-3 text-sm font-bold text-blue-800 shadow-sm hover:bg-sky-50"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Torna allo staff
        </Link>

        <header className="rounded-3xl border border-blue-800/30 bg-gradient-to-br from-blue-950 via-blue-900 to-sky-700 px-5 py-5 text-white shadow-lg shadow-blue-950/15 sm:px-6">
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-sky-200">Staff tecnico</p>
          <h1 className="mt-1 text-2xl font-black tracking-tight">Modifica membro</h1>
          <p className="mt-1 text-sm font-medium text-sky-100">
            {firstName} {lastName}
          </p>
        </header>

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
