import Link from "next/link";

export default function RegolamentoPage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-sky-50 to-blue-100 p-4 md:p-8">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
        <section className="rounded-xl border border-blue-100 bg-white p-6 shadow-sm">
          <h1 className="text-2xl font-semibold text-zinc-900">Regolamento societario</h1>
          <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-zinc-700">
            Il regolamento societario è in fase di pubblicazione.
          </p>

          <div className="mt-6">
            <Link
              href="/genitore/iscrizione/nuova"
              className="inline-flex items-center rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800"
            >
              Torna al form
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}

