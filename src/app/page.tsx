import Link from "next/link";

export default function Home() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-b from-blue-950 via-blue-900 to-sky-900 px-6 py-12">
      <section className="w-full max-w-4xl overflow-hidden rounded-2xl border border-blue-100/20 bg-white/95 shadow-2xl backdrop-blur">
        <div className="grid gap-0 md:grid-cols-5">
          <div className="flex flex-col justify-between gap-8 bg-gradient-to-br from-blue-900 to-blue-700 p-8 text-white md:col-span-3">
            <div className="space-y-4">
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-blue-100">
                Gestionale società sportiva
              </p>
              <h1 className="text-4xl font-bold tracking-tight">Comun Nuovo Calcio</h1>
              <p className="max-w-xl text-sm leading-relaxed text-blue-100 md:text-base">
                Piattaforma unica per organizzare utenti, categorie e attività quotidiane del
                club. Accesso rapido alle aree dedicate per segreteria, genitori e staff tecnico.
              </p>
            </div>
            <div className="rounded-xl border border-blue-200/40 bg-white/10 p-4 text-sm text-blue-50">
              Spazio riservato al logo del club (inseribile in una prossima iterazione).
            </div>
          </div>

          <div className="space-y-4 p-8 md:col-span-2">
            <h2 className="text-xl font-semibold text-slate-900">Accesso al gestionale</h2>
            <p className="text-sm text-slate-600">
              Entra con le tue credenziali per raggiungere la dashboard assegnata al tuo ruolo.
            </p>
            <div className="pt-2">
              <Link
                href="/login"
                className="inline-flex w-full items-center justify-center rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-800"
              >
                Accedi
              </Link>
            </div>
            <div>
              <Link
                href="/login?callbackUrl=/admin"
                className="inline-flex w-full items-center justify-center rounded-lg border border-blue-200 bg-blue-50 px-4 py-2.5 text-sm font-semibold text-blue-700 transition hover:bg-blue-100"
              >
                Area amministrazione
              </Link>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
              In caso di credenziali non disponibili, contatta la segreteria del club.
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
