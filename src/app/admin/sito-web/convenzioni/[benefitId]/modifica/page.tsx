import { notFound } from "next/navigation";
import { AdminBackLink } from "@/components/admin/admin-back-link";
import { FamilyBenefitForm } from "@/components/family-benefits/family-benefit-form";
import { AreaHeader } from "@/components/layout/area-header";
import { SiteWebNav } from "@/components/site-web/site-web-nav";
import { prisma } from "@/lib/prisma";
import { requireSiteWebAdminPage } from "@/lib/site-cms-server";

type Props = { params: Promise<{ benefitId: string }> };

export default async function AdminModificaConvenzionePage({ params }: Props) {
  const session = await requireSiteWebAdminPage("/admin/sito-web/convenzioni");
  const { benefitId } = await params;
  const row = await prisma.familyBenefit.findUnique({ where: { id: benefitId } });
  if (!row) notFound();

  return (
    <main className="min-h-screen bg-gradient-to-b from-sky-50 to-blue-100 p-4 md:p-8">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
        <AreaHeader
          title="Modifica convenzione"
          subtitle={row.name}
          userName={session.user.name ?? "Amministratore"}
        />
        <AdminBackLink href="/admin/sito-web/convenzioni" label="← Convenzioni" />
        <SiteWebNav />
        <FamilyBenefitForm
          mode="edit"
          benefitId={row.id}
          initialValues={{
            name: row.name,
            businessName: row.businessName ?? "",
            description: row.description,
            discountLabel: row.discountLabel ?? "",
            promoCode: row.promoCode ?? "",
            conditions: row.conditions ?? "",
            logoUrl: row.logoUrl ?? "",
            websiteUrl: row.websiteUrl ?? "",
            contactInfo: row.contactInfo ?? "",
            expiresAt: row.expiresAt ? row.expiresAt.toISOString().slice(0, 10) : "",
            audience: row.audience,
            isPublished: row.isPublished,
            isActive: row.isActive,
            sortOrder: row.sortOrder,
            priority: row.priority,
          }}
        />
      </div>
    </main>
  );
}
