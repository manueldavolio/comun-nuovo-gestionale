import { AdminBackLink } from "@/components/admin/admin-back-link";
import { FamilyBenefitForm } from "@/components/family-benefits/family-benefit-form";
import { AreaHeader } from "@/components/layout/area-header";
import { SiteWebNav } from "@/components/site-web/site-web-nav";
import { requireSiteWebAdminPage } from "@/lib/site-cms-server";

export default async function AdminNuovaConvenzionePage() {
  const session = await requireSiteWebAdminPage("/admin/sito-web/convenzioni/nuova");
  return (
    <main className="min-h-screen bg-gradient-to-b from-sky-50 to-blue-100 p-4 md:p-8">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
        <AreaHeader
          title="Nuova convenzione"
          subtitle="Visibile ai genitori dopo pubblicazione"
          userName={session.user.name ?? "Amministratore"}
        />
        <AdminBackLink href="/admin/sito-web/convenzioni" label="← Convenzioni" />
        <SiteWebNav />
        <FamilyBenefitForm
          mode="create"
          initialValues={{
            name: "",
            businessName: "",
            description: "",
            discountLabel: "",
            promoCode: "",
            conditions: "",
            logoUrl: "",
            websiteUrl: "",
            contactInfo: "",
            expiresAt: "",
            audience: "ALL",
            isPublished: false,
            isActive: true,
            sortOrder: 0,
            priority: 0,
          }}
        />
      </div>
    </main>
  );
}
