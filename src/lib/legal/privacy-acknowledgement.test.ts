import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { recordPrivacyNoticeAcknowledgement } from "./privacy-acknowledgement";

describe("recordPrivacyNoticeAcknowledgement", () => {
  it("upserts the exact version/hash/source provided (no invented acceptance)", async () => {
    const acknowledgedAt = new Date("2026-11-03T10:00:00.000Z");
    let upsertArgs: unknown;

    const client = {
      privacyNoticeAcknowledgement: {
        async upsert(args: unknown) {
          upsertArgs = args;
          return {
            id: "ack-1",
            documentVersion: "1.0",
            documentContentSha256: "abc123",
            acknowledgedAt,
            source: "enrollment",
          };
        },
      },
    };

    const result = await recordPrivacyNoticeAcknowledgement(
      {
        userId: "user-1",
        documentVersion: "1.0",
        documentContentSha256: "abc123",
        source: "enrollment",
        acknowledgedAt,
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      client as any,
    );

    assert.equal(result.documentVersion, "1.0");
    assert.equal(result.documentContentSha256, "abc123");
    assert.equal(result.source, "enrollment");

    const args = upsertArgs as {
      where: { userId_documentVersion: { userId: string; documentVersion: string } };
      create: {
        userId: string;
        documentVersion: string;
        documentContentSha256: string;
        source: string;
        acknowledgedAt: Date;
      };
      update: {
        documentContentSha256: string;
        source: string;
        acknowledgedAt: Date;
      };
    };

    assert.equal(args.where.userId_documentVersion.userId, "user-1");
    assert.equal(args.where.userId_documentVersion.documentVersion, "1.0");
    assert.equal(args.create.documentContentSha256, "abc123");
    assert.equal(args.create.source, "enrollment");
    assert.equal(args.update.source, "enrollment");
    assert.equal(args.update.documentContentSha256, "abc123");
  });
});
