import type { MedicalVisitStatus } from "@prisma/client";

export type MedicalVisitReminderEmail = {
  to: string;
  cc?: string;
  subject: string;
  text: string;
};

function formatItDate(date: Date): string {
  return new Intl.DateTimeFormat("it-IT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

function getSocietyCc(): string | undefined {
  const cc = process.env.MAIL_CC ?? process.env.SOCIETY_EMAIL;
  const trimmed = (cc ?? "").trim();
  return trimmed ? trimmed : undefined;
}

export function buildMedicalVisitReminderEmail(input: {
  parentEmail: string;
  athleteFullName: string;
  categoryName: string;
  expiryDate: Date;
  status: MedicalVisitStatus;
}): MedicalVisitReminderEmail {
  const formattedExpiry = formatItDate(input.expiryDate);
  const societyCc = getSocietyCc();

  const reminderLine =
    input.status === "EXPIRED"
      ? `risulta già scaduta il ${formattedExpiry}`
      : `scade il ${formattedExpiry} (è in scadenza)`;

  const subject = `Comun Nuovo Calcio - Promemoria visita medica (${input.athleteFullName})`;

  const text = [
    "Buongiorno,",
    "",
    `la informiamo che la visita medica di ${input.athleteFullName} per la categoria ${input.categoryName} ${reminderLine}.`,
    "",
    "Vi invitiamo gentilmente a provvedere al rinnovo e a consegnare/aggiornare il relativo certificato presso la segreteria.",
    "",
    "Cordiali saluti,",
    "Segreteria Comun Nuovo Calcio",
  ].join("\n");

  return {
    to: input.parentEmail,
    cc: societyCc,
    subject,
    text,
  };
}

