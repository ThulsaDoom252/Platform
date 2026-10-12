"use client";

import { useMemo, useState, useTransition } from "react";
import { Modal } from "@/components/modal";
import { buildStudentReportAction } from "@/lib/actions/materials";
import {
  reportToText,
  reportToDocxBlob,
  reportToTextBlob,
  safeFileName,
  type Report,
} from "@/lib/export-material";
import { IconFile, IconCheck } from "@/components/icons";

/**
 * Отчёт по ученику: всё пройденное одним файлом.
 * Материалы не меняются — отчёт только читает и собирает.
 */
export function ReportButton({
  studentId,
  studentName,
}: {
  studentId: string;
  studentName: string;
}) {
  const [report, setReport] = useState<Report | null>(null);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState<"txt" | "docx" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, startLoad] = useTransition();

  const text = useMemo(() => report ? reportToText(report) : "", [report]);

  function open() {
    setError(null);
    setCopied(false);
    startLoad(async () => {
      try {
        const data = await buildStudentReportAction(studentId);
        setReport(data);
      } catch {
        setError("Не удалось собрать отчёт. Обнови страницу и попробуй ещё раз. Материалы не изменены.");
      }
    });
  }

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

  async function download(format: "txt" | "docx") {
    if (!report) return;
    setError(null);
    setBusy(format);
    try {
      const blob = format === "txt" ? reportToTextBlob(report) : await reportToDocxBlob(report);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = safeFileName(`Отчёт — ${report.studentName || studentName}`, format);
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      setError("Не удалось собрать файл. Попробуй ещё раз.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={open}
        disabled={loading}
        className="flex h-10 items-center justify-center gap-2 rounded-xl border border-line px-4 text-sm font-semibold text-muted transition hover:border-accent hover:text-accent disabled:opacity-50"
      >
        <IconFile className="h-4 w-4" />
        {loading ? "Собираю…" : "Отчёт: всё пройденное"}
      </button>

      {!report && error && <p role="alert" className="w-full text-sm text-rose-500">{error}</p>}

      {report && (
        <Modal
          open
          onClose={() => setReport(null)}
          wide
          title={`Отчёт: ${report.studentName}`}
          icon={<IconFile className="h-5 w-5" />}
        >
          <div className="flex flex-col gap-4">
            <p className="text-[12px] text-muted">
              Страниц в отчёте: {report.entries.length}. Личные материалы,
              выданные разделы общей базы и разбор ошибок: словари, правила,
              лексика, времена и неправильные глаголы. Скачать можно одним текстовым файлом.
            </p>

            {report.entries.length === 0 ? (
              <p className="py-8 text-center text-sm text-faint">
                У ученика пока нет заполненных материалов.
              </p>
            ) : (
              <textarea
                readOnly
                value={text}
                rows={16}
                onFocus={(e) => e.currentTarget.select()}
                className="w-full resize-y rounded-xl border border-line bg-surface-2 px-3.5 py-3 font-mono text-[12px] leading-relaxed text-content outline-none focus:border-accent"
              />
            )}

            {error && <p role="alert" className="text-sm text-rose-500">{error}</p>}

            <div className="flex flex-wrap gap-2.5">
              <button
                type="button"
                onClick={() => setReport(null)}
                className="h-11 flex-1 rounded-xl border border-line text-sm font-semibold text-muted transition hover:bg-surface-2"
              >
                Закрыть
              </button>
              <button
                type="button"
                onClick={copy}
                disabled={report.entries.length === 0}
                className="flex h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-line text-sm font-semibold text-content transition hover:bg-surface-2 disabled:opacity-50"
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
                onClick={() => void download("docx")}
                disabled={Boolean(busy) || report.entries.length === 0}
                className="h-11 flex-1 rounded-xl border border-line text-sm font-semibold text-content transition hover:bg-surface-2 disabled:opacity-50"
              >
                {busy === "docx" ? "Собираю…" : "Скачать .docx"}
              </button>
              <button
                type="button"
                onClick={() => void download("txt")}
                disabled={Boolean(busy) || report.entries.length === 0}
                className="h-11 flex-1 rounded-xl bg-accent text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
              >
                {busy === "txt" ? "Собираю…" : "Скачать .txt"}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}
