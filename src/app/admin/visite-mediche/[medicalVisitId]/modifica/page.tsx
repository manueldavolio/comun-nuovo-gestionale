import Link from "next/link";
import { redirect } from "next/navigation";
import { AreaHeader } from "@/components/layout/area-header";
import { MedicalVisitForm } from "@/components/medical-visits/medical-visit-form";
import { prisma } from "@/lib/prisma";
import { getAuthSession } from "@/lib/auth";
import { ROLE_HOME_PATH } from "@/lib/permissions";
import { toDateInputValueUTC } from "@/lib/date-input";

type AdminMedicalVisitEditPageProps = {
  params: Promise<{ medicalVisitId: string }>;
};

export default async function AdminMedicalVisitEditPage({ params }: AdminMedicalVisitEditPageProps) {
  const { medicalVisitId } = await params;

  const session = await getAuthSession();
  if (!session?.user) {
    redirect(`/login?callbackUrl=/admin/visite-mediche/${medicalVisitId}/modifica`);
  }

  if (session.user.role !== "ADMIN" && session.user.role !== "YOUTH_DIRECTOR") {
    redirect(ROLE_HOME_PATH[session.user.role]);
  }

  const visit = await prisma.medicalVisit.findUnique({
    where: { id: medicalVisitId },
    select: {
      id: true,
      athleteId: true,
      visitDate: true,
      expiryDate: true,
      notes: true,
      certificateFilePath: true,
    },
  });

  if (!visit) {
    redirect("/unauthorized");
  }

  const athletes = await prisma.athlete.findMany({
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    select: { id: true, firstName: true, lastName: true },
  });

  const athleteOptions = athletes.map((a) => ({
    id: a.id,
    fullName: `${a.firstName} ${a.lastName}`.trim(),
  }));

  return (
    <main className="min-h-screen bg-gradient-to-b from-sky-50 to-blue-100 p-4 md:p-8">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
        <AreaHeader
          title="Modifica visita medica (Admin)"
          subtitle="Aggiorna visita e scadenza"
          userName={session.user.name ?? "Amministratore"}
        />

        <div className="flex flex-col gap-2 md:flex-row md:items-center">
          <Link
            href="/admin/visite-mediche"
            className="inline-flex w-fit items-center rounded-lg border border-blue-200 bg-white px-3 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-50"
          >
            Torna alla lista
          </Link>
        </div>

        <MedicalVisitForm
          mode="edit"
          medicalVisitId={visit.id}
          athletes={athleteOptions}
          initialValues={{
            athleteId: visit.athleteId,
            visitDate: toDateInputValueUTC(visit.visitDate),
            expiryDate: toDateInputValueUTC(visit.expiryDate),
            notes: visit.notes ?? "",
            certificateFilePath: visit.certificateFilePath ?? "",
          }}
        />
      </div>
    </main>
  );
}

