import { AdminBackLink } from "@/components/admin/admin-back-link";
import { AreaHeader } from "@/components/layout/area-header";
import { SiteSettingsForm } from "@/components/site-web/site-settings-form";
import { SiteWebNav } from "@/components/site-web/site-web-nav";
import { prisma } from "@/lib/prisma";
import { requireSiteWebAdminPage } from "@/lib/site-cms-server";

export default async function AdminSiteSettingsPage() {
  const session = await requireSiteWebAdminPage("/admin/sito-web/impostazioni");

  const settings = await prisma.siteSettings.findUnique({ where: { id: "main" } });

  return (
    <main className="min-h-screen bg-gradient-to-b from-sky-50 to-blue-100 p-4 md:p-8">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
        <AreaHeader
          title="Impostazioni sito (Admin)"
          subtitle="Numeri della homepage del sito pubblico"
          userName={session.user.name ?? "Amministratore"}
        />
        <AdminBackLink href="/admin/sito-web" label="← Torna a Sito web" />
        <SiteWebNav />

        <SiteSettingsForm
          initialValues={{
            foundationYear: String(settings?.foundationYear ?? 1968),
            teamsCount: settings?.teamsCount ?? "8",
            membersCount: settings?.membersCount ?? "200+",
            fieldsCount: settings?.fieldsCount ?? "4",
          }}
        />
      </div>
    </main>
  );
}
