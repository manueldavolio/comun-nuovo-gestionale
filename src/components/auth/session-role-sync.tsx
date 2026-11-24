"use client";

import { useEffect, useRef, useState } from "react";
import { getSession, signOut } from "next-auth/react";
import {
  assertSafeRoleHome,
  decideRoleSyncFromSession,
} from "@/lib/auth-role-sync";
import type { UserRole } from "@prisma/client";

const SYNC_ATTEMPT_KEY = "comun-nuovo-role-sync-attempt";
const MAX_SYNC_ATTEMPTS = 2;

/**
 * Chiama getSession() per far riscrivere il cookie JWT (ruolo dal DB via
 * /api/auth/session → jwt callback). Nessun ruolo da query/body client.
 * Se il cookie non si aggiorna e il middleware rimanda qui → dopo 2 tentativi logout.
 */
export function SessionRoleSync() {
  const [message, setMessage] = useState("Allineamento sessione in corso…");
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    let cancelled = false;

    async function run() {
      try {
        const attempt = Number(sessionStorage.getItem(SYNC_ATTEMPT_KEY) || "0");
        if (attempt >= MAX_SYNC_ATTEMPTS) {
          sessionStorage.removeItem(SYNC_ATTEMPT_KEY);
          setMessage("Allineamento non riuscito. Uscita in corso…");
          await signOut({ callbackUrl: "/login" });
          return;
        }
        sessionStorage.setItem(SYNC_ATTEMPT_KEY, String(attempt + 1));

        // getSession → GET /api/auth/session: ricalcola JWT dal DB e Set-Cookie.
        const session = await getSession();
        if (cancelled) return;

        const decision = decideRoleSyncFromSession({
          hasSessionUser: Boolean(session?.user?.id),
          sessionRole: session?.user?.role,
        });

        if (decision.type === "signout") {
          sessionStorage.removeItem(SYNC_ATTEMPT_KEY);
          setMessage("Sessione non valida. Uscita in corso…");
          await signOut({ callbackUrl: decision.callbackUrl });
          return;
        }

        const role = session?.user?.role as UserRole;
        const safe = assertSafeRoleHome(role, decision.path);
        if (safe.type === "signout") {
          sessionStorage.removeItem(SYNC_ATTEMPT_KEY);
          setMessage("Ruolo non allineato. Uscita in corso…");
          await signOut({ callbackUrl: safe.callbackUrl });
          return;
        }

        setMessage("Reindirizzamento…");
        // Se il cookie è aggiornato, la home passa il middleware e non torniamo qui
        // (sessionStorage attempt si azzera al prossimo login / signOut).
        window.location.replace(safe.path);
      } catch {
        if (cancelled) return;
        sessionStorage.removeItem(SYNC_ATTEMPT_KEY);
        setMessage("Allineamento non riuscito. Uscita in corso…");
        await signOut({ callbackUrl: "/login" });
      }
    }

    void run();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-b from-sky-50 to-blue-100 px-4">
      <section className="w-full max-w-md rounded-xl border border-blue-100 bg-white p-6 text-center shadow-sm">
        <h1 className="text-xl font-semibold text-zinc-900">Aggiornamento accesso</h1>
        <p className="mt-3 text-sm text-zinc-600">{message}</p>
      </section>
    </main>
  );
}
