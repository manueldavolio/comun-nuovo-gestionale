import nodemailer from "nodemailer";
import type { EventType } from "@prisma/client";
import { formatEventType } from "@/lib/events";

type SendReceiptMailInput = {
  to: string;
  cc?: string;
  receiptNumber: string;
  athleteFullName: string;
  amount: string;
  attachmentFileName: string;
  attachmentContent: Buffer;
};

type MailerConfig = {
  enabled: boolean;
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  from: string;
  missingVars: string[];
};

type RegistrationConfirmationEmailInput = {
  to: string;
  name?: string;
};

type AdminNewUserNotificationInput = {
  name?: string;
  email: string;
  role: string;
  registeredAt?: Date;
};

function getMailerConfig(): MailerConfig {
  const host = process.env.MAIL_HOST ?? process.env.SMTP_HOST;
  const user = process.env.MAIL_USER ?? process.env.SMTP_USER;
  const pass = process.env.MAIL_PASS ?? process.env.SMTP_PASS;
  const from = process.env.MAIL_FROM ?? process.env.SMTP_FROM;
  const portRaw = process.env.MAIL_PORT ?? process.env.SMTP_PORT ?? "587";
  const secure = (process.env.MAIL_SECURE ?? process.env.SMTP_SECURE) === "true";
  const port = Number(portRaw);
  const missingVars: string[] = [];

  if (!host) {
    missingVars.push("MAIL_HOST");
  }
  if (!user) {
    missingVars.push("MAIL_USER");
  }
  if (!pass) {
    missingVars.push("MAIL_PASS");
  }
  if (!from) {
    missingVars.push("MAIL_FROM");
  }
  if (Number.isNaN(port)) {
    missingVars.push("MAIL_PORT");
  }

  return {
    enabled: missingVars.length === 0,
    host: host ?? "",
    port,
    secure,
    user: user ?? "",
    pass: pass ?? "",
    from: from ?? "",
    missingVars,
  };
}

function createMailerTransporter(config: MailerConfig) {
  return nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: {
      user: config.user,
      pass: config.pass,
    },
  });
}

export type SendReceiptMailResult =
  | { sent: true; skipped: false }
  | { sent: false; skipped: true; reason: string };

export async function sendReceiptMail(input: SendReceiptMailInput): Promise<SendReceiptMailResult> {
  const config = getMailerConfig();
  if (!config.enabled) {
    return {
      sent: false,
      skipped: true,
      reason: `Configurazione mail incompleta: ${config.missingVars.join(", ")}`,
    };
  }

  const transporter = createMailerTransporter(config);

  await transporter.sendMail({
    from: config.from,
    to: input.to,
    cc: input.cc,
    subject: "Ricevuta pagamento iscrizione",
    text: [
      "Buongiorno,",
      "",
      `in allegato trovi la ricevuta ${input.receiptNumber} relativa al pagamento iscrizione di ${input.athleteFullName}.`,
      `Importo registrato: EUR ${input.amount}.`,
      "",
      "Cordiali saluti,",
      "Segreteria Comun Nuovo Calcio",
    ].join("\n"),
    attachments: [
      {
        filename: input.attachmentFileName,
        content: input.attachmentContent,
        contentType: "application/pdf",
      },
    ],
  });

  return { sent: true, skipped: false };
}

export type SendMedicalVisitReminderMailInput = {
  to: string;
  cc?: string;
  subject: string;
  text: string;
};

export type SendMedicalVisitReminderMailResult =
  | { sent: true }
  | { sent: false; skipped: true; reason: string }
  | { sent: false; skipped: false; reason: string };

export type SendRegistrationMailResult =
  | { sent: true }
  | { sent: false; skipped: true; reason: string }
  | { sent: false; skipped: false; reason: string };

export type SendAnnouncementEmailsInput = {
  recipients: string[];
  title: string;
  content: string;
};

export type SendAnnouncementEmailsResult =
  | { sent: true; totalRecipients: number; sentCount: number; failedCount: number }
  | { sent: false; skipped: true; reason: string }
  | { sent: false; skipped: false; reason: string };

export type SendEventEmailsInput = {
  recipients: string[];
  title: string;
  type: EventType;
  categoryName: string;
  startAt: Date;
  location?: string | null;
  notes?: string | null;
};

export type SendEventEmailsResult =
  | { sent: true; totalRecipients: number; sentCount: number; failedCount: number }
  | { sent: false; skipped: true; reason: string }
  | { sent: false; skipped: false; reason: string };

