"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ImageUploadField } from "@/components/site-web/image-upload-field";
import {
  SITE_PLAYER_ROLE_LABELS,
  SITE_TEAM_LABELS,
  type SitePlayerRoleValue,
  type SiteTeamValue,
} from "@/lib/site-cms";
import { upsertSitePlayerSchema } from "@/lib/validation/site";

type SitePlayerFormValues = {
  name: string;
  role: SitePlayerRoleValue;
  team: SiteTeamValue;
  shirtNumber: string;
  description: string;
  photoUrl: string;
  isVisible: boolean;
};

type SitePlayerFormProps = {
  mode: "create" | "edit";
  playerId?: string;
  initialValues: SitePlayerFormValues;
};

type FieldErrors = Partial<Record<keyof SitePlayerFormValues, string>>;

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="mt-1 text-xs text-red-600">{message}</p>;
}

const inputClass =
  "mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none ring-blue-500 focus:ring-2";

export function SitePlayerForm({ mode, playerId, initialValues }: SitePlayerFormProps) {
  const router = useRouter();
  const [formData, setFormData] = useState(initialValues);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const apiUrl = mode === "create" ? "/api/admin/site/players" : `/api/admin/site/players/${playerId}`;
  const method = mode === "create" ? "POST" : "PUT";

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setFieldErrors({});

    const parsed = upsertSitePlayerSchema.safeParse({
      name: formData.name,
      role: formData.role,
      team: formData.team,
      shirtNumber: formData.shirtNumber,
      description: formData.description,
      photoUrl: formData.photoUrl,
      isVisible: formData.isVisible,
    });

    if (!parsed.success) {
      const nextErrors: FieldErrors = {};
      parsed.error.issues.forEach((issue) => {
        const field = issue.path[0];
        if (typeof field === "string" && !(field in nextErrors)) {
          nextErrors[field as keyof SitePlayerFormValues] = issue.message;
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
        body: JSON.stringify(parsed.data),
      });

      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        setError(body?.error ?? "Operazione non riuscita. Riprova.");
        setIsSubmitting(false);
        return;
      }

      router.push("/admin/sito-web/giocatori");
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
          {mode === "create" ? "Nuovo giocatore" : "Modifica giocatore"}
        </h2>
        <p className="mt-1 text-sm text-zinc-600">
          I dati vengono mostrati nella rosa della squadra sul sito pubblico.
        </p>

        <div className="mt-4 grid gap-4">
          <div>
            <label className="text-sm font-medium text-zinc-700" htmlFor="name">
              Nome e cognome
            </label>
            <input
              id="name"
              value={formData.name}
              onChange={(event) => setFormData((prev) => ({ ...prev, name: event.target.value }))}
              className={inputClass}
            />
            <FieldError message={fieldErrors.name} />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="text-sm font-medium text-zinc-700" htmlFor="team">
                Squadra
              </label>
              <select
                id="team"
                value={formData.team}
                onChange={(event) =>
                  setFormData((prev) => ({ ...prev, team: event.target.value as SiteTeamValue }))
                }
                className={inputClass}
              >
                {Object.entries(SITE_TEAM_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
              <FieldError message={fieldErrors.team} />
            </div>

            <div>
              <label className="text-sm font-medium text-zinc-700" htmlFor="role">
                Ruolo
              </label>
              <select
                id="role"
                value={formData.role}
                onChange={(event) =>
                  setFormData((prev) => ({ ...prev, role: event.target.value as SitePlayerRoleValue }))
                }
                className={inputClass}
              >
                {Object.entries(SITE_PLAYER_ROLE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
              <FieldError message={fieldErrors.role} />
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-zinc-700" htmlFor="shirtNumber">
              Numero maglia (opzionale)
            </label>
            <input
              id="shirtNumber"
              type="number"
              min={1}
              max={99}
              value={formData.shirtNumber}
              onChange={(event) => setFormData((prev) => ({ ...prev, shirtNumber: event.target.value }))}
              placeholder="es. 10"
              className={inputClass}
            />
            <FieldError message={fieldErrors.shirtNumber} />
          </div>

          <div>
            <label className="text-sm font-medium text-zinc-700" htmlFor="description">
              Descrizione (opzionale)
            </label>
            <textarea
              id="description"
              rows={3}
              value={formData.description}
              onChange={(event) => setFormData((prev) => ({ ...prev, description: event.target.value }))}
              placeholder="Breve presentazione del giocatore"
              className={inputClass}
            />
            <FieldError message={fieldErrors.description} />
          </div>

          <ImageUploadField
            label="Foto giocatore (opzionale)"
            folder="players"
            value={formData.photoUrl}
            onChange={(url) => setFormData((prev) => ({ ...prev, photoUrl: url }))}
          />
          <FieldError message={fieldErrors.photoUrl} />

          <label className="flex items-center gap-3 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-700">
            <input
              type="checkbox"
              checked={formData.isVisible}
              onChange={(event) => setFormData((prev) => ({ ...prev, isVisible: event.target.checked }))}
              className="h-4 w-4 rounded border-zinc-300 text-blue-700 focus:ring-blue-500"
            />
            Visibile sul sito pubblico
          </label>
        </div>

        {error ? (
          <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
        ) : null}

        <button
          type="submit"
          disabled={isSubmitting}
          className="mt-4 w-full rounded-lg bg-blue-700 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSubmitting ? "Salvataggio..." : mode === "create" ? "Crea giocatore" : "Salva modifiche"}
        </button>
      </section>
    </form>
  );
}
