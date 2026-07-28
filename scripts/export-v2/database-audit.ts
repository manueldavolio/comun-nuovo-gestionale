import type { PrismaClient } from "@prisma/client";
import { FUNDAMENTAL_MODELS } from "./config";
import type { ModelCount } from "./types";

type CountFn = () => Promise<number>;

function buildCounters(prisma: PrismaClient): Record<string, CountFn> {
  return {
    User: () => prisma.user.count(),
    ParentProfile: () => prisma.parentProfile.count(),
    CoachProfile: () => prisma.coachProfile.count(),
    AdminProfile: () => prisma.adminProfile.count(),
    Category: () => prisma.category.count(),
    Athlete: () => prisma.athlete.count(),
    CoachCategoryAssignment: () => prisma.coachCategoryAssignment.count(),
    Enrollment: () => prisma.enrollment.count(),
    EnrollmentDocument: () => prisma.enrollmentDocument.count(),
    Payment: () => prisma.payment.count(),
    Receipt: () => prisma.receipt.count(),
    ReceiptCounter: () => prisma.receiptCounter.count(),
    AccountingEntry: () => prisma.accountingEntry.count(),
    Event: () => prisma.event.count(),
    Convocation: () => prisma.convocation.count(),
    ConvocationAthlete: () => prisma.convocationAthlete.count(),
    Attendance: () => prisma.attendance.count(),
    MedicalVisit: () => prisma.medicalVisit.count(),
    Document: () => prisma.document.count(),
    Announcement: () => prisma.announcement.count(),
    MediaItem: () => prisma.mediaItem.count(),
    MonthlyCoachReport: () => prisma.monthlyCoachReport.count(),
    Evaluation: () => prisma.evaluation.count(),
    SitePlayer: () => prisma.sitePlayer.count(),
    SiteStaffMember: () => prisma.siteStaffMember.count(),
    SiteNews: () => prisma.siteNews.count(),
    SiteSponsor: () => prisma.siteSponsor.count(),
    SiteGalleryAlbum: () => prisma.siteGalleryAlbum.count(),
    SiteGalleryImage: () => prisma.siteGalleryImage.count(),
    SiteVideo: () => prisma.siteVideo.count(),
    SiteSettings: () => prisma.siteSettings.count(),
    StripeWebhookEvent: () => prisma.stripeWebhookEvent.count(),
  };
}

export type DatabaseAuditResult = {
  counts: ModelCount[];
  fundamentalReadable: boolean;
  reachable: boolean;
  error?: string;
};

export async function auditDatabaseCounts(prisma: PrismaClient): Promise<DatabaseAuditResult> {
  const counters = buildCounters(prisma);
  const counts: ModelCount[] = [];
  let reachable = true;

  for (const [model, countFn] of Object.entries(counters)) {
    try {
      const count = await countFn();
      counts.push({ model, count, status: "OK" });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      counts.push({ model, count: null, status: "ERROR", error: message });
      if ((FUNDAMENTAL_MODELS as readonly string[]).includes(model)) {
        reachable = false;
      }
    }
  }

  const fundamentalReadable = FUNDAMENTAL_MODELS.every((model) => {
    const row = counts.find((c) => c.model === model);
    return row?.status === "OK";
  });

  return {
    counts,
    fundamentalReadable,
    reachable: counts.some((c) => c.status === "OK") && reachable,
    error: fundamentalReadable
      ? undefined
      : "One or more fundamental models (User, Athlete, Enrollment, Payment, Receipt) could not be read.",
  };
}
