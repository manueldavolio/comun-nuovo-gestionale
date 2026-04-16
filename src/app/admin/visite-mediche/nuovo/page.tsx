import Link from "next/link";
import { redirect } from "next/navigation";
import { AreaHeader } from "@/components/layout/area-header";
import { MedicalVisitForm } from "@/components/medical-visits/medical-visit-form";
import { prisma } from "@/lib/prisma";
import { getAuthSession } from "@/lib/auth";
import { ROLE_HOME_PATH } from "@/lib/permissions";
import { toDateInputValueUTC } from "@/lib/date-input";

type AdminMedicalVisitNewPageProps = {
  searchParams: Promise<{ athleteId?: string }>;
};

export default async function AdminMedicalVisitNewPage({ searchParams }: AdminMedicalVisitNewPageProps) {
  const session = await getAuthSession();

  if (!session?.user) {
    redirect("/login?callbackUrl=/admin/visite-mediche/nuovo");
  }

  if (session.user.role !== "ADMIN" && session.user.role !== "YOUTH_DIRECTOR") {
    redirect(ROLE_HOME_PATH[session.user.role]);
  }

  const params = await searchParams;

  const athletes = await prisma.athlete.findMany({
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    select: { id: true, firstName: true, lastName: true },
  });

  const athleteOptions = athletes.map((a) => ({
    id: a.id,
    fullName: `${a.firstName} ${a.lastName}`.trim(),
  }));

  const preselectedAthlete = params.athleteId
    ? athleteOptions.find((a) => a.id === params.athleteId)
    : null;

  const initialAthleteId = preselectedAthlete?.id ?? athleteOptions[0]?.id ?? "";

  const todayInput = toDateInputValueUTC(new Date());

  return (
    <main className="min-h-screen bg-gradient-to-b from-sky-50 to-blue-100 p-4 md:p-8">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
        <AreaHeader
          title="Nuova visita medica (Admin)"
          subtitle="Inserisci dati visita e scadenza"
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

        {athleteOptions.length === 0 ? (
          <p className="rounded-xl border border-zinc-200 bg-white p-4 text-sm text-zinc-700">
            Nessun atleta disponibile per inserire una visita.
          </p>
        ) : (
          <MedicalVisitForm
            mode="create"
            athletes={athleteOptions}
            initialValues={{
              athleteId: initialAthleteId,
              visitDate: todayInput,
              expiryDate: todayInput,
              notes: "",
              certificateFilePath: "",
            }}
          />
        )}
      </div>
    </main>
  );
}

