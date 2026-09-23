import { normalizeWhatsAppPhone, toWhatsAppApiPhone } from "@/lib/whatsapp-phone";
import {
  formatConvocationWallClockDate,
  formatConvocationWallClockTime,
  resolveMeetingAt,
} from "@/lib/convocation-times";

export type WhatsAppConvocationRecipient = {
  phone: string;
  athleteFullName: string;
  parentFullName?: string | null;
};

export type WhatsAppConvocationFailure = {
  athleteName: string;
  parentName: string | null;
  phone: string;
  reason: string;
};

export type SendConvocationWhatsAppResult = {
  attempted: boolean;
  sent: number;
  failed: number;
  failures: WhatsAppConvocationFailure[];
  skippedReason?: string;
};

export type WhatsAppConfig = {
  enabled: boolean;
  accessToken: string;
  phoneNumberId: string;
  apiVersion: string;
  templateName: string;
  missingVars: string[];
};

type TemplateParams = {
  athleteName: string;
  dateLabel: string;
  meetTimeLabel: string;
  locationLabel: string;
};

type MetaSendFn = (args: {
  apiPhone: string;
  templateName: string;
  languageCode: string;
  bodyParams: [string, string, string, string];
  accessToken: string;
  phoneNumberId: string;
  apiVersion: string;
}) => Promise<void>;

const SECRET_PATTERNS: RegExp[] = [
  /pass(?:word|wd)?[=:\s]+\S+/gi,
  /token[=:\s]+\S+/gi,
  /secret[=:\s]+\S+/gi,
  /Bearer\s+\S+/gi,
  /(?:postgres(?:ql)?|mysql|mongodb|redis|smtp|https?):\/\/\S+/gi,
  /EAA[A-Za-z0-9]+/g,
];

export function getWhatsAppConfig(
  env: Record<string, string | undefined> = process.env,
): WhatsAppConfig {
  const accessToken = (env.WHATSAPP_ACCESS_TOKEN ?? "").trim();
  const phoneNumberId = (env.WHATSAPP_PHONE_NUMBER_ID ?? "").trim();
  const apiVersion = (env.WHATSAPP_API_VERSION ?? "").trim();
  const templateName = (env.WHATSAPP_TEMPLATE_NAME ?? "convocazione_partita").trim();

  const missingVars: string[] = [];
  if (!accessToken) missingVars.push("WHATSAPP_ACCESS_TOKEN");
  if (!phoneNumberId) missingVars.push("WHATSAPP_PHONE_NUMBER_ID");
  if (!apiVersion) missingVars.push("WHATSAPP_API_VERSION");

  return {
    enabled: missingVars.length === 0,
    accessToken,
    phoneNumberId,
    apiVersion,
    templateName: templateName || "convocazione_partita",
    missingVars,
  };
}

/** Format Event.startAt using UTC wall-clock (same convention as calendar floating times). */
export function formatWhatsAppConvocationDate(startAt: Date): string {
  return formatConvocationWallClockDate(startAt);
}

export function formatWhatsAppConvocationTime(startAt: Date): string {
  return formatConvocationWallClockTime(startAt);
}

export function buildWhatsAppTemplateParams(input: {
  athleteFullName: string;
  /** Match / event date source (Event.startAt). */
  startAt: Date;
  /** Call-up / ritrovo time. Falls back to startAt for legacy rows. */
  meetingAt?: Date | null;
  location?: string | null;
}): TemplateParams {
  const location = (input.location ?? "").trim();
  const meetingAt = resolveMeetingAt(input.meetingAt, input.startAt);
  return {
    athleteName: input.athleteFullName.trim() || "Atleta",
    dateLabel: formatConvocationWallClockDate(input.startAt),
    meetTimeLabel: formatConvocationWallClockTime(meetingAt),
    locationLabel: location || "Da definire",
  };
}

