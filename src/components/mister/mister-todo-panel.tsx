import Link from "next/link";
import { CheckCircle2, CircleAlert, Lightbulb } from "lucide-react";
import type { MisterTodoItem } from "@/lib/mister-todo";
import { misterTodoPriorityLabel } from "@/lib/mister-todo";

function toneForPriority(priority: MisterTodoItem["priority"]): string {
  switch (priority) {
    case "high":
      return "border-red-100 bg-red-50/70";
    case "medium":
      return "border-amber-100 bg-amber-50/60";
    case "soft":
      return "border-sky-100 bg-sky-50/70";
    case "suggestion":
      return "border-blue-100 bg-blue-50/50";
    default:
      return "border-zinc-100 bg-zinc-50";
  }
}

export function MisterTodoPanel({
  todos,
  suggestions,
}: {
  todos: MisterTodoItem[];
  suggestions: MisterTodoItem[];
}) {
  const actionable = todos.filter((todo) => todo.priority !== "suggestion");

  return (
    <section className="rounded-2xl border border-blue-100 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex items-center gap-2">
        <CircleAlert className="h-5 w-5 text-blue-800" />
        <h2 className="text-lg font-bold text-zinc-900">Da fare</h2>
      </div>
      <p className="mt-1 text-sm text-zinc-600">
        Attività operative derivate dai dati reali. Nessuna notifica inventata.
      </p>

      {actionable.length === 0 ? (
        <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3">
          <p className="inline-flex items-center gap-2 text-sm font-bold text-emerald-900">
            <CheckCircle2 className="h-4 w-4" />
            Tutto aggiornato
          </p>
          <p className="mt-1 text-sm text-emerald-800">
            Non ci sono attività urgenti da completare.
          </p>
        </div>
      ) : (
        <ul className="mt-4 space-y-2.5">
          {actionable.map((todo) => (
            <li
              key={todo.id}
              className={`rounded-2xl border p-3.5 ${toneForPriority(todo.priority)}`}
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wide text-zinc-500">
                    {misterTodoPriorityLabel(todo.priority)}
                  </p>
                  <p className="font-bold text-zinc-900">{todo.title}</p>
                  {todo.subtitle ? (
                    <p className="mt-0.5 text-sm text-zinc-600">{todo.subtitle}</p>
                  ) : null}
                </div>
                <Link
                  href={todo.href}
                  className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-xl bg-blue-800 px-4 text-sm font-bold text-white hover:bg-blue-900"
                >
                  Apri
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}

      {suggestions.length > 0 ? (
        <div className="mt-5 rounded-2xl border border-dashed border-blue-200 bg-sky-50/40 p-3.5">
          <p className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-blue-800">
            <Lightbulb className="h-3.5 w-3.5" />
            Suggerimenti crescita
          </p>
          <ul className="mt-2 space-y-2">
            {suggestions.map((todo) => (
              <li
                key={todo.id}
                className="flex flex-col gap-2 rounded-xl border border-blue-100 bg-white px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="text-sm font-semibold text-zinc-900">{todo.title}</p>
                  {todo.subtitle ? (
                    <p className="text-xs text-zinc-500">{todo.subtitle}</p>
                  ) : null}
                </div>
                <Link
                  href={todo.href}
                  className="inline-flex min-h-11 items-center justify-center rounded-xl border border-blue-200 px-3 text-xs font-bold text-blue-800"
                >
                  Vai alla rosa
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
