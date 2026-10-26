import { notFound } from "next/navigation";
import { AdminShellLabClient } from "./admin-shell-lab-client";

/**
 * Lab locale SOLO development: shell Admin reale senza auth.
 * Fuori dal matcher middleware. In production → 404.
 */
export default function AdminShellLabPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <AdminShellLabClient />;
}
