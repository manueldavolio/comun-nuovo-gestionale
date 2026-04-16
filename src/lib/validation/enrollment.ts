import { z } from "zod";

const taxCodeRegex = /^[A-Z0-9]{16}$/;
const postalCodeRegex = /^\d{5}$/;
const provinceRegex = /^[A-Z]{2}$/;
const seasonRegex = /^\d{4}\/\d{4}$/;
const phoneRegex = /^[+\d\s().-]{7,20}$/;
const athleteGenderValues = ["MALE", "FEMALE", "OTHER"] as const;

export const enrollmentSchema = z.object({
  athleteFirstName: z.string().trim().min(1, "Il nome atleta e obbligatorio."),
  athleteLastName: z.string().trim().min(1, "Il cognome atleta e obbligatorio."),
  athleteGender: z.enum(athleteGenderValues),
  athleteBirthDate: z
    .string()
    .min(1, "La data di nascita e obbligatoria.")
    .pipe(z.iso.date("Inserisci una data valida.")),
  athleteBirthPlace: z.string().trim().min(1, "Il luogo di nascita e obbligatorio."),
  athleteTaxCode: z
    .string()
    .trim()
    .toUpperCase()
    .regex(taxCodeRegex, "Il codice fiscale atleta deve avere 16 caratteri validi."),
  athleteNationality: z.string().trim().min(1, "La nazionalita e obbligatoria."),
  athleteAddress: z.string().trim().min(1, "L'indirizzo atleta e obbligatorio."),
  athleteCity: z.string().trim().min(1, "La citta atleta e obbligatoria."),
  athletePostalCode: z
    .string()
    .trim()
    .regex(postalCodeRegex, "Il CAP atleta deve avere 5 cifre."),
  athleteProvince: z
    .string()
    .trim()
    .toUpperCase()
    .regex(provinceRegex, "La provincia atleta deve essere di 2 lettere."),
  athleteClothingSize: z.string().trim().max(20, "Taglia troppo lunga.").optional(),
  athleteMedicalNotes: z.string().trim().max(1000, "Note mediche troppo lunghe.").optional(),

  receiptFirstName: z.string().trim().min(1, "Il nome per ricevuta e obbligatorio."),
  receiptLastName: z.string().trim().min(1, "Il cognome per ricevuta e obbligatorio."),
  receiptTaxCode: z
    .string()
    .trim()
    .toUpperCase()
    .regex(taxCodeRegex, "Il codice fiscale per ricevuta deve avere 16 caratteri validi."),
  receiptPhone: z
    .string()
    .trim()
    .regex(phoneRegex, "Inserisci un numero di telefono valido."),
  receiptAddress: z.string().trim().min(1, "L'indirizzo per ricevuta e obbligatorio."),
  receiptCity: z.string().trim().min(1, "La citta per ricevuta e obbligatoria."),
  receiptPostalCode: z
    .string()
    .trim()
    .regex(postalCodeRegex, "Il CAP per ricevuta deve avere 5 cifre."),
  receiptProvince: z
    .string()
    .trim()
    .toUpperCase()
    .regex(provinceRegex, "La provincia per ricevuta deve essere di 2 lettere."),
  receiptEmail: z.string().trim().email("Inserisci un'email valida."),

  categoryId: z.string().trim().min(1, "Seleziona una categoria."),
  seasonLabel: z
    .string()
    .trim()
    .regex(seasonRegex, "La stagione deve essere nel formato AAAA/AAAA."),
  enrollmentNotes: z.string().trim().max(1000, "Note troppo lunghe.").optional(),

  privacyConsent: z
    .boolean()
    .refine((value) => value, "Devi accettare l'informativa privacy."),
  regulationConsent: z
    .boolean()
    .refine((value) => value, "Devi accettare il regolamento."),
  imageConsent: z.boolean(),
});

export type EnrollmentInput = z.infer<typeof enrollmentSchema>;
