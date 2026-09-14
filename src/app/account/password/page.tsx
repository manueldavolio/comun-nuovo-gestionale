import Link from "next/link";
import { redirect } from "next/navigation";
import { ChangePasswordForm } from "@/components/auth/change-password-form";
import { AreaHeader } from "@/components/layout/area-header";
import { getAuthSession } from "@/lib/auth";
import { ROLE_HOME_PATH } from "@/lib/permissions";

export default async function ChangePasswordPage() {
  const session = await getAuthSession();

  if (!session?.user) {
    redirect("/login?callbackUrl=/account/password");
  }

  const homePath = ROLE_HOME_PATH[session.user.role] ?? "/";

  return (
    <main className="min-h-screen bg-gradient-to-b from-sky-50 to-blue-100 p-4 md:p-8">
      <div className="mx-auto flex w-full max-w-xl flex-col gap-4">
        <AreaHeader
          title="Cambia password"
          subtitle="Aggiorna la password del tuo account"
          userName={session.user.name ?? "Utente"}
        />

        <div className="flex flex-wrap gap-2">
          <Link
            href={homePath}
            className="inline-flex items-center rounded-lg border border-blue-200 bg-white px-3 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-50"
          >
            Torna alla home
          </Link>
        </div>

        <section className="rounded-xl border border-blue-100 bg-white p-4 shadow-sm">
          <p className="text-sm text-zinc-600">
            Inserisci la password attuale e scegline una nuova (minimo 6 caratteri).
          </p>
          <div className="mt-4">
            <ChangePasswordForm />
          </div>
        </section>
      </div>
    </main>
  );
}
