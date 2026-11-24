import Link from "next/link";
import { SignOutButton } from "@/components/auth/sign-out-button";

export default function UnauthorizedPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-b from-sky-50 to-blue-100 px-4">
      <section className="w-full max-w-lg rounded-xl border border-blue-100 bg-white p-6 text-center shadow-sm">
        <h1 className="text-2xl font-semibold text-zinc-900">Accesso non autorizzato</h1>
        <p className="mt-3 text-sm text-zinc-600">
          Non hai i permessi per aprire questa area.
        </p>
        <p className="mt-2 text-xs text-zinc-500">
          Se il tuo ruolo è stato modificato di recente, esci e accedi di nuovo.
        </p>
        <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <SignOutButton
            label="Esci e accedi di nuovo"
            className="inline-flex rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800"
          />
          <Link
            href="/login"
            className="inline-flex rounded-lg border border-blue-200 bg-white px-4 py-2 text-sm font-semibold text-blue-800 hover:bg-blue-50"
          >
            Torna al login
          </Link>
        </div>
      </section>
    </main>
  );
}
