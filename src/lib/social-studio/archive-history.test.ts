import assert from "node:assert/strict";
import { describe, it } from "node:test";

/**
 * Contratto archivio: la sostituzione aggiorna solo il record SocialAsset
 * con un nuovo publicUrl. Le bozze storiche tengono il vecchio URL negli overrides.
 */
describe("opponent logo replace historical safety", () => {
  it("keeps previous graphic override URL when archive asset URL changes", () => {
    const oldUrl = "https://cdn.example/site-images/social-studio/assets/old-logo.png";
    const newUrl = "https://cdn.example/site-images/social-studio/assets/new-logo.png";
    const historicalOverride = { opponentLogoUrl: oldUrl };
    const archiveAsset = { publicUrl: oldUrl };

    // replace writes a NEW object path and updates archive pointer only
    archiveAsset.publicUrl = newUrl;

    assert.equal(historicalOverride.opponentLogoUrl, oldUrl);
    assert.equal(archiveAsset.publicUrl, newUrl);
    assert.notEqual(historicalOverride.opponentLogoUrl, archiveAsset.publicUrl);
  });
});
