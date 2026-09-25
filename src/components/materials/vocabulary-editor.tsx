"use client";

import { useMemo, useState, useTransition } from "react";
import { Modal } from "@/components/modal";
import {
  saveVocabularyEditAction,
  transcribeAction,
  type VocabularyEditInput,
} from "@/lib/actions/materials";
import { parseMaterial, type ParsedPhrase } from "@/lib/materials-parser";
import {
  DraftFields,
  newDraft,
  toInput,
  type Draft,
  type SectionHint,
} from "./phrase-form";
import { IconPicker } from "./icon-picker";
import { PhraseReader, type MaterialPhrase } from "./phrase-reader";
import {
  IconCheck,
  IconChevronDown,
  IconPencil,
  IconPlus,
  IconX,
} from "@/components/icons";
import { cn } from "@/lib/utils";

type EditableItem = Draft & {
  kind: "PHRASE" | "NOTE";
  imageUrl: string | null;
};

type VocabularyNode = {
  id: string;
  name: string;
  icon: string | null;
  imageUrl: string | null;
  description: string | null;
  sourceText: string | null;
  phrases: MaterialPhrase[];
};

const inputCls =
  "h-10 w-full rounded-xl border border-line bg-surface-2 px-3 text-sm text-content outline-none transition placeholder:text-faint focus:border-accent";

function fromStored(phrase: MaterialPhrase): EditableItem {
  return {
    key: phrase.id,
    kind: phrase.kind === "NOTE" ? "NOTE" : "PHRASE",
    imageUrl: phrase.imageUrl,
    section: phrase.section ?? "",
    icon: phrase.icon ?? (phrase.kind === "NOTE" ? "💡" : "💬"),
    phrase: phrase.phrase,
    transcription: phrase.transcription ?? "",
    translation: phrase.translation ?? "",
    examples: phrase.examples.length ? phrase.examples : [{ en: "", tr: "" }],
  };
}

function fromParsed(phrase: ParsedPhrase): EditableItem {
  const draft = newDraft(phrase.section ?? "", phrase.icon ?? (phrase.kind === "NOTE" ? "💡" : "💬"), 1);
  return {
    ...draft,
    kind: phrase.kind,
    imageUrl: null,
    phrase: phrase.phrase,
    transcription: phrase.transcription ?? "",
    translation: phrase.translation,
    examples: phrase.examples.length ? phrase.examples : [{ en: "", tr: "" }],
  };
}

function toPreview(item: EditableItem): MaterialPhrase {
  const clean = toInput(item);
  return {
    id: item.key,
    icon: clean.icon,
    imageUrl: item.imageUrl,
    phrase: clean.phrase,
    transcription: clean.transcription,
    translation: clean.translation || null,
    section: clean.section,
    kind: item.kind,
    examples: clean.examples,
  };
}

function toSave(item: EditableItem): VocabularyEditInput {
  return { ...toInput(item), kind: item.kind, imageUrl: item.imageUrl };
}

