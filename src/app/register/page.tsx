import Link from "next/link";
import { redirect } from "next/navigation";
import { RegisterForm } from "@/components/auth/register-form";
import { getAuthSession } from "@/lib/auth";
import { ROLE_HOME_PATH } from "@/lib/permissions";

export default async function RegisterPage() {
  const session = await getAuthSession();
  if (session?.user?.role) {
    redirect(ROLE_HOME_PATH[session.user.role]);
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-b from-sky-50 to-blue-100 px-4 py-8">
      <section className="w-full max-w-lg rounded-xl border border-blue-100 bg-white p-6 shadow-sm">
        <div className="mb-6 space-y-2">
          <h1 className="text-2xl font-semibold text-zinc-900">Registrazione genitore</h1>
          <p className="text-sm text-zinc-600">
            Crea il tuo account per accedere al gestionale Comun Nuovo Calcio.
          </p>
        </div>

        <RegisterForm />

        <p className="mt-6 text-center text-sm text-zinc-600">
          Hai gia un account?{" "}
          <Link href="/login" className="font-semibold text-blue-700 hover:text-blue-800">
            Accedi
          </Link>
        </p>
      </section>
    </main>
  );
}
