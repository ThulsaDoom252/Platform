"use client";

/**
 * Картинки и описания к словам словника.
 *
 * Соседнее окно, а не часть страницы: ученик словник видит, а это —
 * нет, и мешать их в одной разметке значило бы рано или поздно показать
 * ему ответы.
 *
 * Картинки учитель загружает со своего компьютера. Файл копируется в
 * хранилище платформы: исходник на его диске может быть удалён, а
 * картинка нужна игре и через полгода.
 */
import Image from "next/image";
import { useEffect, useRef, useState, useTransition } from "react";
import { useT } from "@/components/i18n-provider";
import { fmt } from "@/lib/i18n";
import {
  deletePhraseImageAction,
  fillDescriptionsAction,
  listNodeImagesAction,
  pickPhraseImageAction,
  uploadPhraseImageAction,
  type PhraseWithImages,
} from "@/lib/actions/phrase-images";
import { IconCheck, IconPlus, IconTrash, IconX } from "@/components/icons";
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
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [defsOpen, setDefsOpen] = useState(false);
  const [defsText, setDefsText] = useState("");
  const [busy, startBusy] = useTransition();

  // Одно поле выбора на всю панель: к какому слову грузим — помним рядом.
  const picker = useRef<HTMLInputElement>(null);
  const uploadFor = useRef<string | null>(null);

  const FAILURE: Record<string, string> = {
    type: t.pictures.badType,
    size: t.pictures.tooBig,
    failed: t.pictures.uploadFailed,
  };

  useEffect(() => {
    let alive = true;
    listNodeImagesAction(nodeId)
      .then((list) => alive && setRows(list))
      .catch(() => alive && setRows([]));
    return () => {
      alive = false;
    };
  }, [nodeId]);

  const reload = async () => setRows(await listNodeImagesAction(nodeId));

  const words = rows?.length ?? 0;
  const ready = (rows ?? []).filter((r) => r.images.some((i) => i.picked)).length;

  function run(work: () => Promise<{ error?: string }>) {
    setError(null);
    setNote(null);
    startBusy(async () => {
      const result = await work();
      if (result.error) setError(result.error);
      await reload();
    });
  }

  /*
   * Файлы уходят по одному за вызов: ограничение на тело запроса одно на
   * всю платформу, и пачка снимков отвалилась бы целиком из-за одного
   * лишнего мегабайта.
   */
  function upload(files: FileList | null) {
    const phraseId = uploadFor.current;
    if (!phraseId || !files || files.length === 0) return;

    setError(null);
    setNote(null);
    startBusy(async () => {
      for (const file of Array.from(files)) {
        const form = new FormData();
        form.append("phraseId", phraseId);
        form.append("image", file);
        const result = await uploadPhraseImageAction(form);
        if (result.reason || result.error) {
          setError(result.error ?? FAILURE[result.reason!] ?? t.pictures.uploadFailed);
          break;
        }
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
          <span className="text-[12px] text-faint">
            {fmt(t.pictures.ready, { ready, words })}
          </span>
          <button
            type="button"
            onClick={() => setDefsOpen((v) => !v)}
            aria-pressed={defsOpen}
            className={cn(
              "ml-auto flex h-9 items-center rounded-xl px-3.5 text-sm font-semibold transition",
              defsOpen
                ? "bg-accent-soft text-accent"
                : "text-muted hover:bg-surface-2 hover:text-content",
            )}
          >
            {t.pictures.addDefs}
          </button>
        </div>

        {defsOpen && (
          /* Описания вставляются отдельно от наполнения: наполнение
             пересобирает страницу и уносит подобранные картинки, а здесь
             ничего не удаляется. */
          <div className="border-b border-line px-4 py-3">
            <p className="text-[12px] text-faint">{t.pictures.addDefsHint}</p>
            <textarea
              value={defsText}
              onChange={(e) => setDefsText(e.target.value)}
              rows={5}
              placeholder={t.pictures.addDefsPlaceholder}
              className="mt-2 w-full resize-y rounded-xl border border-line bg-surface-2 px-3 py-2 font-mono text-[12px] text-content outline-none focus:border-accent"
            />
            <button
              type="button"
              disabled={busy || !defsText.trim()}
              onClick={() =>
                run(async () => {
                  const result = await fillDescriptionsAction(nodeId, defsText);
                  if (result.error) return result;
                  setDefsText("");
                  setNote(
                    [
                      fmt(t.pictures.addDefsDone, { n: result.filled ?? 0 }),
                      result.missed?.length
                        ? fmt(t.pictures.addDefsMissed, {
                            words: result.missed.join(", "),
                          })
                        : "",
                    ]
                      .filter(Boolean)
                      .join(" · "),
                  );
                  return {};
                })
              }
              className="mt-2 h-9 rounded-xl bg-accent px-4 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
            >
              {t.pictures.addDefsApply}
            </button>
          </div>
        )}

        {error && <p className="px-4 py-2 text-sm text-rose-500">{error}</p>}
        {note && <p className="px-4 py-2 text-[12px] text-accent">{note}</p>}

        <input
          ref={picker}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          multiple
          hidden
          onChange={(e) => {
            upload(e.target.files);
            e.target.value = "";
          }}
        />

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
              </div>

              <p
                className={cn(
                  "mt-1 text-[12px] leading-snug",
                  row.description ? "text-muted" : "text-faint/70",
                )}
              >
                {row.description || "—"}
              </p>

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

              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  uploadFor.current = row.phraseId;
                  picker.current?.click();
                }}
                className="mt-2 flex items-center gap-1 text-[11px] font-semibold text-accent transition hover:opacity-80 disabled:opacity-50"
              >
                <IconPlus className="h-3 w-3" />
                {busy ? t.pictures.uploading : t.pictures.fromComputer}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
