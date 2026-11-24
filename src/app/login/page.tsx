import { redirect } from "next/navigation";
import { LoginForm } from "@/components/auth/login-form";
import { getAuthSession } from "@/lib/auth";

type LoginPageProps = {
  searchParams: Promise<{ callbackUrl?: string; registered?: string }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const session = await getAuthSession();
  if (session?.user?.role) {
    // Riallinea il cookie JWT (può essere stale dopo una promozione) prima della home.
    console.info("[AUTH_DEBUG] login page redirect for authenticated user", {
      userId: session.user.id,
      email: session.user.email,
      role: session.user.role,
      redirectTo: "/auth/riallinea-ruolo",
    });
    redirect("/auth/riallinea-ruolo");
  }

  const params = await searchParams;
  const callbackUrl = params.callbackUrl ?? "/";
  const showRegisteredMessage = params.registered === "1";

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-b from-sky-50 to-blue-100 px-4 py-8">
      <section className="w-full max-w-md rounded-xl border border-blue-100 bg-white p-6 shadow-sm">
        <div className="mb-6 space-y-2">
          <h1 className="text-2xl font-semibold text-zinc-900">Accedi</h1>
          <p className="text-sm text-zinc-600">
            Inserisci le credenziali per accedere al gestionale.
          </p>
          {showRegisteredMessage && (
            <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
              Registrazione completata. Ora puoi accedere con le tue credenziali.
            </p>
          )}
        </div>
        <LoginForm callbackUrl={callbackUrl} />
      </section>
    </main>
  );
}
