"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import type { AnnouncementAudience } from "@/generated/prisma/enums";
import {
  createAnnouncementSchema,
  type CreateAnnouncementInput,
} from "@/lib/validation/announcements";
import { ANNOUNCEMENT_AUDIENCE_CHOICES } from "@/lib/announcements";

type CategoryOption = {
  id: string;
  name: string;
};

type AnnouncementFormProps = {
  categories: CategoryOption[];
};

type AnnouncementFieldErrors = Partial<Record<keyof CreateAnnouncementInput, string>>;

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="mt-1 text-xs text-red-600">{message}</p>;
}

export function AnnouncementForm({ categories }: AnnouncementFormProps) {
  const router = useRouter();
  const [formData, setFormData] = useState({
    title: "",
    content: "",
    audience: "ALL" as AnnouncementAudience,
    categoryId: "",
    publishedAt: "",
  });
  const [fieldErrors, setFieldErrors] = useState<AnnouncementFieldErrors>({});
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setOk(null);
    setFieldErrors({});

    const parsed = createAnnouncementSchema.safeParse({
      ...formData,
      categoryId: formData.categoryId || null,
      publishedAt: formData.publishedAt || null,
    });

    if (!parsed.success) {
      const nextErrors: AnnouncementFieldErrors = {};
      parsed.error.issues.forEach((issue) => {
        const field = issue.path[0];
        if (typeof field === "string" && !(field in nextErrors)) {
          nextErrors[field as keyof CreateAnnouncementInput] = issue.message;
        }
      });
      setFieldErrors(nextErrors);
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch("/api/admin/announcements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
      });
      const body = (await response.json().catch(() => null)) as { error?: string } | null;

      if (!response.ok) {
        setError(body?.error ?? "Operazione non riuscita. Riprova.");
        setIsSubmitting(false);
        return;
      }

      setOk("Comunicazione pubblicata correttamente.");
      setFormData({
        title: "",
        content: "",
        audience: "ALL",
        categoryId: "",
        publishedAt: "",
      });
      router.refresh();
    } catch {
      setError("Errore imprevisto. Riprova.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="rounded-xl border border-blue-100 bg-white p-4 shadow-sm">
      <h2 className="text-lg font-semibold text-zinc-900">Nuova comunicazione</h2>
      <p className="mt-1 text-sm text-zinc-600">
        Pubblica avvisi per tutti, solo genitori, solo mister o una categoria specifica.
      </p>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <div className="md:col-span-2">
          <label className="text-sm font-medium text-zinc-700" htmlFor="announcement-title">
            Titolo
          </label>
          <input
            id="announcement-title"
            value={formData.title}
            onChange={(event) => setFormData((prev) => ({ ...prev, title: event.target.value }))}
            className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none ring-blue-500 focus:ring-2"
          />
          <FieldError message={fieldErrors.title} />
        </div>

        <div>
          <label className="text-sm font-medium text-zinc-700" htmlFor="announcement-audience">
            Audience
          </label>
          <select
            id="announcement-audience"
            value={formData.audience}
            onChange={(event) =>
              setFormData((prev) => ({
                ...prev,
                audience: event.target.value as AnnouncementAudience,
              }))
            }
            className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none ring-blue-500 focus:ring-2"
          >
            {ANNOUNCEMENT_AUDIENCE_CHOICES.map((choice) => (
              <option key={choice.value} value={choice.value}>
                {choice.label}
              </option>
            ))}
          </select>
          <FieldError message={fieldErrors.audience} />
        </div>

        <div>
          <label className="text-sm font-medium text-zinc-700" htmlFor="announcement-category">
            Categoria (opzionale)
          </label>
          <select
            id="announcement-category"
            value={formData.categoryId}
            onChange={(event) => setFormData((prev) => ({ ...prev, categoryId: event.target.value }))}
            className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none ring-blue-500 focus:ring-2"
          >
            <option value="">Seleziona categoria</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
          <FieldError message={fieldErrors.categoryId} />
        </div>

        <div>
          <label className="text-sm font-medium text-zinc-700" htmlFor="announcement-publish-date">
            Data pubblicazione
          </label>
          <input
            id="announcement-publish-date"
            type="date"
            value={formData.publishedAt}
            onChange={(event) => setFormData((prev) => ({ ...prev, publishedAt: event.target.value }))}
            className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none ring-blue-500 focus:ring-2"
          />
          <FieldError message={fieldErrors.publishedAt} />
        </div>

        <div className="md:col-span-2">
          <label className="text-sm font-medium text-zinc-700" htmlFor="announcement-content">
            Contenuto
          </label>
          <textarea
            id="announcement-content"
            rows={4}
            value={formData.content}
            onChange={(event) => setFormData((prev) => ({ ...prev, content: event.target.value }))}
            className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none ring-blue-500 focus:ring-2"
          />
          <FieldError message={fieldErrors.content} />
        </div>
      </div>

      {error ? (
        <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      ) : null}

      {ok ? (
        <p className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          {ok}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={isSubmitting}
        className="mt-4 w-full rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-70"
      >
        {isSubmitting ? "Pubblicazione..." : "Pubblica comunicazione"}
      </button>
    </form>
  );
}
