import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import {
  ATHLETE_NOT_DELETABLE_HEALTH_ATTACHMENTS_MESSAGE,
  assessAthleteHealthAttachmentDeletability,
} from "@/lib/admin-athlete-delete";
import { ATHLETE_MEDICAL_NOTES_CLEAR_TOKEN } from "@/lib/athlete-medical-notes";
import {
  coachOperationalStatusApiPayload,
  sanitizeAttendanceStatusForNonAdminHealth,
} from "@/lib/health-data-access";
import { resolveOperationalStatus } from "@/lib/athlete-operational-status";
import {
  enrollmentSchemaDualImage,
  enrollmentSchemaLegacyImage,
} from "@/lib/validation/enrollment";

const root = process.cwd();

function minimalEnrollmentBase() {
  return {
    athleteFirstName: "Mario",
    athleteLastName: "Rossi",
    athleteGender: "MALE" as const,
    athleteBirthDate: "2015-05-01",
    athleteBirthPlace: "Milano",
    athleteTaxCode: "RSSMRA15E01F205X",
    athleteNationality: "IT",
    athleteAddress: "Via Roma 1",
    athleteCity: "Milano",
    athletePostalCode: "20100",
    athleteProvince: "MI",
    receiptFirstName: "Luca",
    receiptLastName: "Rossi",
    receiptTaxCode: "RSSLCU80A01F205Z",
    receiptPhone: "+39 333 1234567",
    receiptAddress: "Via Roma 1",
    receiptCity: "Milano",
    receiptPostalCode: "20100",
    receiptProvince: "MI",
    receiptEmail: "luca@example.com",
    categoryId: "cat1",
    seasonLabel: "2025/2026",
    privacyConsent: true,
    shownPrivacyNoticeVersion: "1.0",
    shownPrivacyNoticeContentSha256: "a".repeat(64),
    regulationConsent: true,
  };
}

describe("FASE 3A — enrollment no longer accepts medicalNotes", () => {
  it("strips athleteMedicalNotes from dual and legacy payloads", () => {
    const dual = enrollmentSchemaDualImage.safeParse({
      ...minimalEnrollmentBase(),
      imageConsentInternal: "GRANTED",
      imageConsentExternal: "DENIED",
      athleteMedicalNotes: "Asma da sforzo",
      medicalNotes: "Da non acquisire",
    });
    assert.equal(dual.success, true);
    if (dual.success) {
      assert.equal("athleteMedicalNotes" in dual.data, false);
      assert.equal("medicalNotes" in dual.data, false);
      assert.ok(!JSON.stringify(dual.data).includes("Asma"));
    }

    const legacy = enrollmentSchemaLegacyImage.safeParse({
      ...minimalEnrollmentBase(),
      imageConsent: true,
      athleteMedicalNotes: "Allergia",
    });
    assert.equal(legacy.success, true);
    if (legacy.success) {
      assert.equal("athleteMedicalNotes" in legacy.data, false);
    }
  });

  it("enrollment form UI no longer shows free-text medical notes field", () => {
    const form = readFileSync(
      path.join(root, "src/components/enrollment/new-enrollment-form.tsx"),
      "utf8",
    );
    assert.doesNotMatch(form, /athleteMedicalNotes/);
    assert.doesNotMatch(form, /Eventuali note mediche/i);
  });

  it("enrollment create API forces medicalNotes null", () => {
    const route = readFileSync(
      path.join(root, "src/app/api/genitore/enrollments/route.ts"),
      "utf8",
    );
    assert.match(route, /medicalNotes:\s*null/);
    assert.doesNotMatch(route, /athleteMedicalNotes/);
  });
});

