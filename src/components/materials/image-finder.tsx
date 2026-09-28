"use client";

/**
 * Свой поиск картинки к слову.
 *
 * Автоподбор угадывает не всегда: «to have» или идиому по самому слову
 * не найти, а что именно их изображает — решает учитель. Поэтому здесь
 * он пишет запрос своими словами и берёт из выдачи то, что подходит.
 *
 * Взятая картинка скачивается на платформу: ссылка на чужой сайт живёт
 * ровно столько, сколько её там держат.
 */
import Image from "next/image";
import { useState, useTransition } from "react";
import { useT } from "@/components/i18n-provider";
import {
  addPhraseImageAction,
  searchImagesAction,
  type FoundImage,
} from "@/lib/actions/phrase-images";
import { IconCheck, IconSearch } from "@/components/icons";
import { cn } from "@/lib/utils";

export function ImageFinder({
  phraseId,
  initialQuery,
  onAdded,
}: {
  phraseId: string;
  /** Подставляется в поле, чтобы не набирать слово заново. */
  initialQuery: string;
  onAdded: () => void;
}) {
  const { t } = useT();
  const [query, setQuery] = useState(initialQuery);
  const [found, setFound] = useState<FoundImage[] | null>(null);
  const [taken, setTaken] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, startBusy] = useTransition();

  function run() {
    const text = query.trim();
    if (!text) return;
    setError(null);
    startBusy(async () => setFound(await searchImagesAction(text)));
  }

  function add(url: string) {
    setError(null);
    startBusy(async () => {
      const result = await addPhraseImageAction(phraseId, url);
      if (result.error) {
        setError(result.error);
        return;
      }
      setTaken((prev) => [...prev, url]);
      onAdded();
    });
  }

  return (
    <div className="mt-2 rounded-xl bg-surface p-2.5 ring-1 ring-line">
      <p className="text-[11px] text-faint">{t.pictures.ownSearchHint}</p>

      <div className="mt-1.5 flex gap-1.5">
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && run()}
          placeholder={t.pictures.searchPlaceholder}
          className="h-8 min-w-0 flex-1 rounded-lg border border-line bg-surface-2 px-2.5 text-[12px] text-content outline-none focus:border-accent"
        />
        <button
          type="button"
          onClick={run}
          disabled={busy || !query.trim()}
          className="flex h-8 shrink-0 items-center gap-1.5 rounded-lg bg-accent px-3 text-[12px] font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
        >
          <IconSearch className="h-3.5 w-3.5" />
          {busy ? t.pictures.searching : t.pictures.run}
        </button>
      </div>

      {error && <p className="mt-1.5 text-[12px] text-rose-500">{error}</p>}

      {found?.length === 0 && (
        <p className="mt-2 text-[12px] text-faint">{t.pictures.noResults}</p>
      )}

      {(found?.length ?? 0) > 0 && (
        <div className="mt-2 grid max-h-64 grid-cols-3 gap-2 overflow-y-auto sm:grid-cols-4">
          {(found ?? []).map((item) => {
            const already = taken.includes(item.url);
            return (
              <button
                key={item.url}
                type="button"
                disabled={busy || already}
                onClick={() => add(item.url)}
                title={already ? t.pictures.added : t.pictures.addThis}
                className={cn(
                  "group relative aspect-[4/3] overflow-hidden rounded-lg bg-surface-2 ring-2 transition",
                  already ? "ring-accent" : "ring-transparent hover:ring-accent",
                )}
              >
                <Image
                  src={item.thumbUrl || item.url}
                  alt=""
                  fill
                  sizes="160px"
                  unoptimized
                  className="object-cover"
                />
                {already && (
                  <span className="absolute inset-0 flex items-center justify-center bg-accent/70 text-white">
                    <IconCheck className="h-5 w-5" />
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
