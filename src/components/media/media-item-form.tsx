"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import type { MediaType } from "@/generated/prisma/enums";
import { createMediaItemSchema, type CreateMediaItemInput } from "@/lib/validation/media";
import { MEDIA_TYPE_CHOICES } from "@/lib/media";

type CategoryOption = {
  id: string;
  name: string;
};

type MediaItemFormProps = {
  categories: CategoryOption[];
  title?: string;
};

type MediaFieldErrors = Partial<Record<keyof CreateMediaItemInput, string>>;

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="mt-1 text-xs text-red-600">{message}</p>;
}

export function MediaItemForm({ categories, title = "Nuovo media" }: MediaItemFormProps) {
  const router = useRouter();
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    mediaType: "PHOTO" as MediaType,
    categoryId: categories[0]?.id ?? "",
    filePath: "",
    mediaUrl: "",
    publishedAt: "",
  });
  const [fieldErrors, setFieldErrors] = useState<MediaFieldErrors>({});
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setOk(null);
    setFieldErrors({});

    const parsed = createMediaItemSchema.safeParse({
      ...formData,
      description: formData.description || null,
      filePath: formData.filePath || null,
      mediaUrl: formData.mediaUrl || null,
      publishedAt: formData.publishedAt || null,
    });

    if (!parsed.success) {
      const nextErrors: MediaFieldErrors = {};
      parsed.error.issues.forEach((issue) => {
        const field = issue.path[0];
        if (typeof field === "string" && !(field in nextErrors)) {
          nextErrors[field as keyof CreateMediaItemInput] = issue.message;
        }
      });
      setFieldErrors(nextErrors);
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch("/api/media", {
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

      setOk("Media pubblicato correttamente.");
      setFormData((prev) => ({
        ...prev,
        title: "",
        description: "",
        filePath: "",
        mediaUrl: "",
        publishedAt: "",
      }));
      router.refresh();
    } catch {
      setError("Errore imprevisto. Riprova.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="rounded-xl border border-blue-100 bg-white p-4 shadow-sm">
      <h2 className="text-lg font-semibold text-zinc-900">{title}</h2>
      <p className="mt-1 text-sm text-zinc-600">
        Inserisci URL o filePath stabile. Upload cloud avanzato non ancora attivo.
      </p>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <div className="md:col-span-2">
          <label className="text-sm font-medium text-zinc-700" htmlFor="media-title">
            Titolo
          </label>
          <input
            id="media-title"
            value={formData.title}
            onChange={(event) => setFormData((prev) => ({ ...prev, title: event.target.value }))}
            className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none ring-blue-500 focus:ring-2"
          />
          <FieldError message={fieldErrors.title} />
        </div>

        <div>
          <label className="text-sm font-medium text-zinc-700" htmlFor="media-type">
            Tipo media
          </label>
          <select
            id="media-type"
            value={formData.mediaType}
            onChange={(event) => setFormData((prev) => ({ ...prev, mediaType: event.target.value as MediaType }))}
            className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none ring-blue-500 focus:ring-2"
          >
            {MEDIA_TYPE_CHOICES.map((choice) => (
              <option key={choice.value} value={choice.value}>
                {choice.label}
              </option>
            ))}
          </select>
          <FieldError message={fieldErrors.mediaType} />
        </div>

        <div>
          <label className="text-sm font-medium text-zinc-700" htmlFor="media-category">
            Categoria
          </label>
          <select
            id="media-category"
            value={formData.categoryId}
            onChange={(event) => setFormData((prev) => ({ ...prev, categoryId: event.target.value }))}
            className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none ring-blue-500 focus:ring-2"
          >
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
          <FieldError message={fieldErrors.categoryId} />
        </div>

        <div>
          <label className="text-sm font-medium text-zinc-700" htmlFor="media-url">
            Media URL
          </label>
          <input
            id="media-url"
            value={formData.mediaUrl}
            onChange={(event) => setFormData((prev) => ({ ...prev, mediaUrl: event.target.value }))}
            placeholder="https://..."
            className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none ring-blue-500 focus:ring-2"
          />
          <FieldError message={fieldErrors.mediaUrl} />
        </div>

        <div>
          <label className="text-sm font-medium text-zinc-700" htmlFor="media-file-path">
            FilePath
          </label>
          <input
            id="media-file-path"
            value={formData.filePath}
            onChange={(event) => setFormData((prev) => ({ ...prev, filePath: event.target.value }))}
            placeholder="manual-placeholder/media/asset.jpg"
            className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none ring-blue-500 focus:ring-2"
          />
          <FieldError message={fieldErrors.filePath} />
        </div>

        <div>
          <label className="text-sm font-medium text-zinc-700" htmlFor="media-published-at">
            Data pubblicazione
          </label>
          <input
            id="media-published-at"
            type="date"
            value={formData.publishedAt}
            onChange={(event) => setFormData((prev) => ({ ...prev, publishedAt: event.target.value }))}
            className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none ring-blue-500 focus:ring-2"
          />
          <FieldError message={fieldErrors.publishedAt} />
        </div>

        <div className="md:col-span-2">
          <label className="text-sm font-medium text-zinc-700" htmlFor="media-description">
            Descrizione (facoltativa)
          </label>
          <textarea
            id="media-description"
            rows={3}
            value={formData.description}
            onChange={(event) => setFormData((prev) => ({ ...prev, description: event.target.value }))}
            className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none ring-blue-500 focus:ring-2"
          />
          <FieldError message={fieldErrors.description} />
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
        disabled={isSubmitting || categories.length === 0}
        className="mt-4 w-full rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-70"
      >
        {isSubmitting ? "Salvataggio..." : "Pubblica media"}
      </button>
    </form>
  );
}
