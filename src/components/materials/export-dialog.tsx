"use client";

import { useMemo, useState, useTransition } from "react";
import { Modal } from "@/components/modal";
import { translateForExportAction } from "@/lib/actions/materials";
import {
  pageSourceOrText,
  pageToDocxBlob,
  safeFileName,
  type ExportPage,
} from "@/lib/export-material";
import { IconCheck, IconFile } from "@/components/icons";

/**
 * Обратный разбор страницы в обычный текст.
 * Сам материал не меняется — отсюда можно только скопировать или скачать.
 */
export function ExportDialog({
  page,
  nodeId,
  onClose,
}: {
  page: ExportPage | null;
  /** Нужен, чтобы перевести материал под выгрузку, не трогая страницу. */
  nodeId?: string | null;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Язык выгрузки живёт отдельно от языка страницы: материал можно отдать
   * ученику на его языке, а у себя оставить рабочий.
   */
  const pageLang = page?.lang ?? "UK";
  const [lang, setLang] = useState<"UK" | "RU">(pageLang);
  const [translated, setTranslated] = useState<ExportPage | null>(null);
  const [translating, startTranslate] = useTransition();

  const shown = lang === pageLang ? page : translated;
  const text = useMemo(() => (shown ? pageSourceOrText(shown) : ""), [shown]);
  // Исходник записан на языке страницы: для другого языка он уже не он.
  const isSource = lang === pageLang && !!page?.sourceText?.trim();

  function switchLang(next: "UK" | "RU") {
    setError(null);
    setLang(next);
    if (next === pageLang || !nodeId || !page) return;

    startTranslate(async () => {
      const res = await translateForExportAction(nodeId, next);
      if (res.error) setError(res.error);
      // Перевод не сохраняется: он нужен только этому файлу.
      setTranslated({
        ...page,
        phrases: res.phrases,
        blocks: res.blocks,
        lang: next,
        sourceText: null,
      });
    });
  }

  if (!page) return null;

  async function copy() {
    setError(null);
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Браузер не дал доступ к буферу — выдели текст и скопируй вручную.");
    }
  }

  async function download() {
    setError(null);
    setBusy(true);
    try {
      const blob = await pageToDocxBlob(shown ?? page!);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = safeFileName(page!.title);
      a.click();
      // Ссылка нужна только на момент клика.
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      setError("Не удалось собрать файл. Попробуй ещё раз.");
    } finally {
      setBusy(false);
    }
  }

  const lines = text ? text.split("\n").length : 0;

  return (
    <Modal
      open
      onClose={onClose}
      wide
      title={`Выгрузка: ${page.title}`}
      icon={<IconFile className="h-5 w-5" />}
    >
      <div className="flex flex-col gap-4">
        {/* Язык выгрузки: страницу он не трогает. */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[12px] font-semibold text-faint">Язык перевода</span>
          <div className="flex items-center gap-1 rounded-xl bg-surface-2 p-1 ring-1 ring-line">
            {(["UK", "RU"] as const).map((code) => (
              <button
                key={code}
                type="button"
                disabled={translating || !nodeId}
                onClick={() => switchLang(code)}
                title={
                  nodeId
                    ? "Только для этого файла — страница останется как есть"
                    : "Здесь язык не переключается"
                }
                className={
                  "h-7 rounded-lg px-2.5 text-xs font-bold transition disabled:opacity-50 " +
                  (lang === code
                    ? "bg-accent text-white"
                    : "text-muted hover:bg-surface hover:text-content")
                }
              >
                {code === "UK" ? "🇺🇦 UA" : "🇷🇺 RU"}
              </button>
            ))}
          </div>
          {translating && <span className="text-[12px] text-faint">Перевожу…</span>}
          {lang !== pageLang && !translating && (
            <span className="text-[12px] text-faint">
              Только для файла — на странице остаётся{" "}
              {pageLang === "UK" ? "украинский" : "русский"}
            </span>
          )}
        </div>

        <p className="text-[12px] text-muted">
          {isSource
            ? `Исходный текст, из которого страницу разобрали — ${lines} строк. Его можно вставить обратно в парсер.`
            : `Текстовая версия страницы — ${lines} строк. Исходник не сохранён, поэтому текст собран из содержимого.`}{" "}
          Материал на платформе остаётся как есть, здесь только копия.
        </p>

        <textarea
          readOnly
          value={text}
          rows={16}
          onFocus={(e) => e.currentTarget.select()}
          className="w-full resize-y rounded-xl border border-line bg-surface-2 px-3.5 py-3 font-mono text-[12px] leading-relaxed text-content outline-none focus:border-accent"
        />

        {error && <p className="text-sm text-rose-500">{error}</p>}

        <div className="flex flex-wrap gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="h-11 flex-1 rounded-xl border border-line text-sm font-semibold text-muted transition hover:bg-surface-2"
          >
            Закрыть
          </button>
          <button
            type="button"
            onClick={copy}
            className="flex h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-line text-sm font-semibold text-content transition hover:bg-surface-2"
          >
            {copied ? (
              <>
                <IconCheck className="h-4 w-4" /> Скопировано
              </>
            ) : (
              "Скопировать текст"
            )}
          </button>
          <button
            type="button"
            onClick={download}
            disabled={busy}
            className="h-11 flex-1 rounded-xl bg-accent text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
          >
            {busy ? "Собираю…" : "Скачать .docx"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
