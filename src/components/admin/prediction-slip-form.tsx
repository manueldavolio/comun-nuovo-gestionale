"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

type EligibleEvent = {
  id: string;
  title: string;
  type: string;
  startAt: string;
  categoryName: string | null;
  isHome: boolean | null;
  opponentName: string;
  homeLabel: string;
  awayLabel: string;
};

type SlipFormProps = {
  mode: "create" | "edit";
  slipId?: string;
  initial?: {
    title: string;
    prizeText: string;
    closesAt: string;
    isPublished: boolean;
    eventIds: string[];
    compositionImmutable?: boolean;
  };
};

function toLocalInputValue(isoOrDate: string): string {
  const date = new Date(isoOrDate);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}T${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}`;
}

function fromLocalInputValue(value: string): string {
  // Store as floating UTC wall-clock (same convention as Event.startAt).
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value.trim());
  if (!match) return value;
  const iso = `${match[1]}-${match[2]}-${match[3]}T${match[4]}:${match[5]}:00.000Z`;
  return iso;
}

export function PredictionSlipForm({ mode, slipId, initial }: SlipFormProps) {
  const router = useRouter();
  const [title, setTitle] = useState(initial?.title ?? "");
  const [prizeText, setPrizeText] = useState(initial?.prizeText ?? "");
  const [closesAt, setClosesAt] = useState(
    initial?.closesAt ? toLocalInputValue(initial.closesAt) : "",
  );
  const [isPublished, setIsPublished] = useState(initial?.isPublished ?? false);
  const [selectedIds, setSelectedIds] = useState<string[]>(initial?.eventIds ?? []);
  const [eligible, setEligible] = useState<EligibleEvent[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const immutable = Boolean(initial?.compositionImmutable);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoadingEvents(true);
      try {
        const response = await fetch("/api/admin/prediction-slips/eligible-events");
        const payload = (await response.json().catch(() => null)) as {
          data?: EligibleEvent[];
          error?: string;
        } | null;
        if (!response.ok) {
          if (!cancelled) setError(payload?.error ?? "Impossibile caricare gli eventi.");
          return;
        }
        if (!cancelled) setEligible(payload?.data ?? []);
      } catch {
        if (!cancelled) setError("Errore di rete nel caricamento eventi.");
      } finally {
        if (!cancelled) setLoadingEvents(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const selectedEvents = useMemo(() => {
    const byId = new Map(eligible.map((event) => [event.id, event]));
    return selectedIds.map((id) => byId.get(id)).filter(Boolean) as EligibleEvent[];
  }, [eligible, selectedIds]);

  const firstKickoff = selectedEvents
    .map((event) => new Date(event.startAt).getTime())
    .filter((t) => !Number.isNaN(t))
    .sort((a, b) => a - b)[0];

  const closesAtDate = closesAt ? new Date(fromLocalInputValue(closesAt)) : null;
  const closesAfterKickoff =
    firstKickoff != null &&
    closesAtDate != null &&
    !Number.isNaN(closesAtDate.getTime()) &&
    closesAtDate.getTime() > firstKickoff;

  function toggleEvent(eventId: string) {
    if (immutable) return;
    setSelectedIds((prev) =>
      prev.includes(eventId) ? prev.filter((id) => id !== eventId) : [...prev, eventId],
    );
  }

  function moveSelected(eventId: string, direction: -1 | 1) {
    if (immutable) return;
    setSelectedIds((prev) => {
      const index = prev.indexOf(eventId);
      if (index < 0) return prev;
      const nextIndex = index + direction;
      if (nextIndex < 0 || nextIndex >= prev.length) return prev;
      const copy = [...prev];
      const [item] = copy.splice(index, 1);
      copy.splice(nextIndex, 0, item!);
      return copy;
    });
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setInfo(null);
    setSaving(true);

    const body = {
      title,
      prizeText,
      closesAt: fromLocalInputValue(closesAt),
      isPublished,
      eventIds: selectedIds,
    };

    try {
      const response = await fetch(
        mode === "create"
          ? "/api/admin/prediction-slips"
          : `/api/admin/prediction-slips/${slipId}`,
        {
          method: mode === "create" ? "POST" : "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
      );
      const payload = (await response.json().catch(() => null)) as {
        error?: string;
        data?: { id?: string };
      } | null;

      if (!response.ok) {
        setError(payload?.error ?? "Salvataggio non riuscito.");
        setSaving(false);
        return;
      }

      const id = mode === "create" ? payload?.data?.id : slipId;
      router.push(id ? `/admin/schedina/${id}` : "/admin/schedina");
      router.refresh();
    } catch {
      setError("Errore di rete. Riprova.");
      setSaving(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <div className="grid gap-4 md:grid-cols-2">
        <label className="block text-sm font-medium text-zinc-800">
          Titolo
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            className="mt-1.5 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm outline-none ring-blue-500 focus:ring-2"
          />
        </label>
        <label className="block text-sm font-medium text-zinc-800">
          Premio
          <input
            value={prizeText}
            onChange={(e) => setPrizeText(e.target.value)}
            required
            className="mt-1.5 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm outline-none ring-blue-500 focus:ring-2"
          />
        </label>
      </div>

      <label className="block text-sm font-medium text-zinc-800">
        Chiusura pronostici
        <input
          type="datetime-local"
          value={closesAt}
          onChange={(e) => setClosesAt(e.target.value)}
          required
          className="mt-1.5 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm outline-none ring-blue-500 focus:ring-2 md:w-80"
        />
      </label>

      {closesAfterKickoff ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Le giocate chiuderanno automaticamente all&apos;inizio della prima partita.
        </p>
      ) : null}

      {immutable ? (
        <p className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-900">
          Composizione immutabile: esistono già giocate. Puoi modificare titolo/premio e solo
          anticipare la chiusura.
        </p>
      ) : null}

      <label className="inline-flex items-center gap-2 text-sm font-medium text-zinc-800">
        <input
          type="checkbox"
          checked={isPublished}
          onChange={(e) => setIsPublished(e.target.checked)}
          className="h-4 w-4 rounded border-zinc-300"
        />
        Pubblica (visibile ai genitori)
      </label>

      <section className="rounded-xl border border-blue-100 bg-sky-50/40 p-4">
        <h3 className="text-sm font-semibold text-zinc-900">Partite selezionate ({selectedIds.length})</h3>
        {selectedEvents.length === 0 ? (
          <p className="mt-2 text-sm text-zinc-600">Nessuna partita selezionata.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {selectedEvents.map((event, index) => (
              <li
                key={event.id}
                className="flex flex-col gap-2 rounded-lg border border-blue-100 bg-white px-3 py-2 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="text-sm font-semibold text-zinc-900">
                    {index + 1}. {event.categoryName ?? "Partita"} · {event.homeLabel} vs{" "}
                    {event.awayLabel}
                  </p>
                  <p className="text-xs text-zinc-500">
                    {event.isHome ? "Casa" : "Trasferta"} ·{" "}
                    {new Date(event.startAt).toLocaleString("it-IT", {
                      timeZone: "UTC",
                      day: "2-digit",
                      month: "2-digit",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
                {!immutable ? (
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => moveSelected(event.id, -1)}
                      className="rounded-md border border-blue-200 px-2 py-1 text-xs font-semibold text-blue-800"
                    >
                      Su
                    </button>
                    <button
                      type="button"
                      onClick={() => moveSelected(event.id, 1)}
                      className="rounded-md border border-blue-200 px-2 py-1 text-xs font-semibold text-blue-800"
                    >
                      Giù
                    </button>
                    <button
                      type="button"
                      onClick={() => toggleEvent(event.id)}
                      className="rounded-md border border-red-200 px-2 py-1 text-xs font-semibold text-red-700"
                    >
                      Rimuovi
                    </button>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-xl border border-blue-100 bg-white p-4">
        <h3 className="text-sm font-semibold text-zinc-900">Eventi ammissibili</h3>
        {loadingEvents ? (
          <p className="mt-2 text-sm text-zinc-600">Caricamento…</p>
        ) : (
          <ul className="mt-3 max-h-80 space-y-2 overflow-y-auto">
            {eligible.map((event) => {
              const selected = selectedIds.includes(event.id);
              return (
                <li key={event.id}>
                  <button
                    type="button"
                    disabled={immutable}
                    onClick={() => toggleEvent(event.id)}
                    className={[
                      "flex w-full items-start justify-between rounded-lg border px-3 py-2 text-left text-sm transition",
                      selected
                        ? "border-blue-400 bg-blue-50"
                        : "border-zinc-200 bg-white hover:bg-sky-50",
                      immutable ? "cursor-not-allowed opacity-70" : "",
                    ].join(" ")}
                  >
                    <span>
                      <span className="font-semibold text-zinc-900">
                        {event.categoryName ?? "Partita"} · {event.homeLabel} vs {event.awayLabel}
                      </span>
                      <span className="mt-0.5 block text-xs text-zinc-500">
                        {event.isHome ? "Casa" : "Trasferta"} ·{" "}
                        {new Date(event.startAt).toLocaleString("it-IT", {
                          timeZone: "UTC",
                          day: "2-digit",
                          month: "2-digit",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </span>
                    <span className="text-xs font-semibold text-blue-800">
                      {selected ? "Selezionata" : "Aggiungi"}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {error ? <p className="text-sm text-red-700">{error}</p> : null}
      {info ? <p className="text-sm text-emerald-700">{info}</p> : null}

      <button
        type="submit"
        disabled={saving}
        className="inline-flex min-h-11 items-center justify-center rounded-xl bg-blue-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-70"
      >
        {saving ? "Salvataggio…" : mode === "create" ? "Crea schedina" : "Salva modifiche"}
      </button>
    </form>
  );
}