describe("FASE 3A — historical medical notes ADMIN-only clear", () => {
  it("clear token is SVUOTA", () => {
    assert.equal(ATHLETE_MEDICAL_NOTES_CLEAR_TOKEN, "SVUOTA");
  });

  it("clear route is ADMIN-only and requires confirm token", () => {
    const source = readFileSync(
      path.join(root, "src/app/api/admin/athletes/[athleteId]/medical-notes/clear/route.ts"),
      "utf8",
    );
    assert.match(source, /role !== "ADMIN"/);
    assert.match(source, /ATHLETE_MEDICAL_NOTES_CLEAR_TOKEN/);
    assert.match(source, /medicalNotes: null/);
    assert.doesNotMatch(source, /YOUTH_DIRECTOR|COACH/);
  });

  it("athlete detail page loads medicalNotes only for ADMIN and shows panel", () => {
    const page = readFileSync(path.join(root, "src/app/admin/atleti/[id]/page.tsx"), "utf8");
    assert.match(page, /canAccessHealthData = session\.user\.role === "ADMIN"/);
    assert.match(page, /AthleteMedicalNotesPanel/);
    assert.match(page, /\.\.\.\(canAccessHealthData \? \{ medicalNotes: true/);
  });
});

describe("FASE 3A — athlete delete blocked by health attachments", () => {
  it("blocks medical visit certificates and archive medical docs", () => {
    const blocked = assessAthleteHealthAttachmentDeletability({
      medicalVisits: [{ certificateFilePath: "medical-visits/a.pdf" }],
      documents: [],
    });
    assert.equal(blocked.ok, false);
    if (!blocked.ok) {
      assert.equal(blocked.message, ATHLETE_NOT_DELETABLE_HEALTH_ATTACHMENTS_MESSAGE);
    }

    const archive = assessAthleteHealthAttachmentDeletability({
      medicalVisits: [],
      documents: [{ type: "MEDICAL_CERTIFICATE" }],
    });
    assert.equal(archive.ok, false);
  });

  it("delete API route goes through deleteAthleteAsAdmin (server-side block)", () => {
    const route = readFileSync(
      path.join(root, "src/app/api/admin/athletes/[athleteId]/route.ts"),
      "utf8",
    );
    assert.match(route, /deleteAthleteAsAdmin/);
    assert.match(route, /role !== "ADMIN"/);
  });

  it("no alternate athlete hard-delete API bypasses health check", () => {
    const adminApiRoot = path.join(root, "src/app/api/admin");
    const stack = [adminApiRoot];
    const deleteHandlers: string[] = [];
    while (stack.length > 0) {
      const dir = stack.pop()!;
      for (const entry of readdirSync(dir)) {
        const full = path.join(dir, entry);
        if (statSync(full).isDirectory()) {
          stack.push(full);
          continue;
        }
        if (entry !== "route.ts") continue;
        const source = readFileSync(full, "utf8");
        if (/export async function DELETE/.test(source) && /athlete/i.test(full)) {
          deleteHandlers.push(full);
        }
      }
    }
    assert.ok(
      deleteHandlers.some((p) => p.replace(/\\/g, "/").endsWith("athletes/[athleteId]/route.ts")),
    );
    for (const handler of deleteHandlers) {
      const source = readFileSync(handler, "utf8");
      if (handler.replace(/\\/g, "/").endsWith("athletes/[athleteId]/route.ts")) {
        assert.match(source, /deleteAthleteAsAdmin/);
      }
    }
  });
});

describe("FASE 3A — coach / YD payloads omit health detail", () => {
  it("sanitizeAttendanceStatus maps INJURED away for non-admin", () => {
    assert.equal(sanitizeAttendanceStatusForNonAdminHealth("INJURED", "COACH"), "ABSENT");
    assert.equal(sanitizeAttendanceStatusForNonAdminHealth("INJURED", "YOUTH_DIRECTOR"), "ABSENT");
    assert.equal(sanitizeAttendanceStatusForNonAdminHealth("INJURED", "ADMIN"), "INJURED");
    assert.equal(sanitizeAttendanceStatusForNonAdminHealth("PRESENT", "COACH"), "PRESENT");
  });

  it("mister/admin attendance SSR pages sanitize for non-admin", () => {
    const mister = readFileSync(
      path.join(root, "src/app/mister/eventi/[id]/presenze/page.tsx"),
      "utf8",
    );
    assert.match(mister, /sanitizeAttendanceStatusForNonAdminHealth/);
    const admin = readFileSync(
      path.join(root, "src/app/admin/eventi/[id]/presenze/page.tsx"),
      "utf8",
    );
    assert.match(admin, /sanitizeAttendanceStatusForNonAdminHealth/);
  });

  it("mister squadra SSR does not select medicalNotes or operational note", () => {
    const squadra = readFileSync(path.join(root, "src/app/mister/squadra/page.tsx"), "utf8");
    assert.doesNotMatch(squadra, /medicalNotes/);
    assert.match(squadra, /operationalStatus:\s*\{\s*select:\s*\{\s*status:\s*true,\s*validUntil:\s*true/);
    assert.match(squadra, /resolveParticipationFromRecord/);
  });

  it("coach operational API payload never includes diagnosis note", () => {
    const resolved = resolveOperationalStatus({
      record: {
        status: "ILL",
        note: "Diagnosi riservata",
        validUntil: null,
      },
      wallNow: new Date("2026-11-03T10:00:00.000Z"),
    });
    const payload = coachOperationalStatusApiPayload({ role: "COACH", resolved });
    assert.equal(payload.note, null);
    assert.ok(!JSON.stringify(payload).includes("Diagnosi"));
    assert.equal(payload.status, "ABSENT");
  });
});
