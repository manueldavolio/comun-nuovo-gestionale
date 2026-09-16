export type ConvocationEmailRecipient = {
  email: string;
  athleteFullName: string;
  parentFullName?: string | null;
};

export type ConvocationEmailFailure = {
  athleteFullName: string;
  parentFullName: string | null;
  email: string;
  errorCode: string;
  errorMessage: string;
};

export type ConvocationEmailSendOutcome = {
  totalRecipients: number;
  sentCount: number;
  failedCount: number;
  failures: ConvocationEmailFailure[];
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const SECRET_PATTERNS: RegExp[] = [
  /pass(?:word|wd)?[=:\s]+\S+/gi,
  /token[=:\s]+\S+/gi,
  /secret[=:\s]+\S+/gi,
  /(?:postgres(?:ql)?|mysql|mongodb|redis|smtp):\/\/\S+/gi,
  /Bearer\s+\S+/gi,
  /-----BEGIN[\s\S]*?-----END[^-]*-----/gi,
];

export function isFormallyValidEmail(email: string): boolean {
  const normalized = email.trim().toLowerCase();
  if (!normalized || normalized.length > 254) {
    return false;
  }
  return EMAIL_RE.test(normalized);
}

export function normalizeParentFullName(value?: string | null): string | null {
  const trimmed = (value ?? "").trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function sanitizeMailError(error: unknown): { errorCode: string; errorMessage: string } {
  if (error && typeof error === "object") {
    const record = error as {
      code?: unknown;
      responseCode?: unknown;
      message?: unknown;
      response?: unknown;
      stack?: unknown;
    };

    const rawCode =
      typeof record.code === "string" && record.code.trim()
        ? record.code.trim()
        : typeof record.responseCode === "number"
          ? String(record.responseCode)
          : "SEND_FAILED";

    const rawMessage =
      typeof record.message === "string" && record.message.trim()
        ? record.message
        : typeof record.response === "string" && record.response.trim()
          ? record.response
          : "Invio email non riuscito.";

    return {
      errorCode: rawCode.slice(0, 64),
      errorMessage: toSafeUserFacingMailError(rawCode, rawMessage),
    };
  }

  if (typeof error === "string" && error.trim()) {
    return {
      errorCode: "SEND_FAILED",
      errorMessage: toSafeUserFacingMailError("SEND_FAILED", error),
    };
  }

  return {
    errorCode: "SEND_FAILED",
    errorMessage: "Invio email non riuscito.",
  };
}

export function toSafeUserFacingMailError(errorCode: string, rawMessage: string): string {
  const code = errorCode.toUpperCase();
  let message = rawMessage.replace(/\r?\n/g, " ").trim();

  for (const pattern of SECRET_PATTERNS) {
    message = message.replace(pattern, "[redacted]");
  }

  // Drop stack-like content.
  message = message.replace(/\s+at\s+\S+.*/g, "").trim();

  if (code === "INVALID_EMAIL") {
    return "Indirizzo email non valido";
  }
  if (code === "EENVELOPE" || code === "550" || code === "553" || /recipient.*reject/i.test(message)) {
    return "Destinatario rifiutato";
  }
  if (code === "EAUTH" || code === "535") {
    return "Autenticazione SMTP non riuscita";
  }
  if (code === "ETIMEDOUT" || code === "ECONNECTION" || code === "ESOCKET") {
    return "Timeout o errore di connessione SMTP";
  }
  if (code === "421" || code === "451" || /rate limit|daily.*(limit|quota)|too many/i.test(message)) {
    return "Limite di invio SMTP raggiunto";
  }

  if (!message) {
    return "Invio email non riuscito.";
  }

  return message.length > 180 ? `${message.slice(0, 177)}...` : message;
}

export function prepareConvocationEmailRecipients(recipients: ConvocationEmailRecipient[]): {
  toSend: Array<{
    email: string;
    athleteFullName: string;
    parentFullName: string | null;
  }>;
  invalidFailures: ConvocationEmailFailure[];
} {
  const toSend: Array<{
    email: string;
    athleteFullName: string;
    parentFullName: string | null;
  }> = [];
  const invalidFailures: ConvocationEmailFailure[] = [];

  for (const entry of recipients) {
    const athleteFullName = entry.athleteFullName.trim();
    const parentFullName = normalizeParentFullName(entry.parentFullName);
    const email = entry.email.trim().toLowerCase();

    if (!athleteFullName) {
      continue;
    }

    if (!isFormallyValidEmail(email)) {
      invalidFailures.push({
        athleteFullName,
        parentFullName,
        email: email || "(vuoto)",
        errorCode: "INVALID_EMAIL",
        errorMessage: "Indirizzo email non valido",
      });
      continue;
    }

    toSend.push({
      email,
      athleteFullName,
      parentFullName,
    });
  }

  return { toSend, invalidFailures };
}

export async function dispatchConvocationEmails(options: {
  recipients: ConvocationEmailRecipient[];
  sendOne: (recipient: {
    email: string;
    athleteFullName: string;
    parentFullName: string | null;
  }) => Promise<unknown>;
}): Promise<ConvocationEmailSendOutcome> {
  const { toSend, invalidFailures } = prepareConvocationEmailRecipients(options.recipients);
  const failures: ConvocationEmailFailure[] = [...invalidFailures];

  if (toSend.length === 0) {
    return {
      totalRecipients: failures.length,
      sentCount: 0,
      failedCount: failures.length,
      failures,
    };
  }

  const results = await Promise.allSettled(toSend.map((recipient) => options.sendOne(recipient)));

  results.forEach((result, index) => {
    if (result.status === "fulfilled") {
      return;
    }

    const recipient = toSend[index]!;
    const sanitized = sanitizeMailError(result.reason);
    failures.push({
      athleteFullName: recipient.athleteFullName,
      parentFullName: recipient.parentFullName,
      email: recipient.email,
      errorCode: sanitized.errorCode,
      errorMessage: sanitized.errorMessage,
    });
  });

  const failedSendCount = results.filter((result) => result.status === "rejected").length;
  const sentCount = toSend.length - failedSendCount;
  const totalRecipients = toSend.length + invalidFailures.length;

  return {
    totalRecipients,
    sentCount,
    failedCount: failures.length,
    failures,
  };
}
