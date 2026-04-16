"use client";

import { FormEvent, useState } from "react";
import { getSession, signIn } from "next-auth/react";
import { ROLE_HOME_PATH } from "@/lib/permissions";

type LoginFormProps = {
  callbackUrl: string;
};

export function LoginForm({ callbackUrl }: LoginFormProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    const result = await signIn("credentials", {
      email,
      password,
      callbackUrl,
      redirect: false,
    });

    setIsSubmitting(false);

    if (!result) {
      setError("Servizio di autenticazione non raggiungibile.");
      return;
    }

    if (result.error) {
      setError("Credenziali non valide. Riprova.");
      return;
    }

    const isGenericCallback =
      !callbackUrl || callbackUrl === "/" || callbackUrl === "/login" || callbackUrl === "/register";

    if (isGenericCallback) {
      const session = await getSession();
      const role = session?.user?.role;
      const roleHome = role ? ROLE_HOME_PATH[role] : undefined;

      console.info("[AUTH_DEBUG] login redirect logic", {
        callbackUrl,
        resultUrl: result.url,
        role,
        roleHome,
      });

      window.location.href = roleHome ?? result.url ?? "/login";
      return;
    }

    window.location.href = result.url ?? callbackUrl;
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-1">
        <label htmlFor="email" className="text-sm font-medium text-zinc-700">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none ring-blue-500 focus:ring-2"
        />
      </div>

      <div className="space-y-1">
        <label htmlFor="password" className="text-sm font-medium text-zinc-700">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none ring-blue-500 focus:ring-2"
        />
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-800 disabled:opacity-60"
      >
        {isSubmitting ? "Accesso in corso..." : "Accedi"}
      </button>
    </form>
  );
}
