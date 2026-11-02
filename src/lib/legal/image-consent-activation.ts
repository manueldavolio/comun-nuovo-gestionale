import { getCurrentLegalDocument } from "@/lib/legal/legal-documents";

/**
 * Dual INTERNAL/EXTERNAL 1.1 is active only after explicit activation:
 * - IMAGE_CONSENT_INTERNAL and IMAGE_CONSENT_EXTERNAL are current
 * - both have effectiveFrom <= now
 * - IMAGE_MEDIA_CONSENT 1.0 is NO longer current
 *
 * Seed alone must NOT flip this to true.
 */
export async function isDualImageConsentV11Active(now = new Date()): Promise<boolean> {
  const [internal, external, legacy] = await Promise.all([
    getCurrentLegalDocument("IMAGE_CONSENT_INTERNAL"),
    getCurrentLegalDocument("IMAGE_CONSENT_EXTERNAL"),
    getCurrentLegalDocument("IMAGE_MEDIA_CONSENT"),
  ]);

  if (legacy) {
    return false;
  }
  if (!internal?.effectiveFrom || !external?.effectiveFrom) {
    return false;
  }
  return internal.effectiveFrom <= now && external.effectiveFrom <= now;
}

export type ImageConsentRuntimeMode = "legacy_v1" | "dual_v1_1";

export async function resolveImageConsentRuntimeMode(
  now = new Date(),
): Promise<ImageConsentRuntimeMode> {
  return (await isDualImageConsentV11Active(now)) ? "dual_v1_1" : "legacy_v1";
}
