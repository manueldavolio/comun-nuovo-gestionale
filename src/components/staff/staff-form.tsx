"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import type { UserRole } from "@prisma/client";
import { STAFF_ROLE_OPTIONS, roleLabelMap } from "@/lib/staff";
import { upsertStaffSchema, type UpsertStaffInput } from "@/lib/validation/staff";

type StaffFormProps = {
  mode: "create" | "edit";
  staffId?: string;
  categories: Array<{ id: string; name: string }>;
  initialValues: {
    firstName: string;
    lastName: string;
    email: string;
    role: UserRole;
    categoryIds: string[];
  };
};

type StaffFieldErrors = Partial<Record<keyof UpsertStaffInput, string>>;

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="mt-1 text-xs text-red-600">{message}</p>;
}

export function StaffForm({ mode, staffId, categories, initialValues }: StaffFormProps) {
  const router = useRouter();
  const [formData, setFormData] = useState(initialValues);
  const [fieldErrors, setFieldErrors] = useState<StaffFieldErrors>({});
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const apiUrl = mode === "create" ? "/api/admin/staff" : `/api/admin/staff/${staffId}`;
  const method = mode === "create" ? "POST" : "PUT";

  function toggleCategory(categoryId: string) {
    setFormData((prev) => {
      const isSelected = prev.categoryIds.includes(categoryId);
      return {
        ...prev,
        categoryIds: isSelected
          ? prev.categoryIds.filter((id) => id !== categoryId)
          : [...prev.categoryIds, categoryId],
      };
    });
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setFieldErrors({});

    const parsed = upsertStaffSchema.safeParse(formData);
    if (!parsed.success) {
      const nextErrors: StaffFieldErrors = {};
      parsed.error.issues.forEach((issue) => {
        const field = issue.path[0];
        if (typeof field === "string" && !(field in nextErrors)) {
          nextErrors[field as keyof UpsertStaffInput] = issue.message;
        }
      });
      setFieldErrors(nextErrors);
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch(apiUrl, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...parsed.data,
          categoryIds: [...new Set(parsed.data.categoryIds)],
        }),
      });

      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        setError(body?.error ?? "Operazione non riuscita. Riprova.");
        setIsSubmitting(false);
        return;
      }

      router.push("/admin/staff");
      router.refresh();
    } catch {
      setError("Errore imprevisto. Riprova.");
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <section className="rounded-xl border border-blue-100 bg-white p-4 shadow-sm">
        <h2 className="text-lg font-semibold text-zinc-900">
          {mode === "create" ? "Nuovo membro staff" : "Modifica membro staff"}
        </h2>
        <p className="mt-1 text-sm text-zinc-600">
          Gestisci anagrafica, ruolo e categorie assegnate per lo staff tecnico.
        </p>

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div>
            <label className="text-sm font-medium text-zinc-700" htmlFor="firstName">
              Nome
            </label>
            <input
              id="firstName"
              value={formData.firstName}
              onChange={(event) => setFormData((prev) => ({ ...prev, firstName: event.target.value }))}
              className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none ring-blue-500 focus:ring-2"
            />
            <FieldError message={fieldErrors.firstName} />
          </div>

          <div>
            <label className="text-sm font-medium text-zinc-700" htmlFor="lastName">
              Cognome
            </label>
            <input
              id="lastName"
              value={formData.lastName}
              onChange={(event) => setFormData((prev) => ({ ...prev, lastName: event.target.value }))}
              className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none ring-blue-500 focus:ring-2"
            />
            <FieldError message={fieldErrors.lastName} />
          </div>

          <div className="md:col-span-2">
            <label className="text-sm font-medium text-zinc-700" htmlFor="email">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={formData.email}
              onChange={(event) => setFormData((prev) => ({ ...prev, email: event.target.value }))}
              className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none ring-blue-500 focus:ring-2"
            />
            <FieldError message={fieldErrors.email} />
          </div>

          <div className="md:col-span-2">
            <label className="text-sm font-medium text-zinc-700" htmlFor="role">
              Ruolo
            </label>
            <select
              id="role"
              value={formData.role}
              onChange={(event) =>
                setFormData((prev) => ({
                  ...prev,
                  role: event.target.value as UserRole,
                }))
              }
              className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none ring-blue-500 focus:ring-2"
            >
              {STAFF_ROLE_OPTIONS.map((role) => (
                <option key={role} value={role}>
                  {roleLabelMap[role]}
                </option>
              ))}
            </select>
            <FieldError message={fieldErrors.role} />
          </div>
        </div>

        <div className="mt-6">
          <p className="text-sm font-medium text-zinc-700">Categorie assegnate</p>
          {categories.length === 0 ? (
            <p className="mt-2 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-700">
              Nessuna categoria disponibile.
            </p>
          ) : (
            <div className="mt-2 grid gap-2 md:grid-cols-2">
              {categories.map((category) => (
                <label
                  key={category.id}
                  className="flex items-center gap-3 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-700"
                >
                  <input
                    type="checkbox"
                    checked={formData.categoryIds.includes(category.id)}
                    onChange={() => toggleCategory(category.id)}
                    className="h-4 w-4 rounded border-zinc-300 text-blue-700 focus:ring-blue-500"
                  />
                  {category.name}
                </label>
              ))}
            </div>
          )}
          <FieldError message={fieldErrors.categoryIds} />
        </div>

        {error ? (
          <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
        ) : null}

        <button
          type="submit"
          disabled={isSubmitting}
          className="mt-4 w-full rounded-lg bg-blue-700 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSubmitting ? "Salvataggio..." : mode === "create" ? "Crea membro staff" : "Salva modifiche"}
        </button>
      </section>
    </form>
  );
}
