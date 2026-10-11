import Link from "next/link";
import { SignOutButton } from "@/components/auth/sign-out-button";

type AdminDashboardHeroProps = {
  userName: string;
  seasonLabel?: string | null;
};

export function AdminDashboardHero({ userName, seasonLabel }: AdminDashboardHeroProps) {
  return (
    <header className="overflow-hidden rounded-2xl border border-blue-950 bg-gradient-to-br from-slate-950 via-blue-950 to-blue-900 text-white shadow-md">
      <div className="relative p-5 sm:p-6">
        <div
          className="absolute -right-12 -top-8 h-44 w-44 rounded-full bg-sky-400/10"
          aria-hidden
        />
        <div
          className="absolute -bottom-16 left-1/3 h-40 w-40 rounded-full bg-blue-500/10"
          aria-hidden
        />

        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-2.5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/logo-home.png"
                alt=""
                className="h-10 w-10 rounded-full bg-white/95 object-contain p-0.5 shadow-sm sm:h-11 sm:w-11"
              />
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-sky-200">
                  Comun Nuovo Calcio
                </p>
                {seasonLabel ? (
                  <p className="text-[11px] font-medium text-sky-200/80">
                    Stagione {seasonLabel}
                  </p>
                ) : null}
              </div>
            </div>

            <h1 className="mt-3 text-2xl font-black tracking-tight sm:text-3xl">
              Centro di controllo
            </h1>
            <p className="mt-1 text-sm text-sky-100">
              Panoramica operativa · {userName}
            </p>
          </div>

          <div className="flex shrink-0 flex-wrap items-center gap-2 sm:flex-col sm:items-end">
            <Link
              href="/account/password"
              className="rounded-lg border border-white/25 bg-white/10 px-3 py-2 text-sm font-semibold text-white hover:bg-white/15"
            >
              Cambia password
            </Link>
            <div className="[&_button]:border-white/30 [&_button]:bg-white/10 [&_button]:text-white [&_button]:hover:bg-white/15">
              <SignOutButton />
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
