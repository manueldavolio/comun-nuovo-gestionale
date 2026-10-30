"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ImageUploadField } from "@/components/site-web/image-upload-field";
import { FAMILY_BENEFIT_AUDIENCE_LABEL } from "@/lib/family-benefits";
import { upsertFamilyBenefitSchema } from "@/lib/validation/family-benefits";

type FormValues = {
  name: string;
  businessName: string;
  description: string;
  discountLabel: string;
  promoCode: string;
  conditions: string;
  logoUrl: string;
  websiteUrl: string;
  contactInfo: string;
  expiresAt: string;
  audience: "ALL" | "YOUTH" | "FIRST_TEAM" | "BASE_ACTIVITY";
  isPublished: boolean;
  isActive: boolean;
  sortOrder: number;
  priority: number;
};

type Props = {
  mode: "create" | "edit";
  benefitId?: string;
  initialValues: FormValues;
};

export function FamilyBenefitForm({ mode, benefitId, initialValues }: Props) {
  const router = useRouter();
  const [formData, setFormData] = useState(initialValues);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    const parsed = upsertFamilyBenefitSchema.safeParse({
      ...formData,
      businessName: formData.businessName || null,
      discountLabel: formData.discountLabel || null,
      promoCode: formData.promoCode || null,
      conditions: formData.conditions || null,
      logoUrl: formData.logoUrl || null,
      websiteUrl: formData.websiteUrl || null,
      contactInfo: formData.contactInfo || null,
      expiresAt: formData.expiresAt || null,
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Dati non validi.");
      return;
    }
    setSaving(true);
    try {
      const response = await fetch(
        mode === "create"
          ? "/api/admin/family-benefits"
          : `/api/admin/family-benefits/${benefitId}`,
        {
          method: mode === "create" ? "POST" : "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(parsed.data),
        },
      );
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        setError(body?.error ?? "Salvataggio non riuscito.");
        setSaving(false);
        return;
      }
      router.push("/admin/sito-web/convenzioni");
      router.refresh();
    } catch {
      setError("Errore imprevisto.");
      setSaving(false);
    }
  }

  const input =
    "mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none ring-blue-500 focus:ring-2";

  return (
    <form onSubmit={onSubmit} className="space-y-4 rounded-2xl border border-sky-100 bg-white p-4 shadow-sm">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="text-sm font-semibold text-blue-950">
          Nome convenzione
          <input
            className={input}
            value={formData.name}
            onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value }))}
            required
          />
        </label>
        <label className="text-sm font-semibold text-blue-950">
          Attività / partner
          <input
            className={input}
            value={formData.businessName}
            onChange={(e) => setFormData((p) => ({ ...p, businessName: e.target.value }))}
          />
        </label>
      </div>
      <label className="block text-sm font-semibold text-blue-950">
        Descrizione
        <textarea
          className={input}
          rows={4}
          value={formData.description}
          onChange={(e) => setFormData((p) => ({ ...p, description: e.target.value }))}
          required
        />
      </label>
      <div className="grid gap-4 sm:grid-cols-3">
        <label className="text-sm font-semibold text-blue-950">
          Sconto
          <input
            className={input}
            value={formData.discountLabel}
            onChange={(e) => setFormData((p) => ({ ...p, discountLabel: e.target.value }))}
            placeholder="es. -15%"
          />
        </label>
        <label className="text-sm font-semibold text-blue-950">
          Codice
          <input
            className={input}
            value={formData.promoCode}
            onChange={(e) => setFormData((p) => ({ ...p, promoCode: e.target.value }))}
          />
        </label>
        <label className="text-sm font-semibold text-blue-950">
          Scadenza
          <input
            type="date"
            className={input}
            value={formData.expiresAt}
            onChange={(e) => setFormData((p) => ({ ...p, expiresAt: e.target.value }))}
          />
        </label>
      </div>
      <label className="block text-sm font-semibold text-blue-950">
        Condizioni
        <textarea
          className={input}
          rows={3}
          value={formData.conditions}
          onChange={(e) => setFormData((p) => ({ ...p, conditions: e.target.value }))}
        />
      </label>
      <ImageUploadField
        label="Logo / immagine"
        folder="convenzioni"
        value={formData.logoUrl}
        onChange={(logoUrl) => setFormData((p) => ({ ...p, logoUrl }))}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="text-sm font-semibold text-blue-950">
          Link
          <input
            className={input}
            value={formData.websiteUrl}
            onChange={(e) => setFormData((p) => ({ ...p, websiteUrl: e.target.value }))}
            placeholder="https://"
          />
        </label>
        <label className="text-sm font-semibold text-blue-950">
          Contatti
          <input
            className={input}
            value={formData.contactInfo}
            onChange={(e) => setFormData((p) => ({ ...p, contactInfo: e.target.value }))}
          />
        </label>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <label className="text-sm font-semibold text-blue-950">
          Destinatari
          <select
            className={input}
            value={formData.audience}
            onChange={(e) =>
              setFormData((p) => ({
                ...p,
                audience: e.target.value as FormValues["audience"],
              }))
            }
          >
            {(Object.keys(FAMILY_BENEFIT_AUDIENCE_LABEL) as FormValues["audience"][]).map((key) => (
              <option key={key} value={key}>
                {FAMILY_BENEFIT_AUDIENCE_LABEL[key]}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm font-semibold text-blue-950">
          Priorità
          <input
            type="number"
            className={input}
            value={formData.priority}
            onChange={(e) => setFormData((p) => ({ ...p, priority: Number(e.target.value) }))}
          />
        </label>
        <label className="text-sm font-semibold text-blue-950">
          Ordine
          <input
            type="number"
            className={input}
            value={formData.sortOrder}
            onChange={(e) => setFormData((p) => ({ ...p, sortOrder: Number(e.target.value) }))}
          />
        </label>
      </div>
      <div className="flex flex-wrap gap-4 text-sm font-semibold text-blue-950">
        <label className="inline-flex items-center gap-2">
          <input
            type="checkbox"
            checked={formData.isPublished}
            onChange={(e) => setFormData((p) => ({ ...p, isPublished: e.target.checked }))}
          />
          Pubblicata
        </label>
        <label className="inline-flex items-center gap-2">
          <input
            type="checkbox"
            checked={formData.isActive}
            onChange={(e) => setFormData((p) => ({ ...p, isActive: e.target.checked }))}
          />
          Attiva
        </label>
      </div>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <button
        type="submit"
        disabled={saving}
        className="rounded-xl bg-blue-800 px-4 py-2 text-sm font-bold text-white hover:bg-blue-900 disabled:opacity-60"
      >
        {saving ? "Salvataggio..." : "Salva convenzione"}
      </button>
    </form>
  );
}
