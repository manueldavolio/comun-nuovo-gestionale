import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { normalizeWhatsAppPhone, toWhatsAppApiPhone } from "./whatsapp-phone";

describe("normalizeWhatsAppPhone", () => {
  it("accepts +39 E.164", () => {
    assert.equal(normalizeWhatsAppPhone("+393331234567"), "+393331234567");
  });

  it("accepts Italian mobile without country code", () => {
    assert.equal(normalizeWhatsAppPhone("3331234567"), "+393331234567");
  });

  it("strips spaces", () => {
    assert.equal(normalizeWhatsAppPhone("333 123 4567"), "+393331234567");
  });

  it("strips hyphens", () => {
    assert.equal(normalizeWhatsAppPhone("333-123-4567"), "+393331234567");
  });

  it("converts 0039 prefix", () => {
    assert.equal(normalizeWhatsAppPhone("00393331234567"), "+393331234567");
  });

  it("rejects empty", () => {
    assert.equal(normalizeWhatsAppPhone(""), null);
    assert.equal(normalizeWhatsAppPhone("   "), null);
  });

  it("rejects clearly invalid values", () => {
    assert.equal(normalizeWhatsAppPhone("abc"), null);
    assert.equal(normalizeWhatsAppPhone("123"), null);
    assert.equal(normalizeWhatsAppPhone("00223331234567"), null);
  });

  it("converts to API digits without plus", () => {
    assert.equal(toWhatsAppApiPhone("+393331234567"), "393331234567");
  });
});
