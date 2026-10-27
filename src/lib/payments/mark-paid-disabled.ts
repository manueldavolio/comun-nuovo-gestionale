/**
 * Legacy parent self-mark-paid is retired.
 * Keep helpers pure so security tests can assert the disable policy without side effects.
 */

export const MARK_PAID_DISABLED_STATUS = 410 as const;
export const MARK_PAID_DISABLED_BODY = {
  error: "Operazione non disponibile.",
} as const;

/** Static legacy PDFs under public/receipts (reachable as /receipts/...). */
export function isPublicReceiptsStaticPath(pathname: string): boolean {
  return pathname === "/receipts" || pathname.startsWith("/receipts/");
}

/** Authenticated download API must stay reachable. */
export function isAuthorizedReceiptDownloadApiPath(pathname: string): boolean {
  return (
    pathname === "/api/genitore/receipts" ||
    pathname.startsWith("/api/genitore/receipts/")
  );
}

export function buildMarkPaidDisabledResponse(): {
  status: typeof MARK_PAID_DISABLED_STATUS;
  body: typeof MARK_PAID_DISABLED_BODY;
} {
  return {
    status: MARK_PAID_DISABLED_STATUS,
    body: MARK_PAID_DISABLED_BODY,
  };
}
