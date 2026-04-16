import Link from "next/link";
import { redirect } from "next/navigation";
import { AreaHeader } from "@/components/layout/area-header";
import { DocumentForm } from "@/components/documents/document-form";
import { prisma } from "@/lib/prisma";
import { getAuthSession } from "@/lib/auth";
import { ROLE_HOME_PATH } from "@/lib/permissions";
import { DOCUMENT_TYPE_CHOICES } from "@/lib/document-types";
import { toDateInputValueUTC } from "@/lib/date-input";

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

  const doc = await prisma.document.findUnique({
    where: { id: documentId },
    select: { id: true, athleteId: true, type: true, title: true, expiryDate: true, notes: true, filePath: true },
  });

  if (!doc) {
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

  const initialType = (DOCUMENT_TYPE_CHOICES.find((c) => c.value === doc.type)?.value ?? doc.type) as (typeof doc.type);

  return (
    <main className="min-h-screen bg-gradient-to-b from-sky-50 to-blue-100 p-4 md:p-8">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
        <AreaHeader
          title="Modifica documento (Admin)"
          subtitle="Aggiorna metadati documento atleta"
          userName={session.user.name ?? "Amministratore"}
        />

        <div className="flex flex-col gap-2 md:flex-row md:items-center">
          <Link
            href="/admin/documenti"
            className="inline-flex w-fit items-center rounded-lg border border-blue-200 bg-white px-3 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-50"
          >
            Torna alla lista
          </Link>
        </div>

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

