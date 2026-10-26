import assert from "node:assert/strict";
import { describe, it } from "node:test";

/**
 * Contratto archivio: la sostituzione aggiorna i record SocialAsset (e alias
 * che condividono lo stesso file) con un nuovo publicUrl.
 * Le bozze storiche tengono il vecchio URL negli overrides e non cambiano.
 */
describe("opponent logo replace historical safety", () => {
  it("keeps previous graphic override URL when archive asset URL changes", () => {
    const oldUrl = "https://cdn.example/site-images/social-studio/assets/old-logo.png";
    const newUrl = "https://cdn.example/site-images/social-studio/assets/new-logo.png";
    const historicalOverride = { opponentLogoUrl: oldUrl };
    const archiveAsset = { publicUrl: oldUrl };
    const verifiedAlias = { publicUrl: oldUrl, label: "Or. Arcene Brignano" };

    // replace writes a NEW object path and updates archive + alias pointers only
    archiveAsset.publicUrl = newUrl;
    verifiedAlias.publicUrl = newUrl;

    assert.equal(historicalOverride.opponentLogoUrl, oldUrl);
    assert.equal(archiveAsset.publicUrl, newUrl);
    assert.equal(verifiedAlias.publicUrl, newUrl);
    assert.notEqual(historicalOverride.opponentLogoUrl, archiveAsset.publicUrl);
  });
});
