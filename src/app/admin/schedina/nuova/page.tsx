import Link from "next/link";
import { redirect } from "next/navigation";
import { AreaHeader } from "@/components/layout/area-header";
import { PredictionSlipForm } from "@/components/admin/prediction-slip-form";
import { getAuthSession } from "@/lib/auth";

export default async function AdminSchedinaNuovaPage() {
  const session = await getAuthSession();
  if (!session?.user) redirect("/login?callbackUrl=/admin/schedina/nuova");
  if (session.user.role !== "ADMIN") redirect("/unauthorized");

  return (
    <main className="min-h-screen bg-gradient-to-b from-sky-50 to-blue-100 p-4 md:p-8">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-4">
        <AreaHeader
          title="Nuova schedina"
          subtitle="Seleziona le partite dal calendario"
          userName={session.user.name ?? "Amministratore"}
        />
        <Link href="/admin/schedina" className="w-fit text-sm font-semibold text-blue-800">
          ← Torna all&apos;elenco
        </Link>
        <section className="rounded-xl border border-blue-100 bg-white p-4 shadow-sm">
          <PredictionSlipForm mode="create" />
        </section>
      </div>
    </main>
  );
}
