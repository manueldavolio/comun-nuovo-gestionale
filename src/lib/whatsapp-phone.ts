/**
 * Normalize Italian mobile numbers to E.164 (+39...).
 * Returns null when the value is empty or clearly invalid / ambiguous.
 */
export function normalizeWhatsAppPhone(phone: string): string | null {
  const trimmed = phone.trim();
  if (!trimmed) {
    return null;
  }

  // Keep leading + if present, strip common separators.
  let working = trimmed.replace(/[\s().\-/]/g, "");
  if (!working) {
    return null;
  }

  // Reject letters or leftover junk early.
  if (!/^\+?\d+$/.test(working)) {
    return null;
  }

  if (working.startsWith("0039")) {
    working = `+39${working.slice(4)}`;
  } else if (working.startsWith("39") && working.length >= 11 && !working.startsWith("+")) {
    // Ambiguous: could be country code without +. Only accept if remaining looks like Italian mobile (9-10 digits starting with 3).
    const national = working.slice(2);
    if (/^3\d{8,9}$/.test(national)) {
      working = `+39${national}`;
    } else {
      return null;
    }
  } else if (/^3\d{8,9}$/.test(working)) {
    working = `+39${working}`;
  } else if (working.startsWith("+39")) {
    // already international
  } else if (working.startsWith("+")) {
    // Non-IT international: accept only if plausible length (E.164 max 15 digits including country code).
    const digits = working.slice(1);
    if (!/^\d{8,15}$/.test(digits)) {
      return null;
    }
  } else {
    return null;
  }

  if (!working.startsWith("+")) {
    return null;
  }

  const digitsOnly = working.slice(1);
  if (!/^\d{8,15}$/.test(digitsOnly)) {
    return null;
  }

  // Italian mobiles: +39 + 3XXXXXXXX (9-10 national digits).
  if (working.startsWith("+39")) {
    const national = working.slice(3);
    if (!/^3\d{8,9}$/.test(national)) {
      return null;
    }
  }

  return working;
}

/** Meta Cloud API expects digits only (no '+'). */
export function toWhatsAppApiPhone(e164: string): string {
  return e164.replace(/^\+/, "");
}
