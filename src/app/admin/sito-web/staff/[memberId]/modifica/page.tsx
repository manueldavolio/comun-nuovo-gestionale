import Link from "next/link";
import { redirect } from "next/navigation";
import { AreaHeader } from "@/components/layout/area-header";
import { DeleteButton } from "@/components/common/delete-button";
import { SiteStaffForm } from "@/components/site-web/site-staff-form";
import { prisma } from "@/lib/prisma";
import { requireSiteWebAdminPage } from "@/lib/site-cms-server";

type AdminSiteStaffEditPageProps = {
  params: Promise<{ memberId: string }>;
};

export default async function AdminSiteStaffEditPage({ params }: AdminSiteStaffEditPageProps) {
  const { memberId } = await params;
  const session = await requireSiteWebAdminPage(`/admin/sito-web/staff/${memberId}/modifica`);

  const member = await prisma.siteStaffMember.findUnique({ where: { id: memberId } });
  if (!member) {
    redirect("/admin/sito-web/staff");
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-sky-50 to-blue-100 p-4 md:p-8">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
        <AreaHeader
          title="Modifica membro staff (Admin)"
          subtitle="Aggiorna i dati del membro staff"
          userName={session.user.name ?? "Amministratore"}
        />

        <div className="flex flex-col gap-2 md:flex-row md:items-center">
          <Link
            href="/admin/sito-web/staff"
            className="inline-flex w-fit items-center rounded-lg border border-blue-200 bg-white px-3 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-50"
          >
            Torna alla lista
          </Link>
        </div>

        <SiteStaffForm
          mode="edit"
          memberId={member.id}
          initialValues={{
            name: member.name,
            role: member.role,
            category: member.category,
            description: member.description ?? "",
            photoUrl: member.photoUrl ?? "",
            isVisible: member.isVisible,
          }}
        />

        <div className="rounded-xl border border-red-200 bg-white p-4">
          <DeleteButton
            endpoint={`/api/admin/site/staff/${member.id}`}
            confirmMessage={`Eliminare "${member.name}" dallo staff del sito?`}
            successMessage="Membro staff eliminato."
          />
        </div>
      </div>
    </main>
  );
}
