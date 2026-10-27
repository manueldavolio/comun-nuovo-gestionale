import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, FileText } from "lucide-react";
import { DocumentForm } from "@/components/documents/document-form";
import { getAuthSession } from "@/lib/auth";
import { toDateInputValueUTC } from "@/lib/date-input";
import { DOCUMENT_TYPE_CHOICES } from "@/lib/document-types";
import { ROLE_HOME_PATH } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import {
  assertCanAccessArchiveDocumentData,
  athleteListWhereForAdminRole,
} from "@/lib/youth-director-data-access";

type AdminDocumentEditPageProps = {
  params: Promise<{ documentId: string }>;
};

export default async function AdminDocumentEditPage({ params }: AdminDocumentEditPageProps) {
  const { documentId } = await params;

  const session = await getAuthSession();
  if (!session?.user) {
    redirect(`/login?callbackUrl=/admin/documenti/${documentId}/modifica`);
  }

  if (session.user.role !== "ADMIN" && session.user.role !== "YOUTH_DIRECTOR") {
    redirect(ROLE_HOME_PATH[session.user.role]);
  }

  const documentAccess = await assertCanAccessArchiveDocumentData({
    userId: session.user.id,
    role: session.user.role,
    documentId,
  });
  if (!documentAccess.ok) {
    redirect("/unauthorized");
  }

  const athleteScope = athleteListWhereForAdminRole(session.user.role);
  if (!athleteScope) {
    redirect(ROLE_HOME_PATH[session.user.role]);
  }

  const doc = await prisma.document.findUnique({
    where: { id: documentId },
    select: {
      id: true,
      athleteId: true,
      type: true,
      title: true,
      expiryDate: true,
      notes: true,
      filePath: true,
    },
  });

  if (!doc) {
    redirect("/unauthorized");
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

  const initialType =
    (DOCUMENT_TYPE_CHOICES.find((c) => c.value === doc.type)?.value ?? doc.type) as typeof doc.type;

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
                  Modifica documento
                </h1>
                <p className="mt-1 text-sm font-medium text-sky-100">
                  Aggiorna metadati documento atleta
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

        <DocumentForm
          mode="edit"
          documentId={doc.id}
          athletes={athleteOptions}
          initialValues={{
            athleteId: doc.athleteId,
            type: initialType,
            title: doc.title,
            expiryDate: doc.expiryDate ? toDateInputValueUTC(doc.expiryDate) : "",
            notes: doc.notes ?? "",
            filePath: doc.filePath,
          }}
        />
      </div>
    </main>
  );
}
