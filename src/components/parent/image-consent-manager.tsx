"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type ImageConsentChoiceValue = "GRANTED" | "DENIED" | "DEFERRED";
type ImageConsentPurposeValue = "INTERNAL" | "EXTERNAL";

type PurposeState = {
  choice: ImageConsentChoiceValue | null;
  granted: boolean;
  documentVersion: string | null;
  recordedAt: string | Date | null;
  legacyHistoricalOnly: boolean;
  source: string;
};

type AthleteConsentRow = {
  id: string;
  firstName: string;
  lastName: string;
  granted: boolean;
  internal?: PurposeState;
  external?: PurposeState;
};

const OPTIONS: Array<{ value: ImageConsentChoiceValue; label: string }> = [
  { value: "GRANTED", label: "AUTORIZZO" },
  { value: "DENIED", label: "NON AUTORIZZO" },
  { value: "DEFERRED", label: "DECIDERÒ PIÙ AVANTI" },
];

function formatChoiceLabel(choice: ImageConsentChoiceValue | null, legacy: boolean) {
  if (legacy) return "Storico 1.0 (non convertito — non abilita nuove pubblicazioni)";
  if (choice === "GRANTED") return "AUTORIZZO";
  if (choice === "DENIED") return "NON AUTORIZZO";
  if (choice === "DEFERRED") return "DECIDERÒ PIÙ AVANTI";
  return "Nessuna scelta 1.1";
}

