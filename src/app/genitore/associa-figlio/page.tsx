import Link from "next/link";
import { redirect } from "next/navigation";
import { AreaHeader } from "@/components/layout/area-header";
import { ParentAthleteLinkRequestForm } from "@/components/parents/parent-athlete-link-request-form";
import { getAuthSession } from "@/lib/auth";

export default async function ParentAssociateAthletePage() {
  const session = await getAuthSession();

  if (!session?.user) {
    redirect("/login?callbackUrl=/genitore/associa-figlio");
  }

  if (session.user.role !== "PARENT") {
    redirect("/unauthorized");
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-sky-50 to-blue-100 p-4 md:p-8">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
        <AreaHeader
          title="Associa figlio già iscritto"
          subtitle="Richiedi il collegamento al tuo account genitore"
          userName={session.user.name ?? "Genitore"}
        />
        <Link
          href="/genitore"
          className="inline-flex w-fit items-center rounded-lg border border-blue-200 bg-white px-3 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-50"
        >
          Torna alla dashboard
        </Link>
        <ParentAthleteLinkRequestForm />
      </div>
    </main>
  );
}
