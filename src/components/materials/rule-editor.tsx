"use client";

import { useState, useTransition } from "react";
import { Modal } from "@/components/modal";
import { RuleReader } from "./rule-reader";
import { parseRuleText, type RuleBlock } from "@/lib/rule-parser";
import { saveRuleEditAction } from "@/lib/actions/materials";
import { IconPencil, IconX, IconChevronDown } from "@/components/icons";
import { cn } from "@/lib/utils";

type BlockType = RuleBlock["type"];

const TYPE_LABEL: Record<BlockType, string> = {
  heading: "Заголовок",
  callout: "Врезка",
  formula: "Формула",
  text: "Текст",
  example: "Пример",
  list: "Список",
  table: "Таблица",
};

const TONE_LABEL: Record<string, string> = {
  key: "главное",
  warn: "важно",
  tip: "подсказка",
  info: "заметка",
};

const inputCls =
  "w-full rounded-xl border border-line bg-surface-2 px-3 py-2 text-sm text-content outline-none transition placeholder:text-faint focus:border-accent";

/** Текст блока, который имеет смысл сохранить при смене типа. */
function textOf(b: RuleBlock): string {
  if (b.type === "example") return b.en;
  if (b.type === "list") return b.items.join(" ");
  if (b.type === "table") return "";
  return b.text;
}

function emptyBlock(type: BlockType, text = ""): RuleBlock {
  switch (type) {
    case "callout":
      return { type: "callout", text, tone: "info" };
    case "example":
      return { type: "example", en: text, tr: "" };
    case "list":
      return { type: "list", items: text ? [text] : [""] };
    case "table":
      return { type: "table", headers: [""], rows: [[""]] };
    default:
      return { type, text };
  }
}

/** Таблица правится как текст: строки по переносам, колонки по табуляции. */
function tableToText(b: Extract<RuleBlock, { type: "table" }>): string {
  return [b.headers, ...b.rows].filter((r) => r.length).map((r) => r.join("\t")).join("\n");
}

function textToTable(s: string): Extract<RuleBlock, { type: "table" }> {
  const rows = s.split(/\r?\n/).map((l) => l.split("\t").map((c) => c.trim()));
  const [headers, ...body] = rows;
  return { type: "table", headers: headers ?? [], rows: body.filter((r) => r.some(Boolean)) };
}

