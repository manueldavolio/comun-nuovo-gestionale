/**
 * Logging auth: disabilitato in produzione salvo AUTH_DEBUG=1.
 * Evita email/userId nei log di default.
 */
export function isAuthDebugEnabled(): boolean {
  if (process.env.AUTH_DEBUG === "1") return true;
  if (process.env.AUTH_DEBUG === "0") return false;
  return process.env.NODE_ENV !== "production";
}

export function authDebugLog(message: string, meta?: Record<string, unknown>) {
  if (!isAuthDebugEnabled()) return;
  if (meta) {
    console.info(message, meta);
    return;
  }
  console.info(message);
}
