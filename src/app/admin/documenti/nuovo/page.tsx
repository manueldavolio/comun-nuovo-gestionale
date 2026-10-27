import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, FileText } from "lucide-react";
import { DocumentForm } from "@/components/documents/document-form";
import { getAuthSession } from "@/lib/auth";
import { DOCUMENT_TYPE_CHOICES } from "@/lib/document-types";
import { ROLE_HOME_PATH } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import {
  assertCanAccessAthleteData,
  athleteListWhereForAdminRole,
} from "@/lib/youth-director-data-access";

type AdminDocumentNewPageProps = {
  searchParams: Promise<{ athleteId?: string }>;
};

export default async function AdminDocumentNewPage({ searchParams }: AdminDocumentNewPageProps) {
  const session = await getAuthSession();

  if (!session?.user) {
    redirect("/login?callbackUrl=/admin/documenti/nuovo");
  }

  if (session.user.role !== "ADMIN" && session.user.role !== "YOUTH_DIRECTOR") {
    redirect(ROLE_HOME_PATH[session.user.role]);
  }

  const params = await searchParams;
  const athleteScope = athleteListWhereForAdminRole(session.user.role);
  if (!athleteScope) {
    redirect(ROLE_HOME_PATH[session.user.role]);
  }

  if (params.athleteId) {
    const preselectedAccess = await assertCanAccessAthleteData({
      userId: session.user.id,
      role: session.user.role,
      athleteId: params.athleteId,
    });
    if (!preselectedAccess.ok) {
      redirect("/unauthorized");
    }
  }

  const athletes = await prisma.athlete.findMany({
    where: athleteScope,
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    select: { id: true, firstName: true, lastName: true },
  });

  const athleteOptions = athletes.map((a) => ({
    id: a.id,
    fullName: `${a.firstName} ${a.lastName}`.trim(),
  }));

  const preselectedAthlete = params.athleteId
    ? athleteOptions.find((athlete) => athlete.id === params.athleteId)
    : null;

  const initialAthleteId = preselectedAthlete?.id ?? athleteOptions[0]?.id ?? "";
  const initialType = DOCUMENT_TYPE_CHOICES[0]?.value ?? "OTHER";

  return (
    <main className="p-4 md:p-6 lg:p-8">
      <div className="mx-auto flex w-full max-w-[800px] flex-col gap-4 md:gap-5">
        <header className="overflow-hidden rounded-3xl border border-blue-800/30 bg-gradient-to-br from-blue-950 via-blue-900 to-sky-700 text-white shadow-lg shadow-blue-950/15">
          <div className="relative p-5 sm:p-6">
            <div className="relative flex items-start gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/15 ring-1 ring-white/25">
                <FileText className="h-6 w-6" aria-hidden />
              </div>
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-sky-200">
                  Archivio
                </p>
                <h1 className="mt-1 text-2xl font-black tracking-tight sm:text-3xl">
                  Nuovo documento
                </h1>
                <p className="mt-1 text-sm font-medium text-sky-100">
                  Metadati documento atleta
                </p>
              </div>
            </div>
          </div>
        </header>

        <Link
          href="/admin/documenti"
          className="inline-flex w-fit min-h-11 items-center gap-2 rounded-xl border border-sky-200 bg-white px-3 text-sm font-bold text-blue-800 shadow-sm hover:bg-sky-50"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Torna alla lista
        </Link>

        {athleteOptions.length === 0 ? (
          <p className="rounded-3xl border border-dashed border-sky-200 bg-white px-4 py-8 text-center text-sm text-zinc-600">
            Nessun atleta disponibile per inserire un documento.
          </p>
        ) : (
          <DocumentForm
            mode="create"
            athletes={athleteOptions}
            initialValues={{
              athleteId: initialAthleteId,
              type: initialType,
              title: "",
              expiryDate: "",
              notes: "",
              filePath: "manual-placeholder/documenti_placeholder.pdf",
            }}
          />
        )}
      </div>
    </main>
  );
}
