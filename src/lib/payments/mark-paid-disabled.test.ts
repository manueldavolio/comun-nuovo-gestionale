import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { decideMiddlewareAuth } from "@/lib/middleware-auth";
import {
  MARK_PAID_DISABLED_BODY,
  MARK_PAID_DISABLED_STATUS,
  buildMarkPaidDisabledResponse,
  isAuthorizedReceiptDownloadApiPath,
  isPublicReceiptsStaticPath,
} from "./mark-paid-disabled";

describe("mark-paid disabled policy", () => {
  it("returns a generic 410 without payment identifiers", () => {
    const disabled = buildMarkPaidDisabledResponse();
    assert.equal(disabled.status, MARK_PAID_DISABLED_STATUS);
    assert.equal(disabled.status, 410);
    assert.deepEqual(disabled.body, MARK_PAID_DISABLED_BODY);
    assert.equal(disabled.body.error, "Operazione non disponibile.");
    const serialized = JSON.stringify(disabled.body);
    assert.equal(serialized.includes("paymentId"), false);
    assert.equal(serialized.includes("PAID"), false);
    assert.equal(serialized.includes("receipt"), false);
  });

  it("route handlers stay disabled for every HTTP method and never touch prisma/mail/fs", async () => {
    const route = await import("@/app/api/genitore/payments/[paymentId]/mark-paid/route");
    const methods = [route.POST, route.GET, route.PUT, route.PATCH, route.DELETE] as const;

    for (const handler of methods) {
      const response = await handler();
      assert.equal(response.status, 410);
      const body = (await response.json()) as { error?: string };
      assert.equal(body.error, "Operazione non disponibile.");
    }

    const source = readFileSync(
      path.join(
        process.cwd(),
        "src/app/api/genitore/payments/[paymentId]/mark-paid/route.ts",
      ),
      "utf8",
    );
    assert.equal(source.includes("@/lib/prisma"), false);
    assert.equal(source.includes("sendReceiptMail"), false);
    assert.equal(source.includes("writeFile"), false);
    assert.equal(source.includes("mkdir"), false);
    assert.equal(source.includes("generateReceiptPdf"), false);
    assert.equal(source.includes("assertUserPrimaryParentOfAthlete"), false);
    assert.equal(source.includes("getAuthSession"), false);
    assert.equal(source.includes("accountingEntry"), false);
    assert.equal(source.includes("path.join(process.cwd()"), false);
  });

  it("blocks static /receipts URLs in middleware for every role, keeps download API open", () => {
    assert.equal(isPublicReceiptsStaticPath("/receipts"), true);
    assert.equal(isPublicReceiptsStaticPath("/receipts/CN-2026-000001.pdf"), true);
    assert.equal(isPublicReceiptsStaticPath("/receipts/nested/file.pdf"), true);
    assert.equal(isPublicReceiptsStaticPath("/api/genitore/receipts/abc"), false);
    assert.equal(isPublicReceiptsStaticPath("/genitore"), false);

    assert.equal(isAuthorizedReceiptDownloadApiPath("/api/genitore/receipts/abc"), true);
    assert.equal(isAuthorizedReceiptDownloadApiPath("/receipts/CN-2026-000001.pdf"), false);

    for (const role of ["ADMIN", "PARENT", "COACH", "YOUTH_DIRECTOR", "SOCIAL_MEDIA_MANAGER"] as const) {
      const decision = decideMiddlewareAuth({
        pathname: "/receipts/CN-2026-000001.pdf",
        tokenRole: role,
        hasToken: true,
      });
      assert.deepEqual(decision, { type: "block", status: 404 });
    }

    assert.deepEqual(
      decideMiddlewareAuth({
        pathname: "/receipts/CN-2026-000001.pdf",
        tokenRole: undefined,
        hasToken: false,
      }),
      { type: "block", status: 404 },
    );

    // Authenticated download API is not a static /receipts path and stays outside this block.
    assert.equal(
      decideMiddlewareAuth({
        pathname: "/api/genitore/receipts/receipt_test_id",
        tokenRole: "PARENT",
        hasToken: true,
      }).type,
      "next",
    );
  });

  it("Stripe receipt storage helpers still target Supabase, not public/", () => {
    const receiptStorage = readFileSync(
      path.join(process.cwd(), "src/lib/receipt-storage.ts"),
      "utf8",
    );
    assert.match(receiptStorage, /saveReceiptPdf/);
    assert.match(receiptStorage, /readReceiptPdf/);
    assert.match(receiptStorage, /supabase/);
    assert.equal(receiptStorage.includes("path.join(process.cwd(), \"public\""), false);
    assert.equal(receiptStorage.includes("public/receipts"), false);

    const enrollmentPayments = readFileSync(
      path.join(process.cwd(), "src/lib/enrollment-payments.ts"),
      "utf8",
    );
    assert.match(enrollmentPayments, /saveReceiptPdf/);
    assert.equal(enrollmentPayments.includes("public/receipts"), false);

    const stripeWebhook = readFileSync(
      path.join(process.cwd(), "src/app/api/stripe/webhook/route.ts"),
      "utf8",
    );
    assert.match(stripeWebhook, /markEnrollmentPaymentPaidFromStripe/);
    assert.equal(stripeWebhook.includes("mark-paid"), false);
    assert.equal(stripeWebhook.includes("public/receipts"), false);
  });
});
