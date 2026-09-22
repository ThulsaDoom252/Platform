"use client";

import { useActionState, useEffect, useState } from "react";
import { Modal } from "@/components/modal";
import { RuleReader } from "./rule-reader";
import { parseRuleHtml, parseRuleText, type RuleBlock } from "@/lib/rule-parser";
import { saveRuleBlocksAction, type BlocksState } from "@/lib/actions/materials";
import { IconMaterials, IconCheck, IconX } from "@/components/icons";

type Parsed = {
  title: string | null;
  subtitle: string | null;
  blocks: RuleBlock[];
  warnings: string[];
  source: "html" | "text";
};

/**
 * Импорт правила. Читает HTML из буфера обмена — так таблицы Google Docs
 * приходят настоящими таблицами, а не набором строк.
 */
export function RuleImporter({
  node,
  onClose,
}: {
  node: { id: string; name: string; icon: string | null } | null;
  onClose: () => void;
}) {
  const [parsed, setParsed] = useState<Parsed | null>(null);
  const [applyTitle, setApplyTitle] = useState(true);
  const [state, formAction, pending] = useActionState<BlocksState, FormData>(
    saveRuleBlocksAction,
    {},
  );

  useEffect(() => {
    if (state.ok) {
      const t = setTimeout(onClose, 1300);
      return () => clearTimeout(t);
    }
  }, [state, onClose]);

  if (!node) return null;

  function handlePaste(e: React.ClipboardEvent<HTMLDivElement>) {
    e.preventDefault();
    const html = e.clipboardData.getData("text/html");
    const text = e.clipboardData.getData("text/plain");

    const res = html ? parseRuleHtml(html) : parseRuleText(text);
    setParsed({ ...res, source: html ? "html" : "text" });
  }

  const tables = parsed?.blocks.filter((b) => b.type === "table").length ?? 0;
  const counts = parsed
    ? {
        headings: parsed.blocks.filter((b) => b.type === "heading").length,
        callouts: parsed.blocks.filter((b) => b.type === "callout").length,
        formulas: parsed.blocks.filter((b) => b.type === "formula").length,
        examples: parsed.blocks.filter((b) => b.type === "example").length,
      }
    : null;

  return (
    <Modal
      open
      onClose={onClose}
      wide
      title={`Правило: ${node.name}`}
      icon={<IconMaterials className="h-5 w-5" />}
    >
      <form action={formAction} className="flex flex-col gap-4">
        <input type="hidden" name="nodeId" value={node.id} />
        <input type="hidden" name="blocks" value={JSON.stringify(parsed?.blocks ?? [])} />
        <input type="hidden" name="title" value={parsed?.title ?? ""} />
        <input type="hidden" name="subtitle" value={parsed?.subtitle ?? ""} />
        {applyTitle && <input type="hidden" name="applyTitle" value="on" />}

        {/* Область вставки */}
        {!parsed && (
          <div
            contentEditable
            suppressContentEditableWarning
            onPaste={handlePaste}
            role="textbox"
            tabIndex={0}
            className="min-h-[160px] cursor-text rounded-2xl border-2 border-dashed border-line bg-surface-2 px-4 py-8 text-center text-sm text-faint outline-none transition focus:border-accent"
          >
            Скопируй правило целиком в Google Docs и вставь сюда — Ctrl+V
          </div>
        )}

        {!parsed && (
          <p className="text-[11px] leading-relaxed text-faint">
            Копируй вместе с таблицами и заголовками: из буфера читается разметка,
            поэтому таблицы сохранятся как таблицы. Если вставится просто текст,
            колонки распознаются по табуляции.
          </p>
        )}

        {/* Разбор */}
        {parsed && (
          <>
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-surface-2 px-3.5 py-2.5">
              <p className="text-sm font-semibold text-content">
                Блоков: {parsed.blocks.length}
                {tables ? ` · таблиц: ${tables}` : ""}
                {counts?.examples ? ` · примеров: ${counts.examples}` : ""}
              </p>
              <div className="flex items-center gap-3">
                <span
                  className={`rounded-md px-2 py-0.5 text-[10px] font-bold ${parsed.source === "html" ? "tint-green" : "tint-amber"}`}
                >
                  {parsed.source === "html" ? "разметка" : "обычный текст"}
                </span>
                <button
                  type="button"
                  onClick={() => setParsed(null)}
                  className="flex items-center gap-1 text-xs font-medium text-accent hover:opacity-80"
                >
                  <IconX className="h-3.5 w-3.5" /> Вставить заново
                </button>
              </div>
            </div>

            {parsed.title && (
              <label className="flex cursor-pointer items-start gap-2 rounded-xl bg-surface-2 px-3.5 py-2.5">
                <input
                  type="checkbox"
                  checked={applyTitle}
                  onChange={(e) => setApplyTitle(e.target.checked)}
                  className="mt-0.5 h-4 w-4 accent-[var(--accent)]"
                />
                <span className="text-[12px] text-muted">
                  Переименовать страницу в{" "}
                  <span className="font-semibold text-content">{parsed.title}</span>
                  {parsed.subtitle && ` · ${parsed.subtitle}`}
                </span>
              </label>
            )}

            {/* Предпросмотр — ровно то, что увидит ученик */}
            <div className="max-h-[50vh] overflow-y-auto rounded-2xl border border-line p-3">
              <RuleReader
                title={applyTitle && parsed.title ? parsed.title : node.name}
                icon={node.icon}
                description={applyTitle ? parsed.subtitle : null}
                blocks={parsed.blocks}
              />
            </div>

            {parsed.warnings.length > 0 && (
              <div className="tint-amber rounded-xl px-3.5 py-2.5 text-[11px]">
                {parsed.warnings.slice(0, 4).map((w, i) => (
                  <p key={i}>⚠️ {w}</p>
                ))}
              </div>
            )}
          </>
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
            disabled={pending || !parsed || parsed.blocks.length === 0}
            className="h-11 flex-1 rounded-xl bg-accent text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
          >
            {pending ? "Сохраняю…" : "Сохранить правило"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
