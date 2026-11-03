import Link from "next/link";

type PrivacyNoticeLeadBannerProps = {
  /** Versione informativa pubblicata e mostrata (es. "1.0"). */
  version?: string | null;
  /**
   * Contesto UX:
   * - enrollment: presa visione obbligatoria prima dell'invio iscrizione
   * - register: solo avviso informativo (nessuna accettazione inventata)
   */
  context?: "enrollment" | "register";
  className?: string;
};

/**
 * Avviso discreto all'inizio di percorsi che trattano dati personali.
 * Non sostituisce la checkbox di presa visione obbligatoria all'invio (iscrizione).
 */
export function PrivacyNoticeLeadBanner({
  version,
  context = "enrollment",
  className,
}: PrivacyNoticeLeadBannerProps) {
  const versionLabel = version?.trim() ? ` (versione ${version.trim()})` : "";
  const trailing =
    context === "register"
      ? "La registrazione dell'account non registra automaticamente una presa visione: potrai confermarla in area genitori o in fase di iscrizione."
      : "La presa visione sarà richiesta prima dell'invio e non equivale a un consenso generico a tutti i trattamenti.";

  return (
    <aside
      role="note"
      className={
        className ??
        "rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2.5 text-sm text-zinc-700"
      }
    >
      <p>
        Prima di inserire dati personali, consulta l&apos;
        <Link
          href="/privacy"
          className="font-medium text-blue-800 underline underline-offset-2 hover:text-blue-900"
        >
          informativa privacy
        </Link>
        {versionLabel}. {trailing}
      </p>
    </aside>
  );
}
