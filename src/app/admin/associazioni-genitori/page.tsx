import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Link2 } from "lucide-react";
import { AdminAthleteLinkRequestsPanel } from "@/components/admin/admin-athlete-link-requests-panel";
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
    <main className="p-4 md:p-6 lg:p-8">
      <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-4 md:gap-5">
        <header className="overflow-hidden rounded-3xl border border-blue-800/30 bg-gradient-to-br from-blue-950 via-blue-900 to-sky-700 text-white shadow-lg shadow-blue-950/15">
          <div className="relative p-5 sm:p-6">
            <div
              className="pointer-events-none absolute -right-8 -top-10 h-40 w-40 rounded-full bg-sky-400/20 blur-2xl"
              aria-hidden
            />
            <div className="relative flex items-start gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/15 ring-1 ring-white/25">
                <Link2 className="h-6 w-6" aria-hidden />
              </div>
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-sky-200">
                  Associazioni
                </p>
                <h1 className="mt-1 text-2xl font-black tracking-tight sm:text-3xl">
                  Genitore ↔ Atleta
                </h1>
                <p className="mt-1 text-sm font-medium text-sky-100">
                  Approva o rifiuta i collegamenti dei genitori aggiuntivi
                </p>
              </div>
            </div>
          </div>
        </header>

        <Link
          href="/admin"
          className="inline-flex w-fit min-h-11 items-center gap-2 rounded-xl border border-sky-200 bg-white px-3 text-sm font-bold text-blue-800 shadow-sm hover:bg-sky-50"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Torna alla dashboard
        </Link>

        <section className="rounded-3xl border border-sky-100 bg-white p-4 shadow-sm sm:p-5">
          <AdminAthleteLinkRequestsPanel />
        </section>
      </div>
    </main>
  );
}
