"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type BankSettingsFormProps = {
  initialBeneficiary: string;
  initialIban: string;
};

export function BankSettingsForm({
  initialBeneficiary,
  initialIban,
}: BankSettingsFormProps) {
  const router = useRouter();
  const [beneficiary, setBeneficiary] = useState(initialBeneficiary);
  const [iban, setIban] = useState(initialIban);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSave(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setOk(null);
    try {
      const response = await fetch("/api/admin/bank-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ beneficiary, iban }),
      });
      const body = (await response.json().catch(() => null)) as
        | { error?: string; settings?: { beneficiary: string; iban: string } }
        | null;
      if (!response.ok) {
        setError(body?.error ?? "Salvataggio non riuscito.");
        return;
      }
      if (body?.settings) {
        setBeneficiary(body.settings.beneficiary);
        setIban(body.settings.iban);
      }
      setOk("Coordinate bancarie salvate.");
      router.refresh();
    } catch {
      setError("Errore imprevisto.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSave} className="space-y-3">
      <div>
        <label className="text-xs font-bold uppercase tracking-wide text-blue-900/70">
          Beneficiario
        </label>
        <input
          value={beneficiary}
          onChange={(e) => setBeneficiary(e.target.value)}
          className="mt-1 w-full rounded-xl border border-sky-200 px-3 py-2 text-sm"
          placeholder="Es. ASD Comun Nuovo"
          required
        />
      </div>
      <div>
        <label className="text-xs font-bold uppercase tracking-wide text-blue-900/70">IBAN</label>
        <input
          value={iban}
          onChange={(e) => setIban(e.target.value)}
          className="mt-1 w-full rounded-xl border border-sky-200 px-3 py-2 font-mono text-sm"
          placeholder="IT60X0542811101000000123456"
          required
        />
      </div>
      <button
        type="submit"
        disabled={saving}
        className="rounded-xl bg-blue-800 px-4 py-2 text-sm font-bold text-white hover:bg-blue-900 disabled:opacity-60"
      >
        {saving ? "Salvataggio..." : "Salva coordinate"}
      </button>
      {ok ? <p className="text-xs text-emerald-700">{ok}</p> : null}
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
    </form>
  );
}