/** Одна карточка блока: смена типа, поля, перестановка и удаление. */
function BlockCard({
  block,
  index,
  total,
  onChange,
  onMove,
  onRemove,
}: {
  block: RuleBlock;
  index: number;
  total: number;
  onChange: (b: RuleBlock) => void;
  onMove: (delta: number) => void;
  onRemove: () => void;
}) {
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-line p-3">
      <div className="flex items-center gap-2">
        <select
          value={block.type}
          onChange={(e) => onChange(emptyBlock(e.target.value as BlockType, textOf(block)))}
          className="h-8 rounded-lg border border-line bg-surface-2 px-2 text-xs font-semibold text-content outline-none focus:border-accent"
        >
          {(Object.keys(TYPE_LABEL) as BlockType[]).map((t) => (
            <option key={t} value={t}>
              {TYPE_LABEL[t]}
            </option>
          ))}
        </select>

        {block.type === "callout" && (
          <select
            value={block.tone ?? "info"}
            onChange={(e) =>
              onChange({ ...block, tone: e.target.value as "key" | "warn" | "tip" | "info" })
            }
            className="h-8 rounded-lg border border-line bg-surface-2 px-2 text-xs text-content outline-none focus:border-accent"
          >
            {Object.keys(TONE_LABEL).map((t) => (
              <option key={t} value={t}>
                {TONE_LABEL[t]}
              </option>
            ))}
          </select>
        )}

        <span className="flex-1" />

        <button
          type="button"
          onClick={() => onMove(-1)}
          disabled={index === 0}
          title="Выше"
          className="flex h-7 w-7 items-center justify-center rounded-lg text-faint transition hover:bg-surface-2 hover:text-content disabled:opacity-30"
        >
          <IconChevronDown className="h-4 w-4 rotate-180" />
        </button>
        <button
          type="button"
          onClick={() => onMove(1)}
          disabled={index === total - 1}
          title="Ниже"
          className="flex h-7 w-7 items-center justify-center rounded-lg text-faint transition hover:bg-surface-2 hover:text-content disabled:opacity-30"
        >
          <IconChevronDown className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={onRemove}
          title="Удалить блок"
          className="flex h-7 w-7 items-center justify-center rounded-lg text-faint transition hover:bg-surface-2 hover:text-rose-500"
        >
          <IconX className="h-4 w-4" />
        </button>
      </div>

      {block.type === "callout" && (
        <input
          value={block.label ?? ""}
          onChange={(e) => onChange({ ...block, label: e.target.value })}
          placeholder="Метка врезки — ВАЖЛИВО, ГОЛОВНЕ…"
          className={inputCls}
        />
      )}

      {(block.type === "heading" ||
        block.type === "formula" ||
        block.type === "text" ||
        block.type === "callout") && (
        <textarea
          value={block.text}
          onChange={(e) => onChange({ ...block, text: e.target.value })}
          rows={block.type === "text" || block.type === "callout" ? 3 : 1}
          placeholder="Текст блока"
          className={cn(inputCls, "resize-y")}
        />
      )}

      {block.type === "example" && (
        <>
          <input
            value={block.en}
            onChange={(e) => onChange({ ...block, en: e.target.value })}
            placeholder="Пример на английском"
            className={inputCls}
          />
          <input
            value={block.tr ?? ""}
            onChange={(e) => onChange({ ...block, tr: e.target.value })}
            placeholder="Перевод примера"
            className={inputCls}
          />
        </>
      )}

      {block.type === "list" && (
        <textarea
          value={block.items.join("\n")}
          onChange={(e) => onChange({ type: "list", items: e.target.value.split(/\r?\n/) })}
          rows={Math.max(2, block.items.length)}
          placeholder="Каждый пункт с новой строки"
          className={cn(inputCls, "resize-y")}
        />
      )}

      {block.type === "table" && (
        <>
          <p className="text-[11px] text-faint">
            Первая строка — шапка. Колонки разделяются табуляцией.
          </p>
          <textarea
            value={tableToText(block)}
            onChange={(e) => onChange(textToTable(e.target.value))}
            rows={Math.max(3, block.rows.length + 1)}
            className={cn(inputCls, "resize-y font-mono text-[12px]")}
          />
        </>
      )}
    </div>
  );
}

/**
 * Ручная правка правила: исходный текст, разобранные блоки и предпросмотр.
 * Разбор — только помощник, последнее слово за блоками: сохраняются именно они.
 */
