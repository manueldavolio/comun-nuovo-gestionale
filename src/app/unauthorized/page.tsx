import Link from "next/link";

export default function UnauthorizedPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-b from-sky-50 to-blue-100 px-4">
      <section className="w-full max-w-lg rounded-xl border border-blue-100 bg-white p-6 text-center shadow-sm">
        <h1 className="text-2xl font-semibold text-zinc-900">Accesso non autorizzato</h1>
        <p className="mt-3 text-sm text-zinc-600">
          Non hai i permessi per aprire questa area.
        </p>
        <Link
          href="/login"
          className="mt-6 inline-flex rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800"
        >
          Torna al login
        </Link>
      </section>
    </main>
  );
}
