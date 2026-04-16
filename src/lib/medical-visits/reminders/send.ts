import type { MedicalVisitStatus } from "@/generated/prisma/enums";
import { buildMedicalVisitReminderEmail } from "@/lib/medical-visits/reminders/email";
import { getMedicalVisitReminderTargets } from "@/lib/medical-visits/reminders/search";
import { sendMedicalVisitReminderMail } from "@/lib/mail";

export type MedicalVisitReminderSendSkipped = {
  athleteId: string;
  reason: string;
};

export type MedicalVisitReminderSendFailure = {
  athleteId: string;
  reason: string;
};

export type MedicalVisitReminderSendSummary = {
  totalTargets: number;
  expiringTargets: number;
  expiredTargets: number;
  sent: number;
  skipped: number;
  failed: number;
  mailDisabledReason?: string;
  skippedEntries: MedicalVisitReminderSendSkipped[];
  failureEntries: MedicalVisitReminderSendFailure[];
};

function includesStatus(status: MedicalVisitStatus, includeExpiring: boolean, includeExpired: boolean): boolean {
  if (status === "EXPIRING") return includeExpiring;
  if (status === "EXPIRED") return includeExpired;
  return false;
}

export async function sendMedicalVisitExpirationReminders({
  now = new Date(),
  includeExpiring = true,
  includeExpired = true,
}: {
  now?: Date;
  includeExpiring?: boolean;
  includeExpired?: boolean;
} = {}): Promise<MedicalVisitReminderSendSummary> {
  const groups = await getMedicalVisitReminderTargets({ now });
  const targets = [...groups.expiring, ...groups.expired].filter((t) =>
    includesStatus(t.status, includeExpiring, includeExpired),
  );

  const summary: MedicalVisitReminderSendSummary = {
    totalTargets: targets.length,
    expiringTargets: groups.expiring.length,
    expiredTargets: groups.expired.length,
    sent: 0,
    skipped: 0,
    failed: 0,
    skippedEntries: [],
    failureEntries: [],
  };

  console.info(
    "[medical-visit-reminders] Starting reminders send",
    JSON.stringify({
      totalTargets: summary.totalTargets,
      includeExpiring,
      includeExpired,
      expiringTargets: summary.expiringTargets,
      expiredTargets: summary.expiredTargets,
    }),
  );

  // Invio sequenziale per avere log e stabilita' migliori.
  for (const target of targets) {
    if (!target.parentEmail) {
      summary.skipped += 1;
      summary.skippedEntries.push({
        athleteId: target.athleteId,
        reason: "Email genitore non disponibile.",
      });
      console.warn(
        "[medical-visit-reminders] Skip missing parent email",
        JSON.stringify({
          athleteId: target.athleteId,
          athleteFullName: target.athleteFullName,
          categoryName: target.categoryName,
          expiryDate: target.expiryDate,
        }),
      );
      continue;
    }

    const email = buildMedicalVisitReminderEmail({
      parentEmail: target.parentEmail,
      athleteFullName: target.athleteFullName,
      categoryName: target.categoryName,
      expiryDate: target.expiryDate,
      status: target.status,
    });

    const result = await sendMedicalVisitReminderMail({
      to: email.to,
      cc: email.cc,
      subject: email.subject,
      text: email.text,
    });

    if (result.sent) {
      summary.sent += 1;
      continue;
    }

    if (result.skipped) {
      summary.skipped += 1;
      summary.skippedEntries.push({
        athleteId: target.athleteId,
        reason: result.reason,
      });
      console.warn(
        "[medical-visit-reminders] Skip email (config or recipient)",
        JSON.stringify({
          athleteId: target.athleteId,
          reason: result.reason,
        }),
      );
      if (!summary.mailDisabledReason && result.reason.startsWith("Configurazione mail incompleta")) {
        summary.mailDisabledReason = result.reason;
      }
      continue;
    }

    summary.failed += 1;
    summary.failureEntries.push({
      athleteId: target.athleteId,
      reason: result.reason,
    });
    console.error(
      "[medical-visit-reminders] Failed to send email",
      JSON.stringify({
        athleteId: target.athleteId,
        reason: result.reason,
      }),
    );
  }

  console.info(
    "[medical-visit-reminders] Reminders send finished",
    JSON.stringify({
      sent: summary.sent,
      failed: summary.failed,
      skipped: summary.skipped,
      totalTargets: summary.totalTargets,
    }),
  );

  return summary;
}

