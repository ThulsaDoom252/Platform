"use client";

import { useMemo, useState } from "react";
import { Modal } from "@/components/modal";
import {
  pageToText,
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
  onClose,
}: {
  page: ExportPage | null;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const text = useMemo(() => (page ? pageToText(page) : ""), [page]);

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
      const blob = await pageToDocxBlob(page!);
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
        <p className="text-[12px] text-muted">
          Текстовая версия страницы — {lines} строк. Материал на платформе
          остаётся как есть, здесь только копия.
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
