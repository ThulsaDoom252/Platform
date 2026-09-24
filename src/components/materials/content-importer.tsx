"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { Modal } from "@/components/modal";
import {
  parseMaterial,
  flattenClipboardHtml,
  type ParserMode,
} from "@/lib/materials-parser";
import { savePageContentAction, type ParseState } from "@/lib/actions/materials";
import { IconMaterials, IconCheck } from "@/components/icons";
import type { TreeScope } from "./node-editor";
import { VocabularyCoverField } from "./vocabulary-cover";
import { cn } from "@/lib/utils";

/**
 * Вставка учебного текста из Google Docs.
 * Разбор делается прямо в браузере для мгновенного предпросмотра,
 * а при сохранении сервер разбирает текст заново — ему нельзя доверять клиенту.
 */
const MODE_OPTIONS: Record<ParserMode, { label: string; hint: string }> = {
  vocabulary: { label: "Словник", hint: "слово / фраза — перевод + примеры" },
  rule: { label: "Правило", hint: "название, пояснение, примеры" },
  mistake: { label: "Ошибка", hint: "как сказал → как правильно" },
};

export function ContentImporter({
  node,
  onClose,
  scope = "MATERIAL",
}: {
  node: { id: string; name: string } | null;
  onClose: () => void;
  scope?: TreeScope;
}) {
  const modes: ParserMode[] =
    scope === "MISTAKE" ? ["mistake", "rule"] : ["vocabulary", "rule"];
  const [raw, setRaw] = useState("");
  const [mode, setMode] = useState<ParserMode>(modes[0]);
  const [applyTitle, setApplyTitle] = useState(false);
  const [state, formAction, pending] = useActionState<ParseState, FormData>(
    savePageContentAction,
    {},
  );

  const preview = useMemo(
    () => (raw.trim() ? parseMaterial(raw, mode) : null),
    [raw, mode],
  );

  useEffect(() => {
    if (state.ok) {
      const t = setTimeout(onClose, 1200);
      return () => clearTimeout(t);
    }
  }, [state, onClose]);

  if (!node) return null;

  /**
   * Если в буфере таблица — раскладываем её по колонкам сами.
   * Обычный текст вставляется как обычно, без вмешательства.
   */
  function handlePaste(e: React.ClipboardEvent<HTMLTextAreaElement>) {
    const flat = flattenClipboardHtml(e.clipboardData.getData("text/html"));
    if (!flat) return;
    e.preventDefault();
    const el = e.currentTarget;
    setRaw(raw.slice(0, el.selectionStart) + flat + raw.slice(el.selectionEnd));
  }

  const phraseCount = preview?.phrases.filter((p) => p.kind === "PHRASE").length ?? 0;
  const noteCount = preview?.phrases.filter((p) => p.kind === "NOTE").length ?? 0;

  return (
    <Modal
      open
      onClose={onClose}
      wide
      title={`Наполнить: ${node.name}`}
      icon={<IconMaterials className="h-5 w-5" />}
    >
      <form action={formAction} className="flex flex-col gap-4">
        <input type="hidden" name="nodeId" value={node.id} />
        <input type="hidden" name="mode" value={mode} />
        <input type="hidden" name="raw" value={raw} />
        {applyTitle && <input type="hidden" name="applyTitle" value="on" />}

        {/* Тип парсера */}
        <div>
          <p className="mb-2 text-sm font-medium text-content">Тип материала</p>
          <div className="flex gap-2">
            {modes.map((id) => (
              <button
                key={id}
                type="button"
                onClick={() => setMode(id)}
                className={cn(
                  "flex-1 rounded-xl border p-3 text-left transition",
                  mode === id
                    ? "border-accent bg-accent-soft"
                    : "border-line hover:bg-surface-2",
                )}
              >
                <span className="block text-sm font-semibold text-content">
                  {MODE_OPTIONS[id].label}
                </span>
                <span className="mt-0.5 block text-[11px] text-muted">
                  {MODE_OPTIONS[id].hint}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Ввод */}
        <div>
          <label className="text-sm font-medium text-content">
            Вставь текст из Google Docs
          </label>
          {mode === "vocabulary" && (
            <p className="mt-0.5 text-[11px] text-faint">
              Таблицу можно копировать целиком — форматы Word / IPA / Translation и
              Word / Phrase / Examples распознаются сами, а заголовки вроде «Nouns —
              Іменники» станут разделами.
            </p>
          )}
          <textarea
            value={raw}
            onChange={(e) => setRaw(e.target.value)}
            onPaste={handlePaste}
            rows={8}
            placeholder={
              mode === "vocabulary"
                ? "Строками:\ndropped /drɒpt/ — виключений зі складу\n• The striker was dropped. — Нападника виключили.\n\nИли таблицей:\n📖 Nouns — Іменники\nWord / Phrase\tIPA\tTranslation\nan election\t/ɪˈlekʃən/\tвибори"
                : mode === "mistake"
                  ? "Past Simple\nI go to school yesterday → I went to school yesterday\n• Прошедшее время, а не настоящее\n\nArticles\nI am student → I am a student"
                  : "Present Simple\nВживаємо для регулярних дій.\n• I go to school every day. — Я ходжу до школи щодня."
            }
            className="mt-1.5 w-full resize-y rounded-xl border border-line bg-surface-2 px-3.5 py-3 font-mono text-[13px] leading-relaxed text-content outline-none transition placeholder:text-faint focus:border-accent"
          />
        </div>

        {mode === "vocabulary" && (
          <div>
            <p className="mb-2 text-sm font-medium text-content">Обложка словаря</p>
            <VocabularyCoverField />
            <p className="mt-1.5 text-[11px] text-faint">
              Необязательно. Обложка появится только внутри файла — в шапке
              словаря.
            </p>
          </div>
        )}

        {/* Предпросмотр */}
        {preview && (
          <div className="rounded-xl border border-line">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-3.5 py-2.5">
              <p className="text-sm font-semibold text-content">
                Предпросмотр — {phraseCount} записей
                {noteCount ? `, ${noteCount} заметок` : ""}
              </p>
              {mode === "vocabulary" &&
                preview.vocabularyFormat === "word-examples-table" && (
                  <span className="tint-green rounded-md px-2 py-0.5 text-[10px] font-bold">
                    авто: слова + примеры
                  </span>
                )}
              {preview.title && (
                <label className="flex cursor-pointer items-center gap-2 text-[11px] text-muted">
                  <input
                    type="checkbox"
                    checked={applyTitle}
                    onChange={(e) => setApplyTitle(e.target.checked)}
                    className="h-3.5 w-3.5 accent-[var(--accent)]"
                  />
                  Взять заголовок из текста
                </label>
              )}
            </div>

            {preview.title && (
              <p className="border-b border-line bg-surface-2 px-3.5 py-2 text-xs text-muted">
                <span className="font-semibold text-content">{preview.title}</span>
                {preview.description && ` · ${preview.description}`}
              </p>
            )}

            <div className="max-h-64 overflow-y-auto px-3.5 py-2">
              {preview.phrases.length === 0 && (
                <p className="py-4 text-center text-sm text-faint">Пока нечего показать.</p>
              )}
              {preview.phrases.map((p, i) => (
                <div key={i} className="border-b border-line py-2 last:border-0">
                  {p.section && (
                    <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-accent">
                      {p.section}
                    </p>
                  )}
                  {p.kind === "NOTE" ? (
                    <p className="text-[13px] text-content">
                      💡 <span className="font-semibold">{p.phrase}</span> — {p.translation}
                    </p>
                  ) : (
                    <>
                      <p className="text-[13px] text-content">
                        <span className="mr-1">{p.icon}</span>
                        <span className="font-semibold">{p.phrase}</span>
                        {p.transcription && (
                          <span className="ml-1.5 font-mono text-[11px] text-faint">
                            {p.transcription}
                          </span>
                        )}
                      </p>
                      <p className="text-[12px] text-[color:var(--lesson-green)]">
                        {p.translation}
                      </p>
                      {p.examples.length > 0 && (
                        <p className="mt-0.5 text-[11px] text-faint">
                          {p.examples.length} примера
                        </p>
                      )}
                    </>
                  )}
                </div>
              ))}
            </div>

            {preview.warnings.length > 0 && (
              <div className="tint-amber border-t border-line px-3.5 py-2.5 text-[11px]">
                {preview.warnings.slice(0, 4).map((w, i) => (
                  <p key={i}>⚠️ {w}</p>
                ))}
              </div>
            )}
          </div>
        )}

        <p className="text-[11px] text-faint">
          Сохранение полностью заменяет содержимое страницы.
        </p>

        {state.error && <p className="text-sm text-rose-500">{state.error}</p>}
        {state.ok && (
          <p className="tint-green flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold">
            <IconCheck className="h-4 w-4" />
            {state.message}
          </p>
        )}

        <div className="flex gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="h-11 flex-1 rounded-xl border border-line text-sm font-semibold text-muted transition hover:bg-surface-2"
          >
            Отмена
          </button>
          <button
            type="submit"
            disabled={pending || phraseCount === 0}
            className="h-11 flex-1 rounded-xl bg-accent text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
          >
            {pending ? "Сохраняю…" : `Сохранить (${phraseCount})`}
          </button>
        </div>
      </form>
    </Modal>
  );
}
