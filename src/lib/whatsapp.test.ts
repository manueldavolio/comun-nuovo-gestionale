import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildWhatsAppCloudPayload,
  buildWhatsAppTemplateParams,
  getWhatsAppConfig,
  sanitizeWhatsAppError,
  sendConvocationWhatsAppMessages,
} from "./whatsapp";

const START = new Date(Date.UTC(2026, 8, 20, 15, 30, 0)); // 20/09/2026 15:30 UTC wall-clock

describe("whatsapp convocation helpers", () => {
  it("builds template params in athlete → date → meet time → location order", () => {
    const params = buildWhatsAppTemplateParams({
      athleteFullName: "Mario Rossi",
      startAt: START,
      location: "Campo Comunale",
    });

    assert.deepEqual(
      [params.athleteName, params.dateLabel, params.meetTimeLabel, params.locationLabel],
      ["Mario Rossi", "20/09/2026", "15:30", "Campo Comunale"],
    );
  });

  it("uses placeholder when location is missing", () => {
    const params = buildWhatsAppTemplateParams({
      athleteFullName: "Luca Bianchi",
      startAt: START,
      location: null,
    });
    assert.equal(params.locationLabel, "Da definire");
  });

  it("requires env vars without hardcoding secrets", () => {
    const config = getWhatsAppConfig({
      WHATSAPP_ACCESS_TOKEN: "",
      WHATSAPP_PHONE_NUMBER_ID: "123",
      WHATSAPP_API_VERSION: "v22.0",
    });
    assert.equal(config.enabled, false);
    assert.ok(config.missingVars.includes("WHATSAPP_ACCESS_TOKEN"));
  });

  it("sanitizes tokens from error messages", () => {
    const reason = sanitizeWhatsAppError({
      message: "OAuthException Bearer EAABLAHBLAH token=secret123",
      code: "OAuthException",
    });
    assert.equal(reason.includes("EAABLAHBLAH"), false);
    assert.equal(reason.includes("secret123"), false);
    assert.equal(reason.includes("Bearer "), false);
  });

  it("sends successfully to all recipients via mock", async () => {
    const calls: string[] = [];
    const result = await sendConvocationWhatsAppMessages({
      recipients: [
        { phone: "3331234567", athleteFullName: "A Uno", parentFullName: "P Uno" },
        { phone: "+393331234568", athleteFullName: "A Due", parentFullName: "P Due" },
      ],
      startAt: START,
      location: "Campo",
      config: {
        enabled: true,
        accessToken: "test-token",
        phoneNumberId: "phone-id",
        apiVersion: "v22.0",
        templateName: "convocazione_partita",
        missingVars: [],
      },
      sendOne: async (args) => {
        calls.push(args.apiPhone);
        assert.deepEqual(args.bodyParams.slice(1), ["20/09/2026", "15:30", "Campo"]);
      },
    });

    assert.equal(result.attempted, true);
    assert.equal(result.sent, 2);
    assert.equal(result.failed, 0);
    assert.equal(calls.length, 2);
  });

  it("collects a single Meta error", async () => {
    const result = await sendConvocationWhatsAppMessages({
      recipients: [
        { phone: "3331234567", athleteFullName: "Mario Rossi", parentFullName: "Luigi Rossi" },
      ],
      startAt: START,
      location: "Campo",
      config: {
        enabled: true,
        accessToken: "test-token",
        phoneNumberId: "phone-id",
        apiVersion: "v22.0",
        templateName: "convocazione_partita",
        missingVars: [],
      },
      sendOne: async () => {
        throw { error: { code: 132001, message: "Template name does not exist in the translation" } };
      },
    });

    assert.equal(result.sent, 0);
    assert.equal(result.failed, 1);
    assert.equal(result.failures[0]?.athleteName, "Mario Rossi");
    assert.equal(result.failures[0]?.reason, "Template non disponibile");
  });

  it("marks missing phone as failure without calling Meta", async () => {
    let called = false;
    const result = await sendConvocationWhatsAppMessages({
      recipients: [{ phone: "", athleteFullName: "Senza Numero", parentFullName: "Genitore" }],
      startAt: START,
      location: "Campo",
      config: {
        enabled: true,
        accessToken: "test-token",
        phoneNumberId: "phone-id",
        apiVersion: "v22.0",
        templateName: "convocazione_partita",
        missingVars: [],
      },
      sendOne: async () => {
        called = true;
      },
    });

    assert.equal(called, false);
    assert.equal(result.failed, 1);
    assert.equal(result.failures[0]?.reason, "Numero di telefono mancante");
  });

  it("marks invalid phone as failure without calling Meta", async () => {
    let called = false;
    const result = await sendConvocationWhatsAppMessages({
      recipients: [{ phone: "12ab", athleteFullName: "Invalido", parentFullName: null }],
      startAt: START,
      location: "Campo",
      config: {
        enabled: true,
        accessToken: "test-token",
        phoneNumberId: "phone-id",
        apiVersion: "v22.0",
        templateName: "convocazione_partita",
        missingVars: [],
      },
      sendOne: async () => {
        called = true;
      },
    });

    assert.equal(called, false);
    assert.equal(result.failures[0]?.reason, "Numero di telefono non valido");
  });

  it("supports mixed success and failures", async () => {
    const result = await sendConvocationWhatsAppMessages({
      recipients: [
        { phone: "3331111111", athleteFullName: "Ok", parentFullName: "G1" },
        { phone: "", athleteFullName: "NoPhone", parentFullName: "G2" },
        { phone: "3332222222", athleteFullName: "FailMeta", parentFullName: "G3" },
      ],
      startAt: START,
      location: "Campo",
      config: {
        enabled: true,
        accessToken: "test-token",
        phoneNumberId: "phone-id",
        apiVersion: "v22.0",
        templateName: "convocazione_partita",
        missingVars: [],
      },
      sendOne: async (args) => {
        if (args.apiPhone.endsWith("2222222")) {
          throw { message: "Temporary failure" };
        }
      },
    });

    assert.equal(result.sent, 1);
    assert.equal(result.failed, 2);
  });

  it("skips Meta when configuration is missing", async () => {
    let called = false;
    const result = await sendConvocationWhatsAppMessages({
      recipients: [{ phone: "3331234567", athleteFullName: "A", parentFullName: "P" }],
      startAt: START,
      location: "Campo",
      config: {
        enabled: false,
        accessToken: "",
        phoneNumberId: "",
        apiVersion: "",
        templateName: "convocazione_partita",
        missingVars: ["WHATSAPP_ACCESS_TOKEN", "WHATSAPP_PHONE_NUMBER_ID", "WHATSAPP_API_VERSION"],
      },
      sendOne: async () => {
        called = true;
      },
    });

    assert.equal(called, false);
    assert.equal(result.attempted, false);
    assert.ok(result.skippedReason?.includes("Configurazione WhatsApp mancante"));
  });

  it("never returns the access token in failures", async () => {
    const token = "EAA_SUPER_SECRET_TOKEN_VALUE";
    const result = await sendConvocationWhatsAppMessages({
      recipients: [{ phone: "3331234567", athleteFullName: "A", parentFullName: "P" }],
      startAt: START,
      location: "Campo",
      config: {
        enabled: true,
        accessToken: token,
        phoneNumberId: "phone-id",
        apiVersion: "v22.0",
        templateName: "convocazione_partita",
        missingVars: [],
      },
      sendOne: async () => {
        throw { message: `Unauthorized Bearer ${token}` };
      },
    });

    const blob = JSON.stringify(result);
    assert.equal(blob.includes(token), false);
    assert.equal(blob.toLowerCase().includes("bearer "), false);
  });

  it("builds cloud payload with ordered body parameters", () => {
    const payload = buildWhatsAppCloudPayload({
      apiPhone: "393331234567",
      templateName: "convocazione_partita",
      languageCode: "it",
      bodyParams: ["Mario", "20/09/2026", "15:30", "Campo"],
    });

    const parameters = (
      payload.template.components[0] as {
        parameters: Array<{ text: string }>;
      }
    ).parameters.map((item) => item.text);

    assert.deepEqual(parameters, ["Mario", "20/09/2026", "15:30", "Campo"]);
  });
});
