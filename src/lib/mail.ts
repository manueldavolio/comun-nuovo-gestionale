import nodemailer from "nodemailer";

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

  const transporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: {
      user: config.user,
      pass: config.pass,
    },
  });

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

  const transporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: {
      user: config.user,
      pass: config.pass,
    },
  });

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
