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
  return <p className="mt-1 text-xs font-medium text-red-600">{message}</p>;
}

const inputClass =
  "mt-1.5 min-h-11 w-full rounded-xl border border-sky-200 bg-white px-3 py-2 text-sm font-medium text-blue-950 outline-none ring-blue-500 focus:ring-2";

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
    <form onSubmit={onSubmit} className="space-y-4">
      <section className="rounded-3xl border border-sky-100 bg-white p-4 shadow-sm sm:p-5">
        <h2 className="text-base font-black text-blue-950">
          {mode === "create" ? "Nuovo membro staff" : "Modifica membro staff"}
        </h2>
        <p className="mt-1 text-sm text-zinc-600">
          Anagrafica, ruolo e categorie assegnate allo staff tecnico.
        </p>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <div>
            <label className="text-sm font-bold text-blue-950" htmlFor="firstName">
              Nome
            </label>
            <input
              id="firstName"
              value={formData.firstName}
              onChange={(event) => setFormData((prev) => ({ ...prev, firstName: event.target.value }))}
              className={inputClass}
            />
            <FieldError message={fieldErrors.firstName} />
          </div>

          <div>
            <label className="text-sm font-bold text-blue-950" htmlFor="lastName">
              Cognome
            </label>
            <input
              id="lastName"
              value={formData.lastName}
              onChange={(event) => setFormData((prev) => ({ ...prev, lastName: event.target.value }))}
              className={inputClass}
            />
            <FieldError message={fieldErrors.lastName} />
          </div>

          <div className="sm:col-span-2">
            <label className="text-sm font-bold text-blue-950" htmlFor="email">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={formData.email}
              onChange={(event) => setFormData((prev) => ({ ...prev, email: event.target.value }))}
              className={inputClass}
            />
            <FieldError message={fieldErrors.email} />
          </div>

          <div className="sm:col-span-2">
            <label className="text-sm font-bold text-blue-950" htmlFor="role">
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
              className={inputClass}
            >
              {STAFF_ROLE_OPTIONS.map((roleOption) => (
                <option key={roleOption} value={roleOption}>
                  {roleLabelMap[roleOption]}
                </option>
              ))}
            </select>
            <FieldError message={fieldErrors.role} />
          </div>
        </div>

        <div className="mt-6">
          <p className="text-sm font-bold text-blue-950">Categorie assegnate</p>
          {categories.length === 0 ? (
            <p className="mt-2 rounded-2xl border border-sky-100 bg-sky-50/50 px-3 py-2 text-sm text-zinc-700">
              Nessuna categoria disponibile.
            </p>
          ) : (
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {categories.map((category) => {
                const selected = formData.categoryIds.includes(category.id);
                return (
                  <label
                    key={category.id}
                    className={`flex min-h-12 items-center gap-3 rounded-2xl border px-3 py-2.5 text-sm font-semibold transition ${
                      selected
                        ? "border-blue-700 bg-blue-50 text-blue-950"
                        : "border-sky-100 bg-sky-50/40 text-zinc-700"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={selected}
                      onChange={() => toggleCategory(category.id)}
                      className="h-4 w-4 rounded border-sky-300 text-blue-800 focus:ring-blue-500"
                    />
                    {category.name}
                  </label>
                );
              })}
            </div>
          )}
          <FieldError message={fieldErrors.categoryIds} />
        </div>

        {error ? (
          <p className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
            {error}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={isSubmitting}
          className="mt-5 inline-flex min-h-12 w-full items-center justify-center rounded-2xl bg-blue-800 px-4 text-sm font-bold text-white transition hover:bg-blue-900 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSubmitting
            ? "Salvataggio..."
            : mode === "create"
              ? "Crea membro staff"
              : "Salva modifiche"}
        </button>
      </section>
    </form>
  );
}
