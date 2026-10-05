import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { PrismaClient } from "@prisma/client";
import {
  ATHLETE_DELETE_CONFIRM_TOKEN,
  ATHLETE_NOT_DELETABLE_FINANCIAL_MESSAGE,
  assessAthleteFinancialDeletability,
  deleteAthleteAsAdmin,
} from "./admin-athlete-delete";

function asPrisma(mock: unknown): PrismaClient {
  return mock as PrismaClient;
}

function payment(overrides: {
  id?: string;
  status?: "PENDING" | "PAID" | "OVERDUE" | "CANCELLED";
  paidAt?: Date | null;
  receipt?: { id: string } | null;
  accountingEntry?: { id: string } | null;
} = {}) {
  return {
    id: overrides.id ?? "pay-1",
    status: overrides.status ?? "PENDING",
    paidAt: overrides.paidAt ?? null,
    receipt: overrides.receipt ?? null,
    accountingEntry: overrides.accountingEntry ?? null,
  };
}

describe("assessAthleteFinancialDeletability", () => {
  it("allows only PENDING payments without receipt or accounting", () => {
    const result = assessAthleteFinancialDeletability([
      payment({ id: "d", status: "PENDING" }),
      payment({ id: "b", status: "PENDING" }),
    ]);
    assert.equal(result.ok, true);
  });

  it("blocks PAID payments", () => {
    const result = assessAthleteFinancialDeletability([
      payment({ status: "PENDING" }),
      payment({ id: "paid", status: "PAID" }),
    ]);
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.reason, "PAID_PAYMENT");
      assert.equal(result.message, ATHLETE_NOT_DELETABLE_FINANCIAL_MESSAGE);
    }
  });

  it("blocks payments with paidAt set", () => {
    const result = assessAthleteFinancialDeletability([
      payment({ paidAt: new Date("2026-01-01T00:00:00.000Z") }),
    ]);
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.reason, "PAID_AT");
    }
  });

  it("blocks when a receipt exists", () => {
    const result = assessAthleteFinancialDeletability([
      payment({ receipt: { id: "receipt-1" } }),
    ]);
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.reason, "RECEIPT");
    }
  });

  it("blocks when an accounting entry exists", () => {
    const result = assessAthleteFinancialDeletability([
      payment({ accountingEntry: { id: "ae-1" } }),
    ]);
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.reason, "ACCOUNTING_ENTRY");
    }
  });
});

describe("ATHLETE_DELETE_CONFIRM_TOKEN", () => {
  it("requires typing ELIMINA", () => {
    assert.equal(ATHLETE_DELETE_CONFIRM_TOKEN, "ELIMINA");
  });
});

