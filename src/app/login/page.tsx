import { redirect } from "next/navigation";
import { LoginForm } from "@/components/auth/login-form";
import { getAuthSession } from "@/lib/auth";
import { ROLE_HOME_PATH } from "@/lib/permissions";

type LoginPageProps = {
  searchParams: Promise<{ callbackUrl?: string }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const session = await getAuthSession();
  if (session?.user?.role) {
    redirect(ROLE_HOME_PATH[session.user.role]);
  }

  const params = await searchParams;
  const callbackUrl = params.callbackUrl ?? "/";

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-b from-sky-50 to-blue-100 px-4 py-8">
      <section className="w-full max-w-md rounded-xl border border-blue-100 bg-white p-6 shadow-sm">
        <div className="mb-6 space-y-2">
          <h1 className="text-2xl font-semibold text-zinc-900">Accedi</h1>
          <p className="text-sm text-zinc-600">
            Inserisci le credenziali per accedere al gestionale.
          </p>
        </div>
        <LoginForm callbackUrl={callbackUrl} />
      </section>
    </main>
  );
}
