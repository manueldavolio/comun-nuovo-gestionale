"use client";

import Link from "next/link";
import { SignOutButton } from "@/components/auth/sign-out-button";

type AdminDashboardHeroProps = {
  userName: string;
  seasonLabel?: string | null;
  /** Defaults preserve ADMIN dashboard copy. */
  title?: string;
  subtitle?: string;
};

export function AdminDashboardHero({
  userName,
  seasonLabel,
  title = "Centro di controllo",
  subtitle,
}: AdminDashboardHeroProps) {
  const resolvedSubtitle = subtitle ?? `Panoramica operativa · ${userName}`;

  return (
    <header className="overflow-hidden rounded-3xl border border-blue-800/30 bg-gradient-to-br from-blue-950 via-blue-900 to-sky-700 text-white shadow-lg shadow-blue-950/20">
      <div className="relative p-5 sm:p-6">
        <div
          className="pointer-events-none absolute -right-10 -top-10 h-44 w-44 rounded-full bg-sky-400/20 blur-2xl"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -bottom-16 left-1/4 h-40 w-40 rounded-full bg-white/10 blur-xl"
          aria-hidden
        />

        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/logo-home.png"
                alt="ASD Comun Nuovo"
                className="h-12 w-12 rounded-2xl bg-white object-contain p-1 shadow-md sm:h-14 sm:w-14"
              />
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-sky-200">
                  ASD Comun Nuovo
                </p>
                {seasonLabel ? (
                  <p className="text-[11px] font-medium text-sky-100/85">
                    Stagione {seasonLabel}
                  </p>
                ) : null}
              </div>
            </div>

            <h1 className="mt-3 text-2xl font-black tracking-tight sm:text-3xl">{title}</h1>
            <p className="mt-1 text-sm font-medium text-sky-100">
              {resolvedSubtitle}
              {subtitle ? (
                <>
                  {" "}
                  · <span className="whitespace-nowrap">{userName}</span>
                </>
              ) : null}
            </p>
          </div>

          <div className="flex shrink-0 flex-wrap items-center gap-2 sm:flex-col sm:items-end">
            <Link
              href="/account/password"
              className="inline-flex min-h-11 items-center rounded-xl border border-white/25 bg-white/10 px-3 text-sm font-semibold text-white backdrop-blur transition hover:bg-white/20"
            >
              Password
            </Link>
            <SignOutButton className="inline-flex min-h-11 items-center rounded-xl border border-white/25 bg-white/10 px-3 text-sm font-semibold text-white backdrop-blur transition hover:bg-white/20" />
          </div>
        </div>
      </div>
    </header>
  );
}
