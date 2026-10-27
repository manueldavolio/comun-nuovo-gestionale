/**
 * Legacy HTTP bootstrap admin is retired.
 * Keep helpers pure so security tests can assert the disable policy without side effects.
 */

export const BOOTSTRAP_ADMIN_DISABLED_STATUS = 410 as const;
export const BOOTSTRAP_ADMIN_DISABLED_BODY = {
  error: "Operazione non disponibile.",
} as const;

export function buildBootstrapAdminDisabledResponse(): {
  status: typeof BOOTSTRAP_ADMIN_DISABLED_STATUS;
  body: typeof BOOTSTRAP_ADMIN_DISABLED_BODY;
} {
  return {
    status: BOOTSTRAP_ADMIN_DISABLED_STATUS,
    body: BOOTSTRAP_ADMIN_DISABLED_BODY,
  };
}
