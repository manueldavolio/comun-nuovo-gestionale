import { SignOutButton } from "@/components/auth/sign-out-button";
import Link from "next/link";

type AreaHeaderProps = {
  title: string;
  subtitle: string;
  userName: string;
};

export function AreaHeader({ title, subtitle, userName }: AreaHeaderProps) {
  return (
    <header className="flex items-center justify-between gap-3 rounded-xl border border-blue-100 bg-white p-4 shadow-sm">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-blue-700">
          Comun Nuovo Calcio
        </p>
        <h1 className="text-xl font-semibold text-zinc-900">{title}</h1>
        <p className="text-sm text-zinc-600">
          {subtitle} - {userName}
        </p>
      </div>
      <div className="flex flex-wrap items-center justify-end gap-2">
        <Link
          href="/account/password"
          className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-medium text-blue-700 hover:bg-blue-100"
        >
          Cambia password
        </Link>
        <SignOutButton />
      </div>
    </header>
  );
}
