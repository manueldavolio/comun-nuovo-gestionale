import Link from "next/link";
import { redirect } from "next/navigation";
import { AreaHeader } from "@/components/layout/area-header";
import { DeleteButton } from "@/components/common/delete-button";
import { SiteSponsorForm } from "@/components/site-web/site-sponsor-form";
import { prisma } from "@/lib/prisma";
import { requireSiteWebAdminPage } from "@/lib/site-cms-server";

type AdminSiteSponsorEditPageProps = {
  params: Promise<{ sponsorId: string }>;
};

export default async function AdminSiteSponsorEditPage({ params }: AdminSiteSponsorEditPageProps) {
  const { sponsorId } = await params;
  const session = await requireSiteWebAdminPage(`/admin/sito-web/sponsor/${sponsorId}/modifica`);

  const sponsor = await prisma.siteSponsor.findUnique({ where: { id: sponsorId } });
  if (!sponsor) {
    redirect("/admin/sito-web/sponsor");
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-sky-50 to-blue-100 p-4 md:p-8">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
        <AreaHeader
          title="Modifica sponsor (Admin)"
          subtitle="Aggiorna i dati dello sponsor"
          userName={session.user.name ?? "Amministratore"}
        />

        <div className="flex flex-col gap-2 md:flex-row md:items-center">
          <Link
            href="/admin/sito-web/sponsor"
            className="inline-flex w-fit items-center rounded-lg border border-blue-200 bg-white px-3 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-50"
          >
            Torna alla lista
          </Link>
        </div>

        <SiteSponsorForm
          mode="edit"
          sponsorId={sponsor.id}
          initialValues={{
            name: sponsor.name,
            category: sponsor.category,
            logoUrl: sponsor.logoUrl ?? "",
            websiteUrl: sponsor.websiteUrl ?? "",
            isVisible: sponsor.isVisible,
          }}
        />

        <div className="rounded-xl border border-red-200 bg-white p-4">
          <DeleteButton
            endpoint={`/api/admin/site/sponsors/${sponsor.id}`}
            confirmMessage={`Eliminare lo sponsor "${sponsor.name}"?`}
            successMessage="Sponsor eliminato."
          />
        </div>
      </div>
    </main>
  );
}
