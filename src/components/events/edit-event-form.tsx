"use client";

import { useRouter } from "next/navigation";
import {
  EventForm,
  type EventFormCategoryOption,
  type EventFormValues,
} from "@/components/events/event-form";

type EditEventFormProps = {
  eventId: string;
  categories: EventFormCategoryOption[];
  initialValues: EventFormValues;
  redirectTo: string;
};

export function EditEventForm({
  eventId,
  categories,
  initialValues,
  redirectTo,
}: EditEventFormProps) {
  const router = useRouter();

  return (
    <EventForm
      mode="edit"
      title="Dati evento"
      categories={categories}
      initialValues={initialValues}
      submitLabel="Salva modifiche"
      onSubmit={async (values) => {
        const response = await fetch(`/api/events/${eventId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: values.title,
            type: values.type,
            startAt: values.startAt,
            location: values.location,
            categoryId: values.categoryId,
            notes: values.notes,
          }),
        });

        const data = (await response.json().catch(() => null)) as { error?: string } | null;

        if (!response.ok) {
          return { error: data?.error ?? "Modifica non riuscita." };
        }

        router.push(redirectTo);
        router.refresh();
        return { ok: "Evento aggiornato correttamente." };
      }}
    />
  );
}
