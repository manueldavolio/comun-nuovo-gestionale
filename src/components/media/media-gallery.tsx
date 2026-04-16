import { MEDIA_TYPE_LABEL } from "@/lib/media";

const dateFormatter = new Intl.DateTimeFormat("it-IT", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

type MediaGalleryItem = {
  id: string;
  title: string;
  description: string | null;
  mediaType: "PHOTO" | "VIDEO";
  mediaUrl: string | null;
  filePath: string | null;
  publishedAt: Date | null;
  categoryName: string;
  createdByName: string;
};

type MediaGalleryProps = {
  items: MediaGalleryItem[];
  emptyMessage: string;
};

export function MediaGallery({ items, emptyMessage }: MediaGalleryProps) {
  if (items.length === 0) {
    return (
      <p className="rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-3 text-sm text-zinc-700">
        {emptyMessage}
      </p>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {items.map((item) => {
        const source = item.mediaUrl || item.filePath;
        return (
          <article key={item.id} className="rounded-xl border border-blue-100 bg-white p-4 shadow-sm">
            <div className="flex items-start justify-between gap-2">
              <h3 className="text-sm font-semibold text-zinc-900">{item.title}</h3>
              <span className="inline-flex rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-800">
                {MEDIA_TYPE_LABEL[item.mediaType]}
              </span>
            </div>

            <p className="mt-1 text-xs text-zinc-500">
              Categoria {item.categoryName} - Pubblicato da {item.createdByName}
            </p>

            <div className="mt-3 rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-xs text-zinc-700">
              <p className="break-all">{source ?? "Sorgente non disponibile"}</p>
            </div>

            {item.description ? (
              <p className="mt-3 text-sm text-zinc-700">
                {item.description.length > 180 ? `${item.description.slice(0, 180)}...` : item.description}
              </p>
            ) : null}

            <p className="mt-3 text-xs text-zinc-500">
              Data: {item.publishedAt ? dateFormatter.format(new Date(item.publishedAt)) : "-"}
            </p>

            {item.mediaUrl ? (
              <a
                href={item.mediaUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-3 inline-flex rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-100"
              >
                Apri media
              </a>
            ) : null}
          </article>
        );
      })}
    </div>
  );
}
