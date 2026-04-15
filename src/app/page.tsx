import Link from "next/link";
import { redirect } from "next/navigation";
import { getAuthSession } from "@/lib/auth";
import { ROLE_HOME_PATH } from "@/lib/permissions";

export default async function Home() {
  const session = await getAuthSession();
  if (session?.user?.role) {
    redirect(ROLE_HOME_PATH[session.user.role]);
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-100 px-4">
      <section className="w-full max-w-xl rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-wider text-emerald-700">
          Comun Nuovo Calcio
        </p>
        <h1 className="mt-2 text-3xl font-semibold text-zinc-900">
          Gestionale societario
        </h1>
        <p className="mt-2 text-sm text-zinc-600">
          Base tecnica pronta: autenticazione con ruoli, route protette e dashboard
          operative.
        </p>
        <Link
          href="/login"
          className="mt-6 inline-flex rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
        >
          Vai al login
        </Link>
      </section>
    </main>
  );
}
