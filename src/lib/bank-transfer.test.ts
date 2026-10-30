import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  bankTransferStatusLabel,
  buildBankTransferCausal,
  formatIbanForDisplay,
  isPlausibleIban,
  normalizeIban,
} from "./bank-transfer";
import {
  BANK_TRANSFER_PROOF_MAX_BYTES,
  buildBankTransferProofObjectPath,
  validateBankTransferProofFile,
} from "./bank-transfer-storage";

describe("bank transfer helpers", () => {
  it("normalizes and validates IBAN", () => {
    assert.equal(normalizeIban("it60 x054 2811 1010 0000 0123 456"), "IT60X0542811101000000123456");
    assert.equal(isPlausibleIban("IT60X0542811101000000123456"), true);
    assert.equal(isPlausibleIban("not-an-iban"), false);
    assert.match(formatIbanForDisplay("IT60X0542811101000000123456"), /IT60/);
  });

  it("builds unique causal", () => {
    const causal = buildBankTransferCausal("pay_abc12345xyz", "bt_req999");
    assert.match(causal, /^CN-BON-/);
    assert.ok(causal.length <= 40);
  });

  it("labels parent-facing statuses", () => {
    assert.equal(bankTransferStatusLabel("AWAITING_PROOF"), "In attesa di contabile");
    assert.equal(bankTransferStatusLabel("UNDER_REVIEW"), "Bonifico in verifica");
    assert.equal(bankTransferStatusLabel("REJECTED"), "Contabile respinta");
  });

  it("validates proof mime/size and object path", () => {
    assert.equal(
      validateBankTransferProofFile({ mimeType: "application/pdf", byteLength: 1024 }).extension,
      ".pdf",
    );
    assert.throws(() =>
      validateBankTransferProofFile({ mimeType: "text/plain", byteLength: 10 }),
    );
    assert.throws(() =>
      validateBankTransferProofFile({
        mimeType: "image/png",
        byteLength: BANK_TRANSFER_PROOF_MAX_BYTES + 1,
      }),
    );
    assert.match(
      buildBankTransferProofObjectPath({ requestId: "bt_1", extension: ".jpg" }),
      /^bank-transfers\/bt_1\/\d+\.jpg$/,
    );
  });
});
