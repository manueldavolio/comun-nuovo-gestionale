import Link from "next/link";
import { redirect } from "next/navigation";
import { AdminAthleteLinkRequestsPanel } from "@/components/admin/admin-athlete-link-requests-panel";
import { AreaHeader } from "@/components/layout/area-header";
import { getAuthSession } from "@/lib/auth";
import { ROLE_HOME_PATH } from "@/lib/permissions";

export default async function AdminAthleteLinkRequestsPage() {
  const session = await getAuthSession();

  if (!session?.user) {
    redirect("/login?callbackUrl=/admin/associazioni-genitori");
  }

  if (session.user.role !== "ADMIN" && session.user.role !== "YOUTH_DIRECTOR") {
    redirect(ROLE_HOME_PATH[session.user.role] ?? "/unauthorized");
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-sky-50 to-blue-100 p-4 md:p-8">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-4">
        <AreaHeader
          title="Richieste associazione genitore-atleta"
          subtitle="Approva o rifiuta i collegamenti dei genitori aggiuntivi"
          userName={session.user.name ?? "Staff"}
        />
        <Link
          href="/admin"
          className="inline-flex w-fit items-center rounded-lg border border-blue-200 bg-white px-3 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-50"
        >
          Torna alla dashboard admin
        </Link>
        <section className="rounded-xl border border-blue-100 bg-white p-4 shadow-sm">
          <AdminAthleteLinkRequestsPanel />
        </section>
      </div>
    </main>
  );
}
