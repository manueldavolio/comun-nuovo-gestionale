import type { PrismaClient } from "@prisma/client";
import { KNOWN_USER_ROLES } from "./config";
import { maskEmail, normalizeEmail, normalizeStoragePath, normalizeTaxCode } from "./mask";
import type { AuditIssue } from "./types";

function isNegativeAmount(value: { toString(): string } | number | null | undefined): boolean {
  if (value == null) return false;
  const n = typeof value === "number" ? value : Number(value.toString());
  return Number.isFinite(n) && n < 0;
}

function pushIssue(
  issues: AuditIssue[],
  issue: AuditIssue,
  maxIds = 25,
): void {
  if (issue.recordIds && issue.recordIds.length > maxIds) {
    issues.push({
      ...issue,
      recordIds: issue.recordIds.slice(0, maxIds),
      details: {
        ...(issue.details ?? {}),
        truncated: true,
        totalIds: issue.recordIds.length,
      },
    });
    return;
  }
  issues.push(issue);
}

export async function auditRelations(prisma: PrismaClient): Promise<AuditIssue[]> {
  const issues: AuditIssue[] = [];

  const [
    users,
    parents,
    coaches,
    admins,
    categories,
    athletes,
    coachAssignments,
    enrollments,
    enrollmentDocuments,
    payments,
    receipts,
    events,
    convocations,
    convocationAthletes,
    attendances,
    medicalVisits,
    documents,
    announcements,
  ] = await Promise.all([
    prisma.user.findMany({
      select: { id: true, email: true, role: true, passwordHash: true },
    }),
    prisma.parentProfile.findMany({ select: { id: true, userId: true } }),
    prisma.coachProfile.findMany({ select: { id: true, userId: true } }),
    prisma.adminProfile.findMany({ select: { id: true, userId: true } }),
    prisma.category.findMany({ select: { id: true } }),
    prisma.athlete.findMany({
      select: { id: true, parentId: true, categoryId: true, taxCode: true },
    }),
    prisma.coachCategoryAssignment.findMany({
      select: { id: true, coachId: true, categoryId: true },
    }),
    prisma.enrollment.findMany({
      select: { id: true, athleteId: true, categoryId: true, seasonLabel: true },
    }),
    prisma.enrollmentDocument.findMany({
      select: { id: true, enrollmentId: true, filePath: true },
    }),
    prisma.payment.findMany({
      select: { id: true, enrollmentId: true, amount: true },
    }),
    prisma.receipt.findMany({
      select: { id: true, paymentId: true, receiptNumber: true, amount: true, filePath: true },
    }),
    prisma.event.findMany({ select: { id: true, categoryId: true, createdById: true } }),
    prisma.convocation.findMany({
      select: { id: true, eventId: true, categoryId: true, createdById: true },
    }),
    prisma.convocationAthlete.findMany({
      select: { id: true, convocationId: true, athleteId: true },
    }),
    prisma.attendance.findMany({ select: { id: true, athleteId: true, eventId: true } }),
    prisma.medicalVisit.findMany({
      select: {
        id: true,
        athleteId: true,
        visitDate: true,
        expiryDate: true,
        certificateFilePath: true,
      },
    }),
    prisma.document.findMany({ select: { id: true, athleteId: true, filePath: true } }),
    prisma.announcement.findMany({
      select: { id: true, categoryId: true, createdById: true },
    }),
  ]);

  const userIds = new Set(users.map((u) => u.id));
  const parentIds = new Set(parents.map((p) => p.id));
  const parentByUser = new Map(parents.map((p) => [p.userId, p.id]));
  const coachIds = new Set(coaches.map((c) => c.id));
  const coachByUser = new Map(coaches.map((c) => [c.userId, c.id]));
  const adminByUser = new Map(admins.map((a) => [a.userId, a.id]));
  const categoryIds = new Set(categories.map((c) => c.id));
  const athleteIds = new Set(athletes.map((a) => a.id));
  const enrollmentIds = new Set(enrollments.map((e) => e.id));
  const paymentIds = new Set(payments.map((p) => p.id));
  const eventIds = new Set(events.map((e) => e.id));
  const convocationIds = new Set(convocations.map((c) => c.id));

  // Role / profile coherence
  const usersMissingProfile: string[] = [];
  const unknownRoles: string[] = [];
  for (const user of users) {
    if (!(KNOWN_USER_ROLES as readonly string[]).includes(user.role)) {
      unknownRoles.push(user.id);
    }
    if (user.role === "PARENT" && !parentByUser.has(user.id)) {
      usersMissingProfile.push(user.id);
    }
    if (user.role === "COACH" && !coachByUser.has(user.id)) {
      usersMissingProfile.push(user.id);
    }
    if (
      (user.role === "ADMIN" || user.role === "YOUTH_DIRECTOR") &&
      !adminByUser.has(user.id) &&
      !coachByUser.has(user.id)
    ) {
      // Admin/Youth Director typically have AdminProfile; warn if neither admin nor coach profile.
      usersMissingProfile.push(user.id);
    }
  }
  if (unknownRoles.length) {
    pushIssue(issues, {
      code: "USER_UNKNOWN_ROLE",
      severity: "BLOCKING",
      message: "User roles outside known enum values.",
      model: "User",
      recordIds: unknownRoles,
    });
  }
  if (usersMissingProfile.length) {
    pushIssue(issues, {
      code: "USER_MISSING_ROLE_PROFILE",
      severity: "WARNING",
      message: "Users without a profile coherent with their role.",
      model: "User",
      recordIds: usersMissingProfile,
    });
  }

  const orphanParents = parents.filter((p) => !userIds.has(p.userId)).map((p) => p.id);
  if (orphanParents.length) {
    pushIssue(issues, {
      code: "PARENT_PROFILE_ORPHAN_USER",
      severity: "BLOCKING",
      message: "ParentProfile references missing User.",
      model: "ParentProfile",
      recordIds: orphanParents,
    });
  }

  const orphanCoaches = coaches.filter((c) => !userIds.has(c.userId)).map((c) => c.id);
  if (orphanCoaches.length) {
    pushIssue(issues, {
      code: "COACH_PROFILE_ORPHAN_USER",
      severity: "BLOCKING",
      message: "CoachProfile references missing User.",
      model: "CoachProfile",
      recordIds: orphanCoaches,
    });
  }

  const orphanAdmins = admins.filter((a) => !userIds.has(a.userId)).map((a) => a.id);
  if (orphanAdmins.length) {
    pushIssue(issues, {
      code: "ADMIN_PROFILE_ORPHAN_USER",
      severity: "BLOCKING",
      message: "AdminProfile references missing User.",
      model: "AdminProfile",
      recordIds: orphanAdmins,
    });
  }

  const athletesNoParent = athletes.filter((a) => !parentIds.has(a.parentId)).map((a) => a.id);
  if (athletesNoParent.length) {
    pushIssue(issues, {
      code: "ATHLETE_ORPHAN_PARENT",
      severity: "BLOCKING",
      message: "Athlete references missing ParentProfile.",
      model: "Athlete",
      recordIds: athletesNoParent,
    });
  }

  const athletesNoCategory = athletes.filter((a) => !categoryIds.has(a.categoryId)).map((a) => a.id);
  if (athletesNoCategory.length) {
    pushIssue(issues, {
      code: "ATHLETE_ORPHAN_CATEGORY",
      severity: "BLOCKING",
      message: "Athlete references missing Category.",
      model: "Athlete",
      recordIds: athletesNoCategory,
    });
  }

  const badAssignments = coachAssignments
    .filter((a) => !coachIds.has(a.coachId) || !categoryIds.has(a.categoryId))
    .map((a) => a.id);
  if (badAssignments.length) {
    pushIssue(issues, {
      code: "COACH_ASSIGNMENT_ORPHAN",
      severity: "BLOCKING",
      message: "CoachCategoryAssignment missing CoachProfile or Category.",
      model: "CoachCategoryAssignment",
      recordIds: badAssignments,
    });
  }

  const badEnrollments = enrollments
    .filter((e) => !athleteIds.has(e.athleteId) || !categoryIds.has(e.categoryId))
    .map((e) => e.id);
  if (badEnrollments.length) {
    pushIssue(issues, {
      code: "ENROLLMENT_ORPHAN_FK",
      severity: "BLOCKING",
      message: "Enrollment missing Athlete or Category.",
      model: "Enrollment",
      recordIds: badEnrollments,
    });
  }

  const emptySeason = enrollments
    .filter((e) => !e.seasonLabel || !e.seasonLabel.trim())
    .map((e) => e.id);
  if (emptySeason.length) {
    pushIssue(issues, {
      code: "ENROLLMENT_EMPTY_SEASON",
      severity: "WARNING",
      message: "Enrollment with empty seasonLabel.",
      model: "Enrollment",
      recordIds: emptySeason,
    });
  }

  const orphanEnrollmentDocs = enrollmentDocuments
    .filter((d) => !enrollmentIds.has(d.enrollmentId))
    .map((d) => d.id);
  if (orphanEnrollmentDocs.length) {
    pushIssue(issues, {
      code: "ENROLLMENT_DOCUMENT_ORPHAN",
      severity: "BLOCKING",
      message: "EnrollmentDocument references missing Enrollment.",
      model: "EnrollmentDocument",
      recordIds: orphanEnrollmentDocs,
    });
  }

  const orphanPayments = payments.filter((p) => !enrollmentIds.has(p.enrollmentId)).map((p) => p.id);
  if (orphanPayments.length) {
    pushIssue(issues, {
      code: "PAYMENT_ORPHAN_ENROLLMENT",
      severity: "BLOCKING",
      message: "Payment references missing Enrollment.",
      model: "Payment",
      recordIds: orphanPayments,
    });
  }

  const negativePayments = payments.filter((p) => isNegativeAmount(p.amount)).map((p) => p.id);
  if (negativePayments.length) {
    pushIssue(issues, {
      code: "PAYMENT_NEGATIVE_AMOUNT",
      severity: "BLOCKING",
      message: "Payment with negative amount.",
      model: "Payment",
      recordIds: negativePayments,
    });
  }

  const orphanReceipts = receipts.filter((r) => !paymentIds.has(r.paymentId)).map((r) => r.id);
  if (orphanReceipts.length) {
    pushIssue(issues, {
      code: "RECEIPT_ORPHAN_PAYMENT",
      severity: "BLOCKING",
      message: "Receipt references missing Payment.",
      model: "Receipt",
      recordIds: orphanReceipts,
    });
  }

  const negativeReceipts = receipts.filter((r) => isNegativeAmount(r.amount)).map((r) => r.id);
  if (negativeReceipts.length) {
    pushIssue(issues, {
      code: "RECEIPT_NEGATIVE_AMOUNT",
      severity: "BLOCKING",
      message: "Receipt with negative amount.",
      model: "Receipt",
      recordIds: negativeReceipts,
    });
  }

  const eventsBadCategory = events
    .filter((e) => e.categoryId && !categoryIds.has(e.categoryId))
    .map((e) => e.id);
  if (eventsBadCategory.length) {
    pushIssue(issues, {
      code: "EVENT_ORPHAN_CATEGORY",
      severity: "WARNING",
      message: "Event.categoryId points to missing Category.",
      model: "Event",
      recordIds: eventsBadCategory,
    });
  }

  const eventsBadUser = events.filter((e) => !userIds.has(e.createdById)).map((e) => e.id);
  if (eventsBadUser.length) {
    pushIssue(issues, {
      code: "EVENT_ORPHAN_CREATOR",
      severity: "WARNING",
      message: "Event.createdById points to missing User.",
      model: "Event",
      recordIds: eventsBadUser,
    });
  }

  const badConvocations = convocations
    .filter(
      (c) =>
        !categoryIds.has(c.categoryId) ||
        !userIds.has(c.createdById) ||
        (c.eventId != null && !eventIds.has(c.eventId)),
    )
    .map((c) => c.id);
  if (badConvocations.length) {
    pushIssue(issues, {
      code: "CONVOCATION_ORPHAN_FK",
      severity: "BLOCKING",
      message: "Convocation missing Category/User or references missing Event.",
      model: "Convocation",
      recordIds: badConvocations,
    });
  }

  const badConvocationAthletes = convocationAthletes
    .filter((c) => !convocationIds.has(c.convocationId) || !athleteIds.has(c.athleteId))
    .map((c) => c.id);
  if (badConvocationAthletes.length) {
    pushIssue(issues, {
      code: "CONVOCATION_ATHLETE_ORPHAN",
      severity: "BLOCKING",
      message: "ConvocationAthlete missing Convocation or Athlete.",
      model: "ConvocationAthlete",
      recordIds: badConvocationAthletes,
    });
  }

  const badAttendances = attendances
    .filter((a) => !athleteIds.has(a.athleteId) || !eventIds.has(a.eventId))
    .map((a) => a.id);
  if (badAttendances.length) {
    pushIssue(issues, {
      code: "ATTENDANCE_ORPHAN_FK",
      severity: "BLOCKING",
      message: "Attendance missing Athlete or Event.",
      model: "Attendance",
      recordIds: badAttendances,
    });
  }

  const badMedical = medicalVisits.filter((m) => !athleteIds.has(m.athleteId)).map((m) => m.id);
  if (badMedical.length) {
    pushIssue(issues, {
      code: "MEDICAL_VISIT_ORPHAN_ATHLETE",
      severity: "BLOCKING",
      message: "MedicalVisit references missing Athlete.",
      model: "MedicalVisit",
      recordIds: badMedical,
    });
  }

  const incoherentDates = medicalVisits
    .filter((m) => m.expiryDate.getTime() < m.visitDate.getTime())
    .map((m) => m.id);
  if (incoherentDates.length) {
    pushIssue(issues, {
      code: "MEDICAL_VISIT_DATE_INCOHERENT",
      severity: "WARNING",
      message: "MedicalVisit expiryDate before visitDate.",
      model: "MedicalVisit",
      recordIds: incoherentDates,
    });
  }

  const badDocuments = documents.filter((d) => !athleteIds.has(d.athleteId)).map((d) => d.id);
  if (badDocuments.length) {
    pushIssue(issues, {
      code: "DOCUMENT_ORPHAN_ATHLETE",
      severity: "BLOCKING",
      message: "Document references missing Athlete.",
      model: "Document",
      recordIds: badDocuments,
    });
  }

  const badAnnouncements = announcements
    .filter(
      (a) =>
        !userIds.has(a.createdById) || (a.categoryId != null && !categoryIds.has(a.categoryId)),
    )
    .map((a) => a.id);
  if (badAnnouncements.length) {
    pushIssue(issues, {
      code: "ANNOUNCEMENT_ORPHAN_FK",
      severity: "WARNING",
      message: "Announcement missing creator User or Category.",
      model: "Announcement",
      recordIds: badAnnouncements,
    });
  }

  // Collisions
  const emailMap = new Map<string, string[]>();
  for (const user of users) {
    const key = normalizeEmail(user.email);
    const list = emailMap.get(key) ?? [];
    list.push(user.id);
    emailMap.set(key, list);
  }
  const duplicateEmails = [...emailMap.entries()].filter(([, ids]) => ids.length > 1);
  if (duplicateEmails.length) {
    pushIssue(issues, {
      code: "USER_EMAIL_DUPLICATE_CI",
      severity: "BLOCKING",
      message: "Duplicate User emails (case-insensitive).",
      model: "User",
      recordIds: duplicateEmails.flatMap(([, ids]) => ids),
      details: {
        groups: duplicateEmails.length,
        samples: duplicateEmails
          .slice(0, 5)
          .map(([email]) => maskEmail(email))
          .join(", "),
      },
    });
  }

  const taxMap = new Map<string, string[]>();
  for (const athlete of athletes) {
    if (!athlete.taxCode || !athlete.taxCode.trim()) continue;
    const key = normalizeTaxCode(athlete.taxCode);
    if (!key) continue;
    const list = taxMap.get(key) ?? [];
    list.push(athlete.id);
    taxMap.set(key, list);
  }
  const duplicateTax = [...taxMap.entries()].filter(([, ids]) => ids.length > 1);
  if (duplicateTax.length) {
    pushIssue(issues, {
      code: "ATHLETE_TAXCODE_DUPLICATE",
      severity: "BLOCKING",
      message: "Duplicate Athlete taxCode after normalization.",
      model: "Athlete",
      recordIds: duplicateTax.flatMap(([, ids]) => ids),
      details: { groups: duplicateTax.length },
    });
  }

  const receiptNumberMap = new Map<string, string[]>();
  for (const receipt of receipts) {
    const key = receipt.receiptNumber.trim();
    const list = receiptNumberMap.get(key) ?? [];
    list.push(receipt.id);
    receiptNumberMap.set(key, list);
  }
  const duplicateReceiptNumbers = [...receiptNumberMap.entries()].filter(
    ([, ids]) => ids.length > 1,
  );
  if (duplicateReceiptNumbers.length) {
    pushIssue(issues, {
      code: "RECEIPT_NUMBER_DUPLICATE",
      severity: "BLOCKING",
      message: "Duplicate receiptNumber values.",
      model: "Receipt",
      recordIds: duplicateReceiptNumbers.flatMap(([, ids]) => ids),
      details: {
        samples: duplicateReceiptNumbers
          .slice(0, 5)
          .map(([n]) => n)
          .join(", "),
      },
    });
  }

  const filePathMap = new Map<string, string[]>();
  for (const doc of enrollmentDocuments) {
    if (!doc.filePath?.trim()) continue;
    const key = `EnrollmentDocument:${normalizeStoragePath(doc.filePath)}`;
    const list = filePathMap.get(key) ?? [];
    list.push(doc.id);
    filePathMap.set(key, list);
  }
  for (const visit of medicalVisits) {
    if (!visit.certificateFilePath?.trim()) continue;
    const key = `MedicalVisit:${normalizeStoragePath(visit.certificateFilePath)}`;
    const list = filePathMap.get(key) ?? [];
    list.push(visit.id);
    filePathMap.set(key, list);
  }
  for (const receipt of receipts) {
    if (!receipt.filePath?.trim()) continue;
    const key = `Receipt:${normalizeStoragePath(receipt.filePath)}`;
    const list = filePathMap.get(key) ?? [];
    list.push(receipt.id);
    filePathMap.set(key, list);
  }
  const duplicatePaths = [...filePathMap.entries()].filter(([, ids]) => ids.length > 1);
  if (duplicatePaths.length) {
    pushIssue(issues, {
      code: "FILEPATH_DUPLICATE_SUSPECT",
      severity: "WARNING",
      message: "Suspicious duplicate filePath values within the same model.",
      recordIds: duplicatePaths.flatMap(([, ids]) => ids),
      details: { groups: duplicatePaths.length },
    });
  }

  return issues;
}