export function VocabularyEditor({
  node,
  onClose,
}: {
  node: VocabularyNode | null;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<"entries" | "source" | "preview">("entries");
  const [items, setItems] = useState<EditableItem[]>(() =>
    (node?.phrases ?? []).map(fromStored),
  );
  const [source, setSource] = useState(() => node?.sourceText ?? "");
  const [iconFor, setIconFor] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, startSave] = useTransition();

  const sections = useMemo<SectionHint[]>(() => {
    const seen = new Map<string, string | null>();
    for (const item of items) {
      const name = item.section.trim();
      if (name && !seen.has(name)) seen.set(name, item.icon || null);
    }
    return [...seen].map(([name, icon]) => ({ name, icon }));
  }, [items]);

  if (!node) return null;

  const preview = items.filter((item) => item.phrase.trim()).map(toPreview);

  const update = (key: string, next: EditableItem) =>
    setItems((current) => current.map((item) => (item.key === key ? next : item)));

  async function refreshTranscription(key: string, draft: Draft) {
    const word = draft.phrase.trim();
    if (!word || draft.transcription.trim()) return;

    const ipa = await transcribeAction(word);
    setItems((current) =>
      current.map((item) =>
        item.key === key &&
        item.phrase.trim() === word &&
        !item.transcription.trim()
          ? { ...item, transcription: ipa ?? "" }
          : item,
      ),
    );
  }

  const move = (index: number, delta: number) =>
    setItems((current) => {
      const target = index + delta;
      if (target < 0 || target >= current.length) return current;
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });

  function reparse() {
    setError(null);
    if (!source.trim()) {
      setError("Исходный текст пуст");
      return;
    }
    if (
      items.length > 0 &&
      !confirm("Разобрать исходник заново? Все ручные правки записей пропадут.")
    ) {
      return;
    }

    const parsed = parseMaterial(source, "vocabulary");
    if (parsed.phrases.length === 0) {
      setError(parsed.warnings[0] ?? "Не удалось разобрать исходный текст");
      return;
    }
    setItems(parsed.phrases.map(fromParsed));
    setWarnings(parsed.warnings);
    setIconFor(null);
    setTab("entries");
  }

  function save() {
    setError(null);
    const ready = items.filter((item) => item.phrase.trim());
    if (ready.length === 0) {
      setError("Словарь не может быть пустым");
      return;
    }
    if (ready.length !== items.length) {
      setError("Удали пустые записи или заполни их перед сохранением");
      return;
    }

    startSave(async () => {
      const res = await saveVocabularyEditAction(node!.id, ready.map(toSave), source);
      if (res.error) setError(res.error);
      else onClose();
    });
  }

  const tabCls = (active: boolean) =>
    cn(
      "flex-1 rounded-xl border px-3 py-2 text-sm font-semibold transition",
      active
        ? "border-accent bg-accent-soft text-content"
        : "border-line text-muted hover:bg-surface-2",
    );

  return (
    <Modal
      open
      onClose={onClose}
      wide
      title={`Словарь: ${node.name}`}
      icon={<IconPencil className="h-5 w-5" />}
    >
      <div className="flex flex-col gap-4">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setTab("entries")}
            className={tabCls(tab === "entries")}
          >
            Записи ({items.length})
          </button>
          <button
            type="button"
            onClick={() => setTab("source")}
            className={tabCls(tab === "source")}
          >
            Исходник
          </button>
          <button
            type="button"
            onClick={() => setTab("preview")}
            className={tabCls(tab === "preview")}
          >
            Предпросмотр
          </button>
        </div>

        {tab === "entries" && (
          <>
            <div className="flex max-h-[52vh] flex-col gap-3 overflow-y-auto pr-1">
              {items.length === 0 && (
                <p className="py-8 text-center text-sm text-faint">
                  Записей нет. Добавь их вручную или разбери исходник.
                </p>
              )}

              {items.map((item, index) => (
                <div key={item.key} className="rounded-xl border border-line p-3">
                  <div className="mb-2 flex items-center gap-2">
                    <select
                      value={item.kind}
                      onChange={(event) =>
                        update(item.key, {
                          ...item,
                          kind: event.target.value === "NOTE" ? "NOTE" : "PHRASE",
                          icon:
                            event.target.value === "NOTE" && (!item.icon || item.icon === "💬")
                              ? "💡"
                              : item.icon,
                        })
                      }
                      className="h-8 rounded-lg border border-line bg-surface-2 px-2 text-xs font-semibold text-content outline-none focus:border-accent"
                    >
                      <option value="PHRASE">Слово / фраза</option>
                      <option value="NOTE">Заметка</option>
                    </select>

                    <span className="flex-1 text-right text-[11px] text-faint">
                      {index + 1} из {items.length}
                    </span>
                    <button
                      type="button"
                      onClick={() => move(index, -1)}
                      disabled={index === 0}
                      title="Выше"
                      className="flex h-7 w-7 items-center justify-center rounded-lg text-faint transition hover:bg-surface-2 hover:text-content disabled:opacity-30"
                    >
                      <IconChevronDown className="h-4 w-4 rotate-180" />
                    </button>
                    <button
                      type="button"
                      onClick={() => move(index, 1)}
                      disabled={index === items.length - 1}
                      title="Ниже"
                      className="flex h-7 w-7 items-center justify-center rounded-lg text-faint transition hover:bg-surface-2 hover:text-content disabled:opacity-30"
                    >
                      <IconChevronDown className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setItems((current) => current.filter((entry) => entry.key !== item.key));
                        if (iconFor === item.key) setIconFor(null);
                      }}
                      title="Удалить запись"
                      className="flex h-7 w-7 items-center justify-center rounded-lg text-faint transition hover:bg-surface-2 hover:text-rose-500"
                    >
                      <IconX className="h-4 w-4" />
                    </button>
                  </div>

                  {item.kind === "PHRASE" ? (
                    <DraftFields
                      draft={item}
                      sections={sections}
                      iconActive={iconFor === item.key}
                      onPickIcon={() => setIconFor(iconFor === item.key ? null : item.key)}
                      onChange={(next) => update(item.key, { ...item, ...next })}
                      onWordEntered={(draft) => refreshTranscription(item.key, draft)}
                    />
                  ) : (
                    <div className="flex flex-col gap-2">
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setIconFor(iconFor === item.key ? null : item.key)}
                          className={cn(
                            "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-lg ring-1 ring-line",
                            iconFor === item.key ? "bg-accent-soft ring-accent" : "bg-surface-2",
                          )}
                        >
                          {item.icon || "💡"}
                        </button>
                        <input
                          value={item.section}
                          onChange={(event) => update(item.key, { ...item, section: event.target.value })}
                          placeholder="Категория заметки"
                          className={inputCls}
                        />
                      </div>
                      <textarea
                        value={item.phrase}
                        onChange={(event) => update(item.key, { ...item, phrase: event.target.value })}
                        rows={2}
                        placeholder="Текст заметки"
                        className={cn(inputCls, "h-auto resize-y")}
                      />
                      <textarea
                        value={item.translation}
                        onChange={(event) =>
                          update(item.key, { ...item, translation: event.target.value })
                        }
                        rows={2}
                        placeholder="Дополнительное пояснение"
                        className={cn(inputCls, "h-auto resize-y")}
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() =>
                  setItems((current) => [
                    ...current,
                    {
                      ...newDraft(sections.at(-1)?.name ?? "", sections.at(-1)?.icon ?? "💬"),
                      kind: "PHRASE",
                      imageUrl: null,
                    },
                  ])
                }
                className="flex h-9 items-center gap-2 rounded-xl border border-dashed border-line px-3 text-xs font-semibold text-muted transition hover:border-accent hover:text-accent"
              >
                <IconPlus className="h-4 w-4" /> Слово / фраза
              </button>
              <button
                type="button"
                onClick={() =>
                  setItems((current) => [
                    ...current,
                    { ...newDraft("", "💡", 1), kind: "NOTE", imageUrl: null },
                  ])
                }
                className="flex h-9 items-center gap-2 rounded-xl border border-dashed border-line px-3 text-xs font-semibold text-muted transition hover:border-accent hover:text-accent"
              >
                <IconPlus className="h-4 w-4" /> Заметка
              </button>
            </div>

            {iconFor && (
              <div className="rounded-xl border border-line p-3">
                <p className="mb-1.5 text-sm font-medium text-content">Иконка записи</p>
                <IconPicker
                  value={items.find((item) => item.key === iconFor)?.icon ?? null}
                  onChange={(icon) =>
                    setItems((current) =>
                      current.map((item) => (item.key === iconFor ? { ...item, icon } : item)),
                    )
                  }
                />
              </div>
            )}
          </>
        )}

        {tab === "source" && (
          <div className="flex flex-col gap-2">
            <p className="text-[11px] text-faint">
              Исходный текст, из которого словарь разбирали в прошлый раз. Его можно
              изменить и снова превратить в записи целиком.
            </p>
            <textarea
              value={source}
              onChange={(event) => setSource(event.target.value)}
              rows={15}
              placeholder="Исходник не сохранялся — вставь текст словаря сюда."
              className={cn(inputCls, "h-auto resize-y font-mono text-[12px] leading-relaxed")}
            />
            <button
              type="button"
              onClick={reparse}
              disabled={!source.trim()}
              className="h-10 self-start rounded-xl bg-accent px-4 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
            >
              Разобрать заново
            </button>
            {warnings.length > 0 && (
              <div className="rounded-xl bg-amber-500/10 px-3 py-2 text-xs text-amber-700">
                {warnings.map((warning, index) => (
                  <p key={index}>{warning}</p>
                ))}
              </div>
            )}
          </div>
        )}

        {tab === "preview" && (
          <div className="max-h-[58vh] overflow-y-auto rounded-2xl border border-line p-3">
            {preview.length > 0 ? (
              <PhraseReader
                title={node.name}
                icon={node.icon}
                description={node.description}
                coverImageUrl={node.imageUrl}
                phrases={preview}
              />
            ) : (
              <p className="py-8 text-center text-sm text-faint">Нет записей для просмотра.</p>
            )}
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
            disabled={saving || items.length === 0}
            className="flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-accent text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
          >
            {saving ? (
              "Сохраняю…"
            ) : (
              <>
                <IconCheck className="h-4 w-4" /> Сохранить ({items.length})
              </>
            )}
          </button>
        </div>
      </div>
    </Modal>
  );
}
