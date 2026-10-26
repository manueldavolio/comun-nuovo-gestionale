"use client";

import { signOut } from "next-auth/react";

type SignOutButtonProps = {
  className?: string;
};

export function SignOutButton({
  className = "rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50",
}: SignOutButtonProps) {
  return (
    <button
      type="button"
      onClick={() => signOut({ callbackUrl: "/login" })}
      className={className}
    >
      Esci
    </button>
  );
}