export function RuleEditor({
  node,
  onClose,
}: {
  node: {
    id: string;
    name: string;
    icon: string | null;
    description: string | null;
    blocks: RuleBlock[];
    sourceText: string | null;
  } | null;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<"blocks" | "source" | "preview">("blocks");
  const [blocks, setBlocks] = useState<RuleBlock[]>(() => node?.blocks ?? []);
  const [source, setSource] = useState(() => node?.sourceText ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saving, startSave] = useTransition();

  if (!node) return null;

  const update = (i: number, b: RuleBlock) =>
    setBlocks((p) => p.map((x, j) => (j === i ? b : x)));

  const move = (i: number, delta: number) =>
    setBlocks((p) => {
      const j = i + delta;
      if (j < 0 || j >= p.length) return p;
      const next = [...p];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });

  function reparse() {
    if (!source.trim()) return;
    if (
      blocks.length > 0 &&
      !confirm("Разобрать исходник заново? Ручные правки блоков пропадут.")
    ) {
      return;
    }
    setBlocks(parseRuleText(source).blocks);
    setTab("blocks");
  }

  function save() {
    setError(null);
    startSave(async () => {
      const res = await saveRuleEditAction(node!.id, blocks, source);
      if (res.error) setError(res.error);
      else onClose();
    });
  }

  const tabCls = (active: boolean) =>
    cn(
      "flex-1 rounded-xl border px-3 py-2 text-sm font-semibold transition",
      active ? "border-accent bg-accent-soft text-content" : "border-line text-muted hover:bg-surface-2",
    );

  return (
    <Modal
      open
      onClose={onClose}
      wide
      title={`Правило: ${node.name}`}
      icon={<IconPencil className="h-5 w-5" />}
    >
      <div className="flex flex-col gap-4">
        <div className="flex gap-2">
          <button type="button" onClick={() => setTab("blocks")} className={tabCls(tab === "blocks")}>
            Блоки ({blocks.length})
          </button>
          <button type="button" onClick={() => setTab("source")} className={tabCls(tab === "source")}>
            Исходник
          </button>
          <button type="button" onClick={() => setTab("preview")} className={tabCls(tab === "preview")}>
            Предпросмотр
          </button>
        </div>

        {tab === "blocks" && (
          <>
            <div className="flex max-h-[50vh] flex-col gap-2.5 overflow-y-auto pr-1">
              {blocks.length === 0 && (
                <p className="py-8 text-center text-sm text-faint">
                  Блоков нет. Добавь вручную или разбери исходник.
                </p>
              )}
              {blocks.map((b, i) => (
                <BlockCard
                  key={i}
                  block={b}
                  index={i}
                  total={blocks.length}
                  onChange={(next) => update(i, next)}
                  onMove={(d) => move(i, d)}
                  onRemove={() => setBlocks((p) => p.filter((_, j) => j !== i))}
                />
              ))}
            </div>

            <div className="flex flex-wrap gap-2">
              {(Object.keys(TYPE_LABEL) as BlockType[]).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setBlocks((p) => [...p, emptyBlock(t)])}
                  className="h-9 rounded-xl border border-dashed border-line px-3 text-xs font-semibold text-muted transition hover:border-accent hover:text-accent"
                >
                  + {TYPE_LABEL[t]}
                </button>
              ))}
            </div>
          </>
        )}

        {tab === "source" && (
          <div className="flex flex-col gap-2">
            <p className="text-[11px] text-faint">
              Текст, который вставляли в прошлый раз. Правь его и разбирай заново —
              либо меняй блоки вручную на соседней вкладке.
            </p>
            <textarea
              value={source}
              onChange={(e) => setSource(e.target.value)}
              rows={14}
              placeholder="Исходник не сохранялся — вставь текст правила сюда."
              className={cn(inputCls, "resize-y font-mono text-[12px] leading-relaxed")}
            />
            <button
              type="button"
              onClick={reparse}
              disabled={!source.trim()}
              className="h-10 self-start rounded-xl bg-accent px-4 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
            >
              Разобрать заново
            </button>
          </div>
        )}

        {tab === "preview" && (
          <div className="max-h-[55vh] overflow-y-auto rounded-2xl border border-line p-3">
            <RuleReader
              title={node.name}
              icon={node.icon}
              description={node.description}
              blocks={blocks}
            />
          </div>
        )}

        {error && <p className="text-sm text-rose-500">{error}</p>}

        <div className="flex gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="h-11 flex-1 rounded-xl border border-line text-sm font-semibold text-muted transition hover:bg-surface-2"
          >
            Отмена
          </button>
          <button
            type="button"
            onClick={save}
            disabled={saving || blocks.length === 0}
            className="h-11 flex-1 rounded-xl bg-accent text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
          >
            {saving ? "Сохраняю…" : `Сохранить (${blocks.length})`}
          </button>
        </div>
      </div>
    </Modal>
  );
}
