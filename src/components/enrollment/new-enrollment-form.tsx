"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { enrollmentSchema, type EnrollmentInput } from "@/lib/validation/enrollment";

type CategoryOption = {
  id: string;
  name: string;
  birthYearsLabel: string;
  seasonLabel: string;
};

type NewEnrollmentFormProps = {
  categories: CategoryOption[];
  defaultParentData: {
    firstName: string;
    lastName: string;
    taxCode: string;
    phone: string;
    address: string;
    city: string;
    postalCode: string;
    province: string;
    email: string;
  };
};

type EnrollmentFieldErrors = Partial<Record<keyof EnrollmentInput, string>>;

const ATHLETE_GENDER_OPTIONS = [
  { value: "MALE", label: "Maschio" },
  { value: "FEMALE", label: "Femmina" },
  { value: "OTHER", label: "Altro" },
] as const;

function FieldError({ message }: { message?: string }) {
  if (!message) {
    return null;
  }

  return <p className="mt-1 text-xs text-red-600">{message}</p>;
}

export function NewEnrollmentForm({ categories, defaultParentData }: NewEnrollmentFormProps) {
  const router = useRouter();
  const firstCategory = categories[0];
  const [formData, setFormData] = useState<EnrollmentInput>({
    athleteFirstName: "",
    athleteLastName: "",
    athleteGender: "MALE",
    athleteBirthDate: "",
    athleteBirthPlace: "",
    athleteTaxCode: "",
    athleteNationality: "Italiana",
    athleteAddress: "",
    athleteCity: "",
    athletePostalCode: "",
    athleteProvince: "",
    athleteClothingSize: "",
    athleteMedicalNotes: "",
    receiptFirstName: defaultParentData.firstName,
    receiptLastName: defaultParentData.lastName,
    receiptTaxCode: defaultParentData.taxCode,
    receiptPhone: defaultParentData.phone,
    receiptAddress: defaultParentData.address,
    receiptCity: defaultParentData.city,
    receiptPostalCode: defaultParentData.postalCode,
    receiptProvince: defaultParentData.province,
    receiptEmail: defaultParentData.email,
    categoryId: firstCategory?.id ?? "",
    seasonLabel: firstCategory?.seasonLabel ?? "2026/2027",
    enrollmentNotes: "",
    privacyConsent: false,
    regulationConsent: false,
    imageConsent: false,
  });
  const [fieldErrors, setFieldErrors] = useState<EnrollmentFieldErrors>({});
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  function updateField<Field extends keyof EnrollmentInput>(
    field: Field,
    value: EnrollmentInput[Field],
  ) {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setFieldErrors((prev) => ({ ...prev, [field]: undefined }));
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setFieldErrors({});

    const parsed = enrollmentSchema.safeParse(formData);
    if (!parsed.success) {
      const nextErrors: EnrollmentFieldErrors = {};

      parsed.error.issues.forEach((issue) => {
        const field = issue.path[0];
        if (typeof field === "string" && !(field in nextErrors)) {
          nextErrors[field as keyof EnrollmentInput] = issue.message;
        }
      });

      setFieldErrors(nextErrors);
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch("/api/genitore/enrollments", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(parsed.data),
      });

      const data = (await response.json().catch(() => null)) as { error?: string } | null;

      if (!response.ok) {
        setError(data?.error ?? "Iscrizione non riuscita. Riprova.");
        setIsSubmitting(false);
        return;
      }

      router.push("/genitore?enrolled=1");
      router.refresh();
    } catch {
      setError("Errore imprevisto. Riprova.");
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <section className="rounded-xl border border-blue-100 bg-white p-4 shadow-sm">
        <h2 className="text-lg font-semibold text-zinc-900">Sezione A - Dati atleta</h2>
        <p className="mt-1 text-sm text-zinc-600">
          Inserisci i dati anagrafici completi dell&apos;atleta.
        </p>

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div>
            <label className="text-sm font-medium text-zinc-700" htmlFor="athleteFirstName">
              Nome
            </label>
            <input
              id="athleteFirstName"
              value={formData.athleteFirstName}
              onChange={(event) => updateField("athleteFirstName", event.target.value)}
              className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none ring-blue-500 focus:ring-2"
            />
            <FieldError message={fieldErrors.athleteFirstName} />
          </div>

          <div>
            <label className="text-sm font-medium text-zinc-700" htmlFor="athleteLastName">
              Cognome
            </label>
            <input
              id="athleteLastName"
              value={formData.athleteLastName}
              onChange={(event) => updateField("athleteLastName", event.target.value)}
              className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none ring-blue-500 focus:ring-2"
            />
            <FieldError message={fieldErrors.athleteLastName} />
          </div>

          <div>
            <label className="text-sm font-medium text-zinc-700" htmlFor="athleteGender">
              Sesso
            </label>
            <select
              id="athleteGender"
              value={formData.athleteGender}
              onChange={(event) => updateField("athleteGender", event.target.value as "MALE" | "FEMALE" | "OTHER")}
              className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none ring-blue-500 focus:ring-2"
            >
              {ATHLETE_GENDER_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <FieldError message={fieldErrors.athleteGender} />
          </div>

          <div>
            <label className="text-sm font-medium text-zinc-700" htmlFor="athleteBirthDate">
              Data di nascita
            </label>
            <input
              id="athleteBirthDate"
              type="date"
              value={formData.athleteBirthDate}
              onChange={(event) => updateField("athleteBirthDate", event.target.value)}
              className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none ring-blue-500 focus:ring-2"
            />
            <FieldError message={fieldErrors.athleteBirthDate} />
          </div>

          <div>
            <label className="text-sm font-medium text-zinc-700" htmlFor="athleteBirthPlace">
              Luogo di nascita
            </label>
            <input
              id="athleteBirthPlace"
              value={formData.athleteBirthPlace}
              onChange={(event) => updateField("athleteBirthPlace", event.target.value)}
              className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none ring-blue-500 focus:ring-2"
            />
            <FieldError message={fieldErrors.athleteBirthPlace} />
          </div>

          <div>
            <label className="text-sm font-medium text-zinc-700" htmlFor="athleteTaxCode">
              Codice fiscale
            </label>
            <input
              id="athleteTaxCode"
              value={formData.athleteTaxCode}
              onChange={(event) => updateField("athleteTaxCode", event.target.value.toUpperCase())}
              className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm uppercase outline-none ring-blue-500 focus:ring-2"
            />
            <FieldError message={fieldErrors.athleteTaxCode} />
          </div>

          <div>
            <label className="text-sm font-medium text-zinc-700" htmlFor="athleteNationality">
              Nazionalita
            </label>
            <input
              id="athleteNationality"
              value={formData.athleteNationality}
              onChange={(event) => updateField("athleteNationality", event.target.value)}
              className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none ring-blue-500 focus:ring-2"
            />
            <FieldError message={fieldErrors.athleteNationality} />
          </div>

          <div>
            <label className="text-sm font-medium text-zinc-700" htmlFor="athleteAddress">
              Indirizzo
            </label>
            <input
              id="athleteAddress"
              value={formData.athleteAddress}
              onChange={(event) => updateField("athleteAddress", event.target.value)}
              className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none ring-blue-500 focus:ring-2"
            />
            <FieldError message={fieldErrors.athleteAddress} />
          </div>

          <div>
            <label className="text-sm font-medium text-zinc-700" htmlFor="athleteCity">
              Citta
            </label>
            <input
              id="athleteCity"
              value={formData.athleteCity}
              onChange={(event) => updateField("athleteCity", event.target.value)}
              className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none ring-blue-500 focus:ring-2"
            />
            <FieldError message={fieldErrors.athleteCity} />
          </div>

          <div>
            <label className="text-sm font-medium text-zinc-700" htmlFor="athletePostalCode">
              CAP
            </label>
            <input
              id="athletePostalCode"
              maxLength={5}
              value={formData.athletePostalCode}
              onChange={(event) => updateField("athletePostalCode", event.target.value)}
              className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none ring-blue-500 focus:ring-2"
            />
            <FieldError message={fieldErrors.athletePostalCode} />
          </div>

          <div>
            <label className="text-sm font-medium text-zinc-700" htmlFor="athleteProvince">
              Provincia
            </label>
            <input
              id="athleteProvince"
              maxLength={2}
              value={formData.athleteProvince}
              onChange={(event) => updateField("athleteProvince", event.target.value.toUpperCase())}
              className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm uppercase outline-none ring-blue-500 focus:ring-2"
            />
            <FieldError message={fieldErrors.athleteProvince} />
          </div>

          <div>
            <label className="text-sm font-medium text-zinc-700" htmlFor="athleteClothingSize">
              Taglia abbigliamento
            </label>
            <input
              id="athleteClothingSize"
              value={formData.athleteClothingSize ?? ""}
              onChange={(event) => updateField("athleteClothingSize", event.target.value)}
              className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none ring-blue-500 focus:ring-2"
            />
            <FieldError message={fieldErrors.athleteClothingSize} />
          </div>

          <div className="md:col-span-2">
            <label className="text-sm font-medium text-zinc-700" htmlFor="athleteMedicalNotes">
              Eventuali note mediche
            </label>
            <textarea
              id="athleteMedicalNotes"
              rows={3}
              value={formData.athleteMedicalNotes ?? ""}
              onChange={(event) => updateField("athleteMedicalNotes", event.target.value)}
              className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none ring-blue-500 focus:ring-2"
            />
            <FieldError message={fieldErrors.athleteMedicalNotes} />
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-blue-100 bg-white p-4 shadow-sm">
        <h2 className="text-lg font-semibold text-zinc-900">
          Sezione B - Dati genitore/tutore per ricevuta
        </h2>

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div>
            <label className="text-sm font-medium text-zinc-700" htmlFor="receiptFirstName">
              Nome
            </label>
            <input
              id="receiptFirstName"
              value={formData.receiptFirstName}
              onChange={(event) => updateField("receiptFirstName", event.target.value)}
              className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none ring-blue-500 focus:ring-2"
            />
            <FieldError message={fieldErrors.receiptFirstName} />
          </div>

          <div>
            <label className="text-sm font-medium text-zinc-700" htmlFor="receiptLastName">
              Cognome
            </label>
            <input
              id="receiptLastName"
              value={formData.receiptLastName}
              onChange={(event) => updateField("receiptLastName", event.target.value)}
              className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none ring-blue-500 focus:ring-2"
            />
            <FieldError message={fieldErrors.receiptLastName} />
          </div>

          <div>
            <label className="text-sm font-medium text-zinc-700" htmlFor="receiptTaxCode">
              Codice fiscale
            </label>
            <input
              id="receiptTaxCode"
              value={formData.receiptTaxCode}
              onChange={(event) => updateField("receiptTaxCode", event.target.value.toUpperCase())}
              className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm uppercase outline-none ring-blue-500 focus:ring-2"
            />
            <FieldError message={fieldErrors.receiptTaxCode} />
          </div>

          <div>
            <label className="text-sm font-medium text-zinc-700" htmlFor="receiptPhone">
              Telefono
            </label>
            <input
              id="receiptPhone"
              value={formData.receiptPhone}
              onChange={(event) => updateField("receiptPhone", event.target.value)}
              className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none ring-blue-500 focus:ring-2"
            />
            <FieldError message={fieldErrors.receiptPhone} />
          </div>

          <div>
            <label className="text-sm font-medium text-zinc-700" htmlFor="receiptAddress">
              Indirizzo
            </label>
            <input
              id="receiptAddress"
              value={formData.receiptAddress}
              onChange={(event) => updateField("receiptAddress", event.target.value)}
              className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none ring-blue-500 focus:ring-2"
            />
            <FieldError message={fieldErrors.receiptAddress} />
          </div>

          <div>
            <label className="text-sm font-medium text-zinc-700" htmlFor="receiptCity">
              Citta
            </label>
            <input
              id="receiptCity"
              value={formData.receiptCity}
              onChange={(event) => updateField("receiptCity", event.target.value)}
              className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none ring-blue-500 focus:ring-2"
            />
            <FieldError message={fieldErrors.receiptCity} />
          </div>

          <div>
            <label className="text-sm font-medium text-zinc-700" htmlFor="receiptPostalCode">
              CAP
            </label>
            <input
              id="receiptPostalCode"
              maxLength={5}
              value={formData.receiptPostalCode}
              onChange={(event) => updateField("receiptPostalCode", event.target.value)}
              className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none ring-blue-500 focus:ring-2"
            />
            <FieldError message={fieldErrors.receiptPostalCode} />
          </div>

          <div>
            <label className="text-sm font-medium text-zinc-700" htmlFor="receiptProvince">
              Provincia
            </label>
            <input
              id="receiptProvince"
              maxLength={2}
              value={formData.receiptProvince}
              onChange={(event) => updateField("receiptProvince", event.target.value.toUpperCase())}
              className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm uppercase outline-none ring-blue-500 focus:ring-2"
            />
            <FieldError message={fieldErrors.receiptProvince} />
          </div>

          <div className="md:col-span-2">
            <label className="text-sm font-medium text-zinc-700" htmlFor="receiptEmail">
              Email
            </label>
            <input
              id="receiptEmail"
              type="email"
              value={formData.receiptEmail}
              onChange={(event) => updateField("receiptEmail", event.target.value)}
              className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none ring-blue-500 focus:ring-2"
            />
            <FieldError message={fieldErrors.receiptEmail} />
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-blue-100 bg-white p-4 shadow-sm">
        <h2 className="text-lg font-semibold text-zinc-900">Sezione C - Iscrizione sportiva</h2>

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div>
            <label className="text-sm font-medium text-zinc-700" htmlFor="categoryId">
              Selezione categoria
            </label>
            <select
              id="categoryId"
              value={formData.categoryId}
              onChange={(event) => {
                const selectedCategory = categories.find((category) => category.id === event.target.value);
                updateField("categoryId", event.target.value);
                if (selectedCategory) {
                  updateField("seasonLabel", selectedCategory.seasonLabel);
                }
              }}
              className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none ring-blue-500 focus:ring-2"
            >
              <option value="">Seleziona categoria</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name} ({category.birthYearsLabel})
                </option>
              ))}
            </select>
            <FieldError message={fieldErrors.categoryId} />
          </div>

          <div>
            <label className="text-sm font-medium text-zinc-700" htmlFor="seasonLabel">
              Stagione sportiva
            </label>
            <input
              id="seasonLabel"
              value={formData.seasonLabel}
              onChange={(event) => updateField("seasonLabel", event.target.value)}
              className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none ring-blue-500 focus:ring-2"
            />
            <FieldError message={fieldErrors.seasonLabel} />
          </div>

          <div className="md:col-span-2">
            <label className="text-sm font-medium text-zinc-700" htmlFor="enrollmentNotes">
              Note eventuali
            </label>
            <textarea
              id="enrollmentNotes"
              rows={3}
              value={formData.enrollmentNotes ?? ""}
              onChange={(event) => updateField("enrollmentNotes", event.target.value)}
              className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none ring-blue-500 focus:ring-2"
            />
            <FieldError message={fieldErrors.enrollmentNotes} />
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-blue-100 bg-white p-4 shadow-sm">
        <h2 className="text-lg font-semibold text-zinc-900">Sezione D - Consensi</h2>
        <div className="mt-3 space-y-3">
          <label className="flex items-start gap-3 rounded-lg border border-zinc-200 p-3 text-sm text-zinc-700">
            <input
              type="checkbox"
              checked={formData.privacyConsent}
              onChange={(event) => updateField("privacyConsent", event.target.checked)}
              className="mt-1 h-4 w-4 rounded border-zinc-300 text-blue-700 focus:ring-blue-500"
            />
            <span>
              Confermo di aver letto e accettato l&apos;informativa privacy. (obbligatorio)
              <FieldError message={fieldErrors.privacyConsent} />
            </span>
          </label>

          <label className="flex items-start gap-3 rounded-lg border border-zinc-200 p-3 text-sm text-zinc-700">
            <input
              type="checkbox"
              checked={formData.regulationConsent}
              onChange={(event) => updateField("regulationConsent", event.target.checked)}
              className="mt-1 h-4 w-4 rounded border-zinc-300 text-blue-700 focus:ring-blue-500"
            />
            <span>
              Confermo di aver letto e accettato il regolamento societario. (obbligatorio)
              <FieldError message={fieldErrors.regulationConsent} />
            </span>
          </label>

          <label className="flex items-start gap-3 rounded-lg border border-zinc-200 p-3 text-sm text-zinc-700">
            <input
              type="checkbox"
              checked={formData.imageConsent}
              onChange={(event) => updateField("imageConsent", event.target.checked)}
              className="mt-1 h-4 w-4 rounded border-zinc-300 text-blue-700 focus:ring-blue-500"
            />
            <span>Autorizzo l&apos;utilizzo di immagini e video dell&apos;atleta per fini istituzionali.</span>
          </label>
        </div>
      </section>

      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full rounded-lg bg-blue-700 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isSubmitting ? "Invio iscrizione..." : "Conferma iscrizione"}
      </button>
    </form>
  );
}
