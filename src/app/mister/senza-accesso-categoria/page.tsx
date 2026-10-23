import Link from "next/link";
import { redirect } from "next/navigation";
import { getAuthSession } from "@/lib/auth";

/**
 * Messaggio chiaro quando un mister tenta di aprire uno strumento
 * su una categoria non assegnata (o non ne ha nessuna).
 */
export default async function MisterMissingCategoryAccessPage() {
  const session = await getAuthSession();
  if (!session?.user) {
    redirect("/login?callbackUrl=/mister/senza-accesso-categoria");
  }
  if (session.user.role !== "COACH") {
    redirect("/unauthorized");
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-b from-sky-50 to-blue-100 px-4">
      <section className="w-full max-w-lg rounded-2xl border border-blue-100 bg-white p-6 text-center shadow-sm">
        <h1 className="text-xl font-bold text-zinc-900">Squadra non assegnata</h1>
        <p className="mt-3 text-sm leading-relaxed text-zinc-600">
          Non hai ancora una categoria assegnata, oppure stai aprendo un impegno di una
          squadra che non ti compete. Contatta la direzione sportiva per l&apos;assegnazione.
          Non puoi visualizzare dati di altre squadre.
        </p>
        <Link
          href="/mister"
          className="mt-6 inline-flex min-h-11 items-center justify-center rounded-xl bg-blue-800 px-4 text-sm font-semibold text-white hover:bg-blue-900"
        >
          Torna alla dashboard
        </Link>
      </section>
    </main>
  );
}