describe("deleteAthleteAsAdmin", () => {
  it("returns 404 when athlete does not exist", async () => {
    const result = await deleteAthleteAsAdmin({
      athleteId: "missing",
      prisma: asPrisma({
        athlete: {
          findUnique: async () => null,
        },
        $transaction: async () => {
          throw new Error("should not transaction");
        },
      }),
      cleanupEnrollmentStorage: async () => ({ removed: [], failed: [] }),
    });

    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.status, 404);
      assert.equal(result.error, "Atleta non trovato.");
    }
  });

  it("blocks delete when Payment is PAID and keeps parent/category ids untouched", async () => {
    let deleted = false;

    const result = await deleteAthleteAsAdmin({
      athleteId: "ath-1",
      prisma: asPrisma({
        athlete: {
          findUnique: async () => ({
            id: "ath-1",
            firstName: "prova",
            lastName: "prova",
            parentId: "parent-1",
            categoryId: "cat-1",
            documents: [],
            medicalVisits: [],
            enrollments: [
              {
                documents: [],
                payments: [
                  payment({ id: "p1", status: "PAID", paidAt: new Date() }),
                  payment({ id: "p2", status: "PENDING" }),
                ],
              },
            ],
          }),
        },
        $transaction: async () => {
          deleted = true;
        },
      }),
      cleanupEnrollmentStorage: async () => ({ removed: [], failed: [] }),
    });

    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.status, 409);
      assert.equal(result.error, ATHLETE_NOT_DELETABLE_FINANCIAL_MESSAGE);
    }
    assert.equal(deleted, false);
  });

  it("blocks delete when Receipt exists", async () => {
    const result = await deleteAthleteAsAdmin({
      athleteId: "ath-1",
      prisma: asPrisma({
        athlete: {
          findUnique: async () => ({
            id: "ath-1",
            firstName: "A",
            lastName: "B",
            parentId: "parent-1",
            categoryId: "cat-1",
            documents: [],
            medicalVisits: [],
            enrollments: [
              {
                documents: [],
                payments: [payment({ receipt: { id: "r1" } })],
              },
            ],
          }),
        },
        $transaction: async () => {
          throw new Error("should not run");
        },
      }),
      cleanupEnrollmentStorage: async () => ({ removed: [], failed: [] }),
    });

    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.status, 409);
    }
  });

  it("blocks delete when AccountingEntry exists", async () => {
    const result = await deleteAthleteAsAdmin({
      athleteId: "ath-1",
      prisma: asPrisma({
        athlete: {
          findUnique: async () => ({
            id: "ath-1",
            firstName: "A",
            lastName: "B",
            parentId: "parent-1",
            categoryId: "cat-1",
            documents: [],
            medicalVisits: [],
            enrollments: [
              {
                documents: [],
                payments: [payment({ accountingEntry: { id: "ae1" } })],
              },
            ],
          }),
        },
        $transaction: async () => {
          throw new Error("should not run");
        },
      }),
      cleanupEnrollmentStorage: async () => ({ removed: [], failed: [] }),
    });

    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.status, 409);
    }
  });

  it("deletes athlete with only PENDING payments and does not delete parent/user/category", async () => {
    const calls: string[] = [];
    const cleanupPaths: string[] = [];

    const result = await deleteAthleteAsAdmin({
      athleteId: "ath-prova",
      prisma: asPrisma({
        athlete: {
          findUnique: async () => ({
            id: "ath-prova",
            firstName: "prova",
            lastName: "prova",
            parentId: "parent-keep",
            categoryId: "cat-keep",
            documents: [{ filePath: "manual/doc.pdf" }],
            medicalVisits: [{ certificateFilePath: "medical/cert.pdf" }],
            enrollments: [
              {
                documents: [{ filePath: "enrollment-documents/enr1/id.pdf" }],
                payments: [
                  payment({ id: "dep", status: "PENDING" }),
                  payment({ id: "bal", status: "PENDING" }),
                ],
              },
            ],
          }),
        },
        $transaction: async (fn: (tx: {
          accountingEntry: { deleteMany: (args: unknown) => Promise<{ count: number }> };
          athlete: { delete: (args: unknown) => Promise<unknown> };
        }) => Promise<void>) => {
          await fn({
            accountingEntry: {
              deleteMany: async (args) => {
                calls.push(`ae:${JSON.stringify(args)}`);
                return { count: 0 };
              },
            },
            athlete: {
              delete: async (args) => {
                calls.push(`athlete:${JSON.stringify(args)}`);
                return {};
              },
            },
          });
        },
      }),
      cleanupEnrollmentStorage: async (paths) => {
        cleanupPaths.push(...paths);
        return { removed: paths, failed: [] };
      },
    });

    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.athleteId, "ath-prova");
      assert.equal(result.parentProfileId, "parent-keep");
      assert.equal(result.categoryId, "cat-keep");
      assert.deepEqual(cleanupPaths, ["enrollment-documents/enr1/id.pdf"]);
      assert.ok(result.leftoverStoragePaths.includes("manual/doc.pdf"));
      assert.ok(result.leftoverStoragePaths.includes("medical/cert.pdf"));
    }

    assert.equal(calls.length, 2);
    assert.match(calls[0]!, /ae:/);
    assert.match(calls[1]!, /"ath-prova"/);
  });
});