export function ImageConsentManager({
  athletes,
  mode = "legacy_v1",
}: {
  athletes: AthleteConsentRow[];
  mode?: "legacy_v1" | "dual_v1_1";
}) {
  const router = useRouter();
  const [drafts, setDrafts] = useState<
    Record<string, { INTERNAL: ImageConsentChoiceValue | null; EXTERNAL: ImageConsentChoiceValue | null }>
  >(() =>
    Object.fromEntries(athletes.map((athlete) => [athlete.id, { INTERNAL: null, EXTERNAL: null }])),
  );
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);

  async function saveLegacy(athleteId: string, granted: boolean) {
    setPendingKey(athleteId);
    setError(null);
    setOk(null);
    setWarning(null);
    try {
      const response = await fetch(`/api/genitore/athletes/${athleteId}/image-consent`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ granted }),
      });
      const body = (await response.json().catch(() => null)) as {
        error?: string;
        warning?: string | null;
      } | null;
      if (!response.ok) {
        setError(body?.error ?? "Aggiornamento non riuscito.");
        return;
      }
      setOk(granted ? "Autorizzazione immagini aggiornata." : "Autorizzazione immagini revocata.");
      if (body?.warning) setWarning(body.warning);
      router.refresh();
    } catch {
      setError("Errore di rete. Riprova.");
    } finally {
      setPendingKey(null);
    }
  }

  async function savePurpose(
    athleteId: string,
    purpose: ImageConsentPurposeValue,
    previousGranted: boolean,
  ) {
    const choice = drafts[athleteId]?.[purpose];
    if (!choice) {
      setError("Seleziona un'opzione prima di salvare.");
      return;
    }

    if (
      previousGranted &&
      choice !== "GRANTED" &&
      !window.confirm(
        choice === "DEFERRED"
          ? "DECIDERÒ PIÙ AVANTI non costituisce consenso. I nuovi utilizzi per questa finalità saranno sospesi. Continuare?"
          : "Stai revocando l'autorizzazione. I nuovi utilizzi per questa finalità saranno sospesi. Continuare?",
      )
    ) {
      return;
    }

    setPendingKey(`${athleteId}:${purpose}`);
    setError(null);
    setOk(null);
    setWarning(null);
    try {
      const response = await fetch(`/api/genitore/athletes/${athleteId}/image-consent`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ purpose, choice }),
      });
      const body = (await response.json().catch(() => null)) as {
        error?: string;
        warning?: string | null;
      } | null;
      if (!response.ok) {
        setError(body?.error ?? "Aggiornamento non riuscito.");
        return;
      }
      setOk(
        purpose === "INTERNAL"
          ? "Autorizzazione uso interno aggiornata."
          : "Autorizzazione pubblicazione esterna aggiornata.",
      );
      if (body?.warning) setWarning(body.warning);
      setDrafts((prev) => ({
        ...prev,
        [athleteId]: { ...prev[athleteId], [purpose]: null },
      }));
      router.refresh();
    } catch {
      setError("Errore di rete. Riprova.");
    } finally {
      setPendingKey(null);
    }
  }

  if (athletes.length === 0) {
    return null;
  }

  if (mode === "legacy_v1") {
    return (
      <section className="rounded-3xl border border-blue-100 bg-white p-4 shadow-sm sm:p-5">
        <h2 className="text-lg font-black text-zinc-900">Autorizzazione foto e video</h2>
        <p className="mt-1 text-sm text-zinc-600">
          Consenso immagini versione 1.0 ancora attivo. Le autorizzazioni separate 1.1 saranno
          disponibili dopo l&apos;attivazione ufficiale.
        </p>
        <ul className="mt-4 space-y-3">
          {athletes.map((athlete) => (
            <li
              key={athlete.id}
              className="flex flex-col gap-2 rounded-xl border border-zinc-200 p-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <p className="font-semibold text-zinc-900">
                  {athlete.firstName} {athlete.lastName}
                </p>
                <p className="text-xs text-zinc-500">
                  Stato: {athlete.granted ? "autorizzato" : "non autorizzato"}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={pendingKey === athlete.id || athlete.granted}
                  onClick={() => saveLegacy(athlete.id, true)}
                  className="rounded-lg bg-blue-700 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-800 disabled:opacity-50"
                >
                  Autorizza
                </button>
                <button
                  type="button"
                  disabled={pendingKey === athlete.id || !athlete.granted}
                  onClick={() => saveLegacy(athlete.id, false)}
                  className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-xs font-semibold text-zinc-800 hover:bg-zinc-50 disabled:opacity-50"
                >
                  Revoca
                </button>
              </div>
            </li>
          ))}
        </ul>
        {error ? (
          <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        ) : null}
        {warning ? (
          <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            {warning}
          </p>
        ) : null}
        {ok ? (
          <p className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
            {ok}
          </p>
        ) : null}
      </section>
    );
  }

  return (
    <section className="rounded-3xl border border-blue-100 bg-white p-4 shadow-sm sm:p-5">
      <h2 className="text-lg font-black text-zinc-900">Autorizzazioni foto e video</h2>
      <p className="mt-1 text-sm text-zinc-600">
        Due autorizzazioni indipendenti (uso interno e pubblicazione esterna). Puoi salvarle una
        alla volta. Nessuna opzione è preselezionata. I consensi 1.0 non vengono convertiti
        automaticamente.
      </p>

      <ul className="mt-4 space-y-4">
        {athletes.map((athlete) => (
          <li key={athlete.id} className="rounded-xl border border-zinc-200 p-3">
            <p className="font-semibold text-zinc-900">
              {athlete.firstName} {athlete.lastName}
            </p>

            {(
              [
                {
                  purpose: "INTERNAL" as const,
                  title: "A) Uso interno e societario",
                  state: athlete.internal,
                },
                {
                  purpose: "EXTERNAL" as const,
                  title: "B) Pubblicazione esterna",
                  state: athlete.external,
                },
              ] as const
            ).map((block) => {
              const pending = pendingKey === `${athlete.id}:${block.purpose}`;
              const draft = drafts[athlete.id]?.[block.purpose] ?? null;
              const state = block.state ?? {
                choice: null,
                granted: false,
                documentVersion: null,
                recordedAt: null,
                legacyHistoricalOnly: false,
                source: "none",
              };
              return (
                <div
                  key={block.purpose}
                  className="mt-3 rounded-lg border border-zinc-100 bg-zinc-50/60 p-3"
                >
                  <p className="text-sm font-semibold text-zinc-900">{block.title}</p>
                  <p className="mt-1 text-xs text-zinc-500">
                    Stato attuale:{" "}
                    {formatChoiceLabel(state.choice, state.legacyHistoricalOnly)}
                    {state.documentVersion ? ` · testo ${state.documentVersion}` : ""}
                  </p>
                  <div className="mt-2 space-y-1">
                    {OPTIONS.map((option) => (
                      <label
                        key={`${block.purpose}-${option.value}`}
                        className="flex items-center gap-2 text-sm"
                      >
                        <input
                          type="radio"
                          name={`${athlete.id}-${block.purpose}`}
                          checked={draft === option.value}
                          onChange={() =>
                            setDrafts((prev) => ({
                              ...prev,
                              [athlete.id]: {
                                INTERNAL: prev[athlete.id]?.INTERNAL ?? null,
                                EXTERNAL: prev[athlete.id]?.EXTERNAL ?? null,
                                [block.purpose]: option.value,
                              },
                            }))
                          }
                          className="h-4 w-4 border-zinc-300 text-blue-700 focus:ring-blue-500"
                        />
                        <span>{option.label}</span>
                      </label>
                    ))}
                  </div>
                  <button
                    type="button"
                    disabled={pending || !draft}
                    onClick={() => savePurpose(athlete.id, block.purpose, state.granted)}
                    className="mt-3 rounded-lg bg-blue-700 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-800 disabled:opacity-50"
                  >
                    {pending
                      ? "Salvataggio..."
                      : `Salva solo ${block.purpose === "INTERNAL" ? "uso interno" : "pubblicazione esterna"}`}
                  </button>
                </div>
              );
            })}
          </li>
        ))}
      </ul>

      {error ? (
        <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      ) : null}
      {warning ? (
        <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          {warning}
        </p>
      ) : null}
      {ok ? (
        <p className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          {ok}
        </p>
      ) : null}
    </section>
  );
}
