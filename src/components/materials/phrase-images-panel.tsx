"use client";

/**
 * Подбор картинок к словам словника.
 *
 * Соседнее окно, а не часть страницы: ученик словник видит, а подборку —
 * нет, и мешать их в одной разметке значило бы рано или поздно показать
 * ему ответы. Отсюда же ручная ссылка — поиск понимает не всё, а «on the
 * left» или идиому иногда проще найти глазами.
 */
import Image from "next/image";
import { useEffect, useState, useTransition } from "react";
import { useT } from "@/components/i18n-provider";
import { fmt } from "@/lib/i18n";
import {
  addPhraseImageAction,
  deletePhraseImageAction,
  imageSearchReadyAction,
  listNodeImagesAction,
  pickPhraseImageAction,
  searchNodeImagesAction,
  searchPhraseImagesAction,
  type PhraseWithImages,
} from "@/lib/actions/phrase-images";
import { IconCheck, IconSearch, IconTrash, IconX } from "@/components/icons";
import { ImageFinder } from "./image-finder";
import { cn } from "@/lib/utils";

export function PhraseImagesPanel({
  nodeId,
  nodeName,
  onClose,
}: {
  nodeId: string;
  nodeName: string;
  onClose: () => void;
}) {
  const { t } = useT();
  const [rows, setRows] = useState<PhraseWithImages[] | null>(null);
  const [hasKey, setHasKey] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [link, setLink] = useState<{ phraseId: string; url: string } | null>(null);
  const [finding, setFinding] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [busy, startBusy] = useTransition();

  useEffect(() => {
    let alive = true;
    Promise.all([listNodeImagesAction(nodeId), imageSearchReadyAction()])
      .then(([list, ready]) => {
        if (!alive) return;
        setRows(list);
        setHasKey(ready);
      })
      .catch(() => alive && setRows([]));
    return () => {
      alive = false;
    };
  }, [nodeId]);

  const reload = async () => setRows(await listNodeImagesAction(nodeId));

  const words = rows?.length ?? 0;
  const ready = (rows ?? []).filter((r) => r.images.some((i) => i.picked)).length;

  function run(work: () => Promise<{ error?: string; found?: number }>) {
    setError(null);
    setNote(null);
    startBusy(async () => {
      const result = await work();
      if (result.error) setError(result.error);
      // Сколько нашлось — иначе по молчащей кнопке не понять, сработала
      // она или по этим словам ничего нет.
      else if (typeof result.found === "number") {
        setNote(
          result.found > 0
            ? fmt(t.pictures.found, { n: result.found })
            : t.pictures.nothing,
        );
      }
      await reload();
    });
  }

  return (
    <div
      className="fixed inset-0 z-40 flex justify-end bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex h-full w-full max-w-2xl flex-col bg-surface ring-1 ring-line"
      >
        <div className="flex items-center gap-3 border-b border-line px-4 py-3">
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-bold text-content">
              {t.pictures.title} — {nodeName}
            </span>
            <span className="block text-[12px] text-faint">{t.pictures.hint}</span>
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label={t.common.close}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-faint transition hover:bg-surface-2 hover:text-content"
          >
            <IconX className="h-4 w-4" />
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-2.5">
          <button
            type="button"
            disabled={busy || !hasKey}
            onClick={() => run(() => searchNodeImagesAction(nodeId))}
            className="flex h-9 items-center gap-1.5 rounded-xl bg-accent px-3.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
          >
            <IconSearch className="h-4 w-4" />
            {busy ? t.pictures.searching : t.pictures.find}
          </button>
          <span className="text-[12px] text-faint">
            {fmt(t.pictures.ready, { ready, words })}
          </span>
        </div>

        {!hasKey && (
          <p className="tint-amber m-3 rounded-xl px-3.5 py-2.5 text-[12px]">
            {t.pictures.noKey}
          </p>
        )}
        {error && <p className="px-4 py-2 text-sm text-rose-500">{error}</p>}
        {note && <p className="px-4 py-2 text-[12px] text-accent">{note}</p>}

        <div className="min-h-0 flex-1 overflow-y-auto p-3">
          {rows === null && <p className="p-3 text-sm text-faint">{t.common.loading}</p>}

          {rows?.length === 0 && (
            <p className="p-3 text-sm text-faint">{t.pictures.skipNotes}</p>
          )}

          {(rows ?? []).map((row) => (
            <div key={row.phraseId} className="mb-3 rounded-2xl bg-surface-2 p-3">
              <div className="flex flex-wrap items-baseline gap-2">
                <span className="text-sm font-bold text-content">{row.phrase}</span>
                {row.translation && (
                  <span className="text-[12px] text-faint">{row.translation}</span>
                )}
                <span className="ml-auto flex items-center gap-1.5">
                  <span
                    title={t.pictures.query}
                    className="rounded-full bg-surface px-2 py-0.5 font-mono text-[11px] text-faint"
                  >
                    {row.query || "—"}
                  </span>
                  <button
                    type="button"
                    disabled={busy || !hasKey}
                    onClick={() => run(() => searchPhraseImagesAction(row.phraseId))}
                    title={t.pictures.findOne}
                    aria-label={t.pictures.findOne}
                    className="flex h-7 w-7 items-center justify-center rounded-lg text-faint transition hover:bg-surface hover:text-accent disabled:opacity-40"
                  >
                    <IconSearch className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    disabled={!hasKey}
                    onClick={() =>
                      setFinding(finding === row.phraseId ? null : row.phraseId)
                    }
                    className={cn(
                      "h-7 rounded-lg px-2 text-[11px] font-semibold transition disabled:opacity-40",
                      finding === row.phraseId
                        ? "bg-accent text-white"
                        : "text-accent hover:bg-surface",
                    )}
                  >
                    {t.pictures.ownSearch}
                  </button>
                </span>
              </div>

              {row.images.length === 0 ? (
                <p className="mt-2 text-[12px] text-faint">{t.pictures.noImages}</p>
              ) : (
                <div className="mt-2 grid grid-cols-3 gap-2">
                  {row.images.map((image) => (
                    <div
                      key={image.id}
                      className={cn(
                        "group relative overflow-hidden rounded-xl bg-surface ring-2 transition",
                        image.picked ? "ring-accent" : "ring-transparent hover:ring-line",
                      )}
                    >
                      <button
                        type="button"
                        onClick={() => run(() => pickPhraseImageAction(image.id))}
                        title={image.picked ? t.pictures.picked : t.pictures.pick}
                        className="relative block aspect-[4/3] w-full"
                      >
                        <Image
                          src={image.thumbUrl ?? image.url}
                          alt={row.phrase}
                          fill
                          sizes="200px"
                          unoptimized
                          className="object-cover"
                        />
                      </button>

                      {image.picked && (
                        <span className="pointer-events-none absolute left-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-accent text-white">
                          <IconCheck className="h-3 w-3" />
                        </span>
                      )}

                      <button
                        type="button"
                        onClick={() => run(() => deletePhraseImageAction(image.id))}
                        title={t.pictures.deleteWithFile}
                        aria-label={t.pictures.deleteWithFile}
                        className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/50 text-white opacity-0 transition hover:bg-rose-500 group-hover:opacity-100"
                      >
                        <IconTrash className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {finding === row.phraseId && (
                <ImageFinder
                  phraseId={row.phraseId}
                  initialQuery={row.query || row.phrase}
                  onAdded={() => void reload()}
                />
              )}

              {/* Прямая ссылка: когда картинка уже найдена где-то ещё. */}
              {link?.phraseId === row.phraseId ? (
                <div className="mt-2 flex gap-1.5">
                  <input
                    autoFocus
                    value={link.url}
                    onChange={(e) => setLink({ phraseId: row.phraseId, url: e.target.value })}
                    placeholder={t.pictures.linkPlaceholder}
                    className="h-8 min-w-0 flex-1 rounded-lg border border-line bg-surface px-2.5 text-[12px] text-content outline-none focus:border-accent"
                  />
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => {
                      const url = link.url;
                      setLink(null);
                      run(() => addPhraseImageAction(row.phraseId, url));
                    }}
                    className="h-8 shrink-0 rounded-lg bg-accent px-3 text-[12px] font-semibold text-white disabled:opacity-50"
                  >
                    {t.pictures.add}
                  </button>
                  <button
                    type="button"
                    onClick={() => setLink(null)}
                    aria-label={t.common.cancel}
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-faint hover:text-content"
                  >
                    <IconX className="h-3.5 w-3.5" />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setLink({ phraseId: row.phraseId, url: "" })}
                  className="mt-2 text-[11px] font-semibold text-accent transition hover:opacity-80"
                >
                  + {t.pictures.addByLink}
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