function buildFriendlyName(name?: string): string | null {
  const trimmed = (name ?? "").trim();
  return trimmed.length > 0 ? trimmed : null;
}

function formatAdminRegistrationDate(date: Date): string {
  return new Intl.DateTimeFormat("it-IT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function buildRegistrationConfirmationText(name?: string): string {
  const greetingName = buildFriendlyName(name);

  return [
    greetingName ? `Ciao ${greetingName},` : "Ciao,",
    "la tua registrazione al gestionale Comun Nuovo Calcio e stata completata correttamente.",
    "Ora puoi accedere con la tua email.",
    "Se non hai richiesto tu questa registrazione, contatta la segreteria del club.",
  ].join("\n");
}

function buildAdminNewUserNotificationText(input: {
  name?: string;
  email: string;
  role: string;
  registeredAt: Date;
}): string {
  const displayName = buildFriendlyName(input.name) ?? "Nome non specificato";

  return [
    "E stato registrato un nuovo utente nel gestionale.",
    `Nome: ${displayName}`,
    `Email: ${input.email}`,
    `Ruolo: ${input.role}`,
    `Data: ${formatAdminRegistrationDate(input.registeredAt)}`,
  ].join("\n");
}

function buildAnnouncementEmailText(input: { title: string; content: string }): string {
  return [
    `Titolo: ${input.title}`,
    "Messaggio:",
    input.content,
    "",
    "Accedi al gestionale Comun Nuovo Calcio per maggiori dettagli.",
  ].join("\n");
}

function formatEventDateTime(date: Date): string {
  return new Intl.DateTimeFormat("it-IT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function buildEventEmailText(input: {
  title: string;
  type: EventType;
  categoryName: string;
  startAt: Date;
  location?: string | null;
  notes?: string | null;
}): string {
  const location = (input.location ?? "").trim();
  const notes = (input.notes ?? "").trim();

  return [
    "E stato pubblicato un nuovo evento nel gestionale Comun Nuovo Calcio.",
    "",
    "Dettagli:",
    `- Titolo: ${input.title.trim()}`,
    `- Tipo: ${formatEventType(input.type)}`,
    `- Categoria: ${input.categoryName.trim()}`,
    `- Data e ora: ${formatEventDateTime(input.startAt)}`,
    ...(location ? [`- Luogo: ${location}`] : []),
    ...(notes ? [`- Note: ${notes}`] : []),
    "",
    "Accedi al gestionale per maggiori dettagli.",
  ].join("\n");
}

export async function sendMedicalVisitReminderMail(
  input: SendMedicalVisitReminderMailInput,
): Promise<SendMedicalVisitReminderMailResult> {
  const config = getMailerConfig();
  if (!config.enabled) {
    return {
      sent: false,
      skipped: true,
      reason: `Configurazione mail incompleta: ${config.missingVars.join(", ")}`,
    };
  }

  const transporter = createMailerTransporter(config);

  try {
    await transporter.sendMail({
      from: config.from,
      to: input.to,
      cc: input.cc,
      subject: input.subject,
      text: input.text,
    });

    return { sent: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Errore imprevisto durante l'invio mail";
    return {
      sent: false,
      skipped: false,
      reason: message,
    };
  }
}

export async function sendRegistrationConfirmationEmail(
  input: RegistrationConfirmationEmailInput,
): Promise<SendRegistrationMailResult> {
  const config = getMailerConfig();
  if (!config.enabled) {
    const reason = `Configurazione mail incompleta: ${config.missingVars.join(", ")}`;
    console.warn("[mail] Skipping registration confirmation email", {
      to: input.to,
      reason,
    });
    return {
      sent: false,
      skipped: true,
      reason,
    };
  }

  const transporter = createMailerTransporter(config);
  const text = buildRegistrationConfirmationText(input.name);

  try {
    await transporter.sendMail({
      from: config.from,
      to: input.to,
      subject: "Registrazione completata - Comun Nuovo Calcio",
      text,
    });

    return { sent: true };
  } catch (error) {
    const reason =
      error instanceof Error ? error.message : "Errore imprevisto durante l'invio mail";
    console.error("[mail] Failed to send registration confirmation email", {
      to: input.to,
      reason,
    });
    return {
      sent: false,
      skipped: false,
      reason,
    };
  }
}

export async function sendAdminNewUserNotification(
  input: AdminNewUserNotificationInput,
): Promise<SendRegistrationMailResult> {
  const adminEmail = (process.env.ADMIN_NOTIFICATION_EMAIL ?? "").trim();
  if (!adminEmail) {
    const reason = "ADMIN_NOTIFICATION_EMAIL non configurata.";
    console.warn("[mail] Skipping admin new user notification", {
      email: input.email,
      reason,
    });
    return {
      sent: false,
      skipped: true,
      reason,
    };
  }

  const config = getMailerConfig();
  if (!config.enabled) {
    const reason = `Configurazione mail incompleta: ${config.missingVars.join(", ")}`;
    console.warn("[mail] Skipping admin new user notification", {
      email: input.email,
      reason,
    });
    return {
      sent: false,
      skipped: true,
      reason,
    };
  }

  const registeredAt = input.registeredAt ?? new Date();
  const transporter = createMailerTransporter(config);
  const text = buildAdminNewUserNotificationText({
    name: input.name,
    email: input.email,
    role: input.role,
    registeredAt,
  });

  try {
    await transporter.sendMail({
      from: config.from,
      to: adminEmail,
      subject: "Nuovo utente registrato - Comun Nuovo Calcio",
      text,
    });

    return { sent: true };
  } catch (error) {
    const reason =
      error instanceof Error ? error.message : "Errore imprevisto durante l'invio mail";
    console.error("[mail] Failed to send admin new user notification", {
      email: input.email,
      adminEmail,
      reason,
    });
    return {
      sent: false,
      skipped: false,
      reason,
    };
  }
}

export async function sendAnnouncementEmails(
  input: SendAnnouncementEmailsInput,
): Promise<SendAnnouncementEmailsResult> {
  const recipients = Array.from(
    new Set(
      input.recipients
        .map((email) => email.trim().toLowerCase())
        .filter((email) => email.length > 0),
    ),
  );

  if (recipients.length === 0) {
    return {
      sent: true,
      totalRecipients: 0,
      sentCount: 0,
      failedCount: 0,
    };
  }

  const config = getMailerConfig();
  if (!config.enabled) {
    return {
      sent: false,
      skipped: true,
      reason: `Configurazione mail incompleta: ${config.missingVars.join(", ")}`,
    };
  }

  const transporter = createMailerTransporter(config);
  const text = buildAnnouncementEmailText({
    title: input.title.trim(),
    content: input.content.trim(),
  });

  const results = await Promise.allSettled(
    recipients.map((recipientEmail) =>
      transporter.sendMail({
        from: config.from,
        to: recipientEmail,
        subject: "Nuova comunicazione - Comun Nuovo Calcio",
        text,
      }),
    ),
  );

  const failedCount = results.filter((result) => result.status === "rejected").length;
  const sentCount = recipients.length - failedCount;

  if (failedCount === recipients.length) {
    return {
      sent: false,
      skipped: false,
      reason: "Invio email comunicazioni fallito per tutti i destinatari.",
    };
  }

  return {
    sent: true,
    totalRecipients: recipients.length,
    sentCount,
    failedCount,
  };
}

export async function sendEventEmails(input: SendEventEmailsInput): Promise<SendEventEmailsResult> {
  const recipients = Array.from(
    new Set(
      input.recipients
        .map((email) => email.trim().toLowerCase())
        .filter((email) => email.length > 0),
    ),
  );

  if (recipients.length === 0) {
    return {
      sent: true,
      totalRecipients: 0,
      sentCount: 0,
      failedCount: 0,
    };
  }

  const config = getMailerConfig();
  if (!config.enabled) {
    return {
      sent: false,
      skipped: true,
      reason: `Configurazione mail incompleta: ${config.missingVars.join(", ")}`,
    };
  }

  const transporter = createMailerTransporter(config);
  const text = buildEventEmailText(input);

  const results = await Promise.allSettled(
    recipients.map((recipientEmail) =>
      transporter.sendMail({
        from: config.from,
        to: recipientEmail,
        subject: "Nuovo evento - Comun Nuovo Calcio",
        text,
      }),
    ),
  );

  const failedCount = results.filter((result) => result.status === "rejected").length;
  const sentCount = recipients.length - failedCount;

  if (failedCount === recipients.length) {
    return {
      sent: false,
      skipped: false,
      reason: "Invio email evento fallito per tutti i destinatari.",
    };
  }

  return {
    sent: true,
    totalRecipients: recipients.length,
    sentCount,
    failedCount,
  };
}
