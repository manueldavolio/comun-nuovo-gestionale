import Link from "next/link";
import { AreaHeader } from "@/components/layout/area-header";
import { SiteStaffForm } from "@/components/site-web/site-staff-form";
import { requireSiteWebAdminPage } from "@/lib/site-cms-server";

export default async function AdminSiteStaffNewPage() {
  const session = await requireSiteWebAdminPage("/admin/sito-web/staff/nuovo");

  return (
    <main className="min-h-screen bg-gradient-to-b from-sky-50 to-blue-100 p-4 md:p-8">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
        <AreaHeader
          title="Nuovo membro staff (Admin)"
          subtitle="Aggiungi una persona alla pagina Staff del sito"
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
          mode="create"
          initialValues={{
            name: "",
            role: "",
            category: "Dirigenza",
            description: "",
            photoUrl: "",
            isVisible: true,
          }}
        />
      </div>
    </main>
  );
}