export function sanitizeWhatsAppError(error: unknown): string {
  let message = "Invio WhatsApp non riuscito.";
  let code = "";

  if (error && typeof error === "object") {
    const record = error as {
      message?: unknown;
      code?: unknown;
      error?: { message?: unknown; code?: unknown; error_user_msg?: unknown };
    };
    const nested = record.error;
    code = String(nested?.code ?? record.code ?? "").trim();
    const raw =
      (typeof nested?.error_user_msg === "string" && nested.error_user_msg) ||
      (typeof nested?.message === "string" && nested.message) ||
      (typeof record.message === "string" && record.message) ||
      "";
    if (raw.trim()) {
      message = raw.trim();
    }
  } else if (typeof error === "string" && error.trim()) {
    message = error.trim();
  }

  for (const pattern of SECRET_PATTERNS) {
    message = message.replace(pattern, "[redacted]");
  }
  message = message.replace(/\s+at\s+\S+.*/g, "").replace(/\r?\n/g, " ").trim();

  const upper = code.toUpperCase();
  if (/TEMPLATE|132000|132001|132005|132015|132016/.test(String(code)) || /template/i.test(message)) {
    return "Template non disponibile";
  }
  if (upper.includes("AUTH") || message.toLowerCase().includes("oauth") || message.toLowerCase().includes("access token")) {
    return "Autenticazione WhatsApp non riuscita";
  }

  if (!message) {
    return "Invio WhatsApp non riuscito.";
  }
  return message.length > 180 ? `${message.slice(0, 177)}...` : message;
}

export function buildWhatsAppCloudPayload(args: {
  apiPhone: string;
  templateName: string;
  languageCode: string;
  bodyParams: [string, string, string, string];
}) {
  return {
    messaging_product: "whatsapp",
    to: args.apiPhone,
    type: "template",
    template: {
      name: args.templateName,
      language: { code: args.languageCode },
      components: [
        {
          type: "body",
          parameters: args.bodyParams.map((text) => ({
            type: "text",
            text,
          })),
        },
      ],
    },
  };
}

async function defaultMetaSend(args: {
  apiPhone: string;
  templateName: string;
  languageCode: string;
  bodyParams: [string, string, string, string];
  accessToken: string;
  phoneNumberId: string;
  apiVersion: string;
}): Promise<void> {
  const url = `https://graph.facebook.com/${args.apiVersion}/${args.phoneNumberId}/messages`;
  const payload = buildWhatsAppCloudPayload({
    apiPhone: args.apiPhone,
    templateName: args.templateName,
    languageCode: args.languageCode,
    bodyParams: args.bodyParams,
  });

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${args.accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const body = (await response.json().catch(() => null)) as
    | { error?: { message?: string; code?: number; error_user_msg?: string } }
    | null;

  if (!response.ok) {
    throw {
      message: body?.error?.message ?? `HTTP ${response.status}`,
      code: body?.error?.code,
      error: body?.error,
    };
  }
}

export async function sendConvocationWhatsAppMessages(options: {
  recipients: WhatsAppConvocationRecipient[];
  startAt: Date;
  meetingAt?: Date | null;
  location?: string | null;
  config?: WhatsAppConfig;
  sendOne?: MetaSendFn;
}): Promise<SendConvocationWhatsAppResult> {
  const config = options.config ?? getWhatsAppConfig();
  if (!config.enabled) {
    return {
      attempted: false,
      sent: 0,
      failed: 0,
      failures: [],
      skippedReason: `Configurazione WhatsApp mancante: ${config.missingVars.join(", ")}`,
    };
  }

  const sendOne = options.sendOne ?? defaultMetaSend;
  const failures: WhatsAppConvocationFailure[] = [];
  let sent = 0;

  for (const recipient of options.recipients) {
    const athleteName = recipient.athleteFullName.trim() || "Atleta";
    const parentName = (recipient.parentFullName ?? "").trim() || null;
    const rawPhone = recipient.phone ?? "";

    if (!rawPhone.trim()) {
      failures.push({
        athleteName,
        parentName,
        phone: "(vuoto)",
        reason: "Numero di telefono mancante",
      });
      continue;
    }

    const e164 = normalizeWhatsAppPhone(rawPhone);
    if (!e164) {
      failures.push({
        athleteName,
        parentName,
        phone: rawPhone.trim(),
        reason: "Numero di telefono non valido",
      });
      continue;
    }

    const params = buildWhatsAppTemplateParams({
      athleteFullName: athleteName,
      startAt: options.startAt,
      meetingAt: options.meetingAt,
      location: options.location,
    });

    try {
      await sendOne({
        apiPhone: toWhatsAppApiPhone(e164),
        templateName: config.templateName,
        languageCode: "it",
        bodyParams: [
          params.athleteName,
          params.dateLabel,
          params.meetTimeLabel,
          params.locationLabel,
        ],
        accessToken: config.accessToken,
        phoneNumberId: config.phoneNumberId,
        apiVersion: config.apiVersion,
      });
      sent += 1;
    } catch (error) {
      failures.push({
        athleteName,
        parentName,
        phone: e164,
        reason: sanitizeWhatsAppError(error),
      });
    }
  }

  return {
    attempted: true,
    sent,
    failed: failures.length,
    failures,
  };
}
