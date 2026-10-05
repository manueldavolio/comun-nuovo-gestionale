import { SignOutButton } from "@/components/auth/sign-out-button";
import Link from "next/link";

type MisterHeroProps = {
  userName: string;
  categoryNames: string[];
};

export function MisterHero({ userName, categoryNames }: MisterHeroProps) {
  const first = userName.trim().split(/\s+/)[0] || "Mister";

  return (
    <header className="overflow-hidden rounded-2xl border border-blue-700 bg-blue-800 text-white shadow-md">
      <div className="relative p-5 sm:p-6">
        <div className="absolute -right-10 top-0 h-40 w-40 rounded-full bg-sky-400/15" aria-hidden />
        <div className="relative flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/logo-home.png"
                alt=""
                className="h-9 w-9 rounded-full bg-white/95 object-contain p-0.5 shadow-sm"
              />
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-sky-200">
                ASD Comun Nuovo · Area tecnica
              </p>
            </div>
            <h1 className="mt-3 text-2xl font-black tracking-tight sm:text-3xl">
              Buongiorno, Mister {first}
            </h1>
            <p className="mt-1 text-sm text-sky-100">
              Panoramica operativa delle tue categorie
            </p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {categoryNames.length === 0 ? (
                <span className="rounded-full border border-amber-300/40 bg-amber-400/20 px-3 py-1 text-xs font-semibold text-amber-50">
                  Nessuna categoria assegnata
                </span>
              ) : (
                categoryNames.map((name) => (
                  <span
                    key={name}
                    className="rounded-full border border-white/20 bg-white/15 px-3 py-1 text-xs font-semibold"
                  >
                    {name}
                  </span>
                ))
              )}
            </div>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-2">
            <Link
              href="/account/password"
              className="rounded-lg border border-white/25 bg-white/10 px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/15"
            >
              Password
            </Link>
            <SignOutButton />
          </div>
        </div>
      </div>
    </header>
  );
}
