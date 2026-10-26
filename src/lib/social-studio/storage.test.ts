import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { SiteImageStorageError } from "@/lib/site-storage";
import {
  assertSafeSocialStudioSvg,
  describeSocialStudioUploadError,
} from "@/lib/social-studio/storage";

describe("describeSocialStudioUploadError", () => {
  it("maps missing env clearly", () => {
    const error = new SiteImageStorageError("missing", {
      stage: "env",
      code: "SUPABASE_STORAGE_ENV_MISSING",
      missingEnv: "SUPABASE_URL",
    });
    const described = describeSocialStudioUploadError(error);
    assert.equal(described.status, 500);
    assert.match(described.message, /SUPABASE_URL/);
  });

  it("maps bucket not found clearly", () => {
    const error = new SiteImageStorageError('Bucket Storage "site-images" non trovato su Supabase.', {
      stage: "upload",
      bucket: "site-images",
      code: "SUPABASE_BUCKET_NOT_FOUND",
      originalMessage: "Bucket not found",
    });
    const described = describeSocialStudioUploadError(error);
    assert.match(described.message, /site-images/);
    assert.match(described.message, /assente|non accessibile|non trovato/i);
  });

  it("maps format and size as 400", () => {
    assert.equal(
      describeSocialStudioUploadError(new Error("Formato immagine non supportato. Usa JPG.")).status,
      400,
    );
    assert.equal(
      describeSocialStudioUploadError(new Error("L'immagine supera la dimensione massima di 8 MB.")).status,
      400,
    );
  });

  it("maps unsafe svg as 400", () => {
    assert.equal(
      describeSocialStudioUploadError(
        new Error("SVG non sicuro: rimuovi script, event handler o riferimenti javascript prima del caricamento."),
      ).status,
      400,
    );
  });
});

describe("assertSafeSocialStudioSvg", () => {
  it("accepts plain svg marks", () => {
    assert.doesNotThrow(() =>
      assertSafeSocialStudioSvg(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><circle cx="1" cy="1" r="1"/></svg>')),
    );
  });

  it("rejects scripted svg", () => {
    assert.throws(() =>
      assertSafeSocialStudioSvg(
        Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'),
      ),
    );
  });
});
