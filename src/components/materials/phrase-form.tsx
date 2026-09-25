"use client";

import { useRef, useState, useTransition } from "react";
import { Modal } from "@/components/modal";
import { IconPicker } from "./icon-picker";
import { parseMaterial } from "@/lib/materials-parser";
import {
  addPhrasesAction,
  updatePhraseAction,
  deletePhraseAction,
  transcribeAction,
  translateVocabularyDraftAction,
  type PhraseInput,
} from "@/lib/actions/materials";
import { IconPlus, IconPencil, IconX, IconCheck } from "@/components/icons";
import { suggestVocabularyIcon } from "@/lib/icon-suggest";
import { cn } from "@/lib/utils";

const inputCls =
  "h-10 w-full rounded-xl border border-line bg-surface-2 px-3 text-sm text-content outline-none transition placeholder:text-faint focus:border-accent";

export type Example = { en: string; tr: string };

export type Draft = {
  key: string;
  section: string;
  icon: string;
  phrase: string;
  transcription: string;
  translation: string;
  examples: Example[];
};

let seq = 0;
export const newDraft = (section = "", icon = "💬", examples = 0): Draft => ({
  key: `d${seq++}`,
  section,
  icon,
  phrase: "",
  transcription: "",
  translation: "",
  examples: Array.from({ length: examples }, () => ({ en: "", tr: "" })),
});

export const toInput = (d: Draft): PhraseInput => ({
  section: d.section.trim() || null,
  icon: d.icon || null,
  phrase: d.phrase.trim(),
  transcription: d.transcription.trim() || null,
  translation: d.translation.trim(),
  examples: d.examples.filter((e) => e.en.trim()),
});

/** Раздел страницы и иконка, которой помечены его записи. */
export type SectionHint = { name: string; icon: string | null };

/** Поля одной записи: тип речи, слово, транскрипция, перевод и примеры. */
export function DraftFields({
  draft,
  sections,
  onChange,
  onPickIcon,
  iconActive,
  onWordEntered,
  onTranslationRequested,
}: {
  draft: Draft;
  sections: SectionHint[];
  /** Слово введено — можно подтянуть транскрипцию и иконку. */
  onWordEntered?: (draft: Draft) => void;
  /** Английский текст изменён — можно пересчитать контекстный перевод. */
  onTranslationRequested?: (draft: Draft) => void;
  onChange: (next: Draft) => void;
  onPickIcon: () => void;
  iconActive: boolean;
}) {
  const set = (patch: Partial<Draft>) => onChange({ ...draft, ...patch });

  const setExample = (i: number, patch: Partial<Example>) =>
    set({ examples: draft.examples.map((e, j) => (j === i ? { ...e, ...patch } : e)) });

  return (
    <div className="flex flex-col gap-2.5 rounded-xl border border-line p-3">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onPickIcon}
          title="Иконка записи"
          className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-lg transition",
            iconActive ? "bg-accent-soft ring-2 ring-accent" : "bg-surface-2 ring-1 ring-line",
          )}
        >
          {draft.icon || "—"}
        </button>

        <input
          value={draft.section}
          onChange={(e) =>
            set({
              section: e.target.value,
              translation:
                e.target.value === draft.section ? draft.translation : "",
            })
          }
          onBlur={(e) =>
            onTranslationRequested?.({
              ...draft,
              section: e.currentTarget.value,
              translation:
                e.currentTarget.value === draft.section ? draft.translation : "",
            })
          }
          list="phrase-sections"
          placeholder="Тип речи — Nouns, Verbs…"
          className={inputCls}
        />
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          value={draft.phrase}
          onChange={(e) =>
            set({
              phrase: e.target.value,
              // Транскрипция относится к конкретному английскому тексту.
              // После его изменения старое значение уже недостоверно.
              transcription:
                e.target.value === draft.phrase ? draft.transcription : "",
              translation:
                e.target.value === draft.phrase ? draft.translation : "",
            })
          }
          onBlur={(e) => {
            const next = {
              ...draft,
              phrase: e.currentTarget.value,
              transcription:
                e.currentTarget.value === draft.phrase ? draft.transcription : "",
              translation:
                e.currentTarget.value === draft.phrase ? draft.translation : "",
            };
            onWordEntered?.(next);
            onTranslationRequested?.(next);
          }}
          placeholder="Слово или фраза"
          className={cn(inputCls, "sm:flex-[2]")}
        />
        <input
          value={draft.transcription}
          onChange={(e) => set({ transcription: e.target.value })}
          placeholder="/ˈtrænskrɪpʃən/"
          className={cn(inputCls, "font-mono sm:flex-1")}
        />
      </div>

      <input
        value={draft.translation}
        onChange={(e) => set({ translation: e.target.value })}
        placeholder="Перевод"
        className={inputCls}
      />

      <div className="flex flex-col gap-2">
        {draft.examples.map((ex, i) => (
          <div key={i} className="flex items-start gap-2">
            <span className="mt-3 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
            <div className="flex min-w-0 flex-1 flex-col gap-1.5 sm:flex-row">
              <input
                value={ex.en}
                onChange={(e) =>
                  set({
                    translation:
                      e.target.value === ex.en ? draft.translation : "",
                    examples: draft.examples.map((example, index) =>
                      index === i
                        ? {
                            ...example,
                            en: e.target.value,
                            tr: e.target.value === ex.en ? ex.tr : "",
                          }
                        : example,
                    ),
                  })
                }
                onBlur={(e) => {
                  const examples = draft.examples.map((example, index) =>
                    index === i
                      ? {
                          ...example,
                          en: e.currentTarget.value,
                          tr: e.currentTarget.value === ex.en ? ex.tr : "",
                        }
                      : example,
                  );
                  onTranslationRequested?.({
                    ...draft,
                    translation:
                      e.currentTarget.value === ex.en ? draft.translation : "",
                    examples,
                  });
                }}
                placeholder={`Пример ${i + 1} — на английском`}
                className={cn(inputCls, "h-9 sm:flex-1")}
              />
              <input
                value={ex.tr}
                onChange={(e) => setExample(i, { tr: e.target.value })}
                placeholder="перевод примера"
                className={cn(inputCls, "h-9 sm:flex-1")}
              />
            </div>
            <button
              type="button"
              onClick={() =>
                set({ examples: draft.examples.filter((_, j) => j !== i) })
              }
              title="Убрать пример"
              className="mt-0.5 flex h-9 w-8 shrink-0 items-center justify-center rounded-lg text-faint transition hover:bg-surface-2 hover:text-content"
            >
              <IconX className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() => set({ examples: [...draft.examples, { en: "", tr: "" }] })}
          className="self-start text-xs font-semibold text-accent transition hover:opacity-80"
        >
          + ещё пример
        </button>
      </div>

      <datalist id="phrase-sections">
        {sections.map((s) => (
          <option key={s.name} value={s.name} />
        ))}
      </datalist>
    </div>
  );
}

export const englishDraftKey = (draft: Draft) =>
  JSON.stringify({
    phrase: draft.phrase.trim(),
    section: draft.section.trim(),
    examples: draft.examples.map((example) => example.en.trim()),
  });

export function mergeAutomaticTranslation(
  current: Draft,
  requested: Draft,
  result: { translation: string | null; examples: string[] },
): Draft {
  if (englishDraftKey(current) !== englishDraftKey(requested)) return current;

  let translatedExample = 0;
  return {
    ...current,
    translation: current.translation.trim()
      ? current.translation
      : (result.translation ?? ""),
    examples: current.examples.map((example) => {
      if (!example.en.trim()) return example;
      const translated = result.examples[translatedExample++] ?? "";
      return example.tr.trim() ? example : { ...example, tr: translated };
    }),
  };
}

// ---------------------------------------------------------------- добавление

/**
 * Дополнить словник: либо разобрать текст целиком, либо завести слова руками.
 * Добавленное встаёт в свой раздел по алфавиту — этим занимается сервер.
 */
export function WordAdder({
  node,
  sections,
  onClose,
}: {
  node: { id: string; name: string; translationLang: "RU" | "UK" } | null;
  sections: SectionHint[];
  onClose: () => void;
}) {
  const iconOf = (section: string) =>
    sections.find((s) => s.name === section)?.icon ?? null;

  const [tab, setTab] = useState<"form" | "text">("form");
  const [drafts, setDrafts] = useState<Draft[]>(() => [
    newDraft(sections[0]?.name ?? "", sections[0]?.icon ?? "💬"),
  ]);
  const [iconFor, setIconFor] = useState<string | null>(null);
  const manualIconKeys = useRef(new Set<string>());
  const [raw, setRaw] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, startSave] = useTransition();

  if (!node) return null;

  const parsed = tab === "text" && raw.trim() ? parseMaterial(raw, "vocabulary") : null;
  const ready =
    tab === "form"
      ? drafts.filter((d) => d.phrase.trim()).length
      : parsed?.phrases.length ?? 0;

  /**
   * Дополняем запись после ввода слова: транскрипция из словаря,
   * иконка по смыслу. Уже заполненное не трогаем.
   */
  async function fillFromWord(d: Draft) {
    const word = d.phrase.trim();
    if (!word) return;

    const patch: Partial<Draft> = {};
    const sectionIcon = iconOf(d.section) ?? "💬";
    if (
      !manualIconKeys.current.has(d.key) &&
      (!d.icon || d.icon === "💬" || d.icon === sectionIcon)
    ) {
      const icon = suggestVocabularyIcon(word, d.translation, d.section, d.examples);
      if (icon) patch.icon = icon;
    }
    if (!d.transcription.trim()) {
      const ipa = await transcribeAction(word);
      if (ipa) patch.transcription = ipa;
    }
    if (Object.keys(patch).length === 0) return;

    setDrafts((p) =>
      p.map((x) =>
        x.key === d.key && x.phrase.trim() === word ? { ...x, ...patch } : x,
      ),
    );
  }

  async function fillTranslation(d: Draft) {
    if (!d.phrase.trim()) return;
    const needsTranslation =
      !d.translation.trim() ||
      d.examples.some((example) => example.en.trim() && !example.tr.trim());
    if (!needsTranslation) return;

    const result = await translateVocabularyDraftAction(d, node!.translationLang);
    if (result.error) setError(result.error);
    setDrafts((current) =>
      current.map((item) =>
        item.key === d.key
          ? (() => {
              const merged = mergeAutomaticTranslation(item, d, result);
              if (manualIconKeys.current.has(item.key)) return merged;
              const icon = suggestVocabularyIcon(
                merged.phrase,
                merged.translation,
                merged.section,
                merged.examples,
              );
              return icon ? { ...merged, icon } : merged;
            })()
          : item,
      ),
    );
  }

  function save() {
    setError(null);
    const items: PhraseInput[] =
      tab === "form"
        ? drafts.filter((d) => d.phrase.trim()).map(toInput)
        : (parsed?.phrases ?? []).map((p) => ({
            section: p.section,
            icon: p.icon,
            phrase: p.phrase,
            transcription: p.transcription,
            translation: p.translation,
            examples: p.examples,
          }));

    startSave(async () => {
      const res = await addPhrasesAction(node!.id, items);
      if (res.error) setError(res.error);
      else onClose();
    });
  }

  const tabCls = (active: boolean) =>
    cn(
      "flex-1 rounded-xl border p-2.5 text-left transition",
      active ? "border-accent bg-accent-soft" : "border-line hover:bg-surface-2",
    );

  return (
    <Modal
      open
      onClose={onClose}
      wide
      title={`Дополнить: ${node.name}`}
      icon={<IconPlus className="h-5 w-5" />}
    >
      <div className="flex flex-col gap-4">
        <div className="flex gap-2">
          <button type="button" onClick={() => setTab("form")} className={tabCls(tab === "form")}>
            <span className="block text-sm font-semibold text-content">Слово или фраза</span>
            <span className="mt-0.5 block text-[11px] text-muted">заполнить поля вручную</span>
          </button>
          <button type="button" onClick={() => setTab("text")} className={tabCls(tab === "text")}>
            <span className="block text-sm font-semibold text-content">Разобрать текст</span>
            <span className="mt-0.5 block text-[11px] text-muted">строками или таблицей</span>
          </button>
        </div>

        {tab === "form" && (
          <>
            <div className="flex max-h-[45vh] flex-col gap-2.5 overflow-y-auto pr-1">
              {drafts.map((d, i) => (
                <div key={d.key} className="relative">
                  {drafts.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setDrafts((p) => p.filter((x) => x.key !== d.key))}
                      title="Убрать запись"
                      className="absolute -top-1 right-1 z-10 flex h-7 w-7 items-center justify-center rounded-lg bg-surface text-faint ring-1 ring-line transition hover:text-rose-500"
                    >
                      <IconX className="h-3.5 w-3.5" />
                    </button>
                  )}
                  <p className="mb-1 px-1 text-[11px] font-semibold uppercase tracking-wide text-faint">
                    Запись {i + 1}
                  </p>
                  <DraftFields
                    draft={d}
                    sections={sections}
                    iconActive={iconFor === d.key}
                    onWordEntered={fillFromWord}
                    onTranslationRequested={fillTranslation}
                    onPickIcon={() => setIconFor(iconFor === d.key ? null : d.key)}
                    onChange={(next) =>
                      setDrafts((p) =>
                        p.map((x) => {
                          if (x.key !== d.key) return x;
                          // Сменили раздел — подставляем его иконку,
                          // чтобы запись не выбивалась из своей группы.
                          if (next.section !== x.section) {
                            const icon = iconOf(next.section);
                            if (icon) return { ...next, icon };
                          }
                          return next;
                        }),
                      )
                    }
                  />
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={() =>
                setDrafts((p) => {
                  const prev = p[p.length - 1];
                  return [...p, newDraft(prev?.section ?? "", prev?.icon ?? "💬")];
                })
              }
              className="flex h-10 items-center justify-center gap-2 rounded-xl border border-dashed border-line text-sm font-semibold text-muted transition hover:border-accent hover:text-accent"
            >
              <IconPlus className="h-4 w-4" /> Ещё запись
            </button>

            {iconFor && (
              <div className="rounded-xl border border-line p-3">
                <p className="mb-1.5 text-sm font-medium text-content">Иконка записи</p>
                <IconPicker
                  value={drafts.find((d) => d.key === iconFor)?.icon ?? null}
                  onChange={(icon) => {
                    manualIconKeys.current.add(iconFor);
                    setDrafts((p) =>
                      p.map((x) => (x.key === iconFor ? { ...x, icon } : x)),
                    );
                  }}
                />
              </div>
            )}
          </>
        )}

        {tab === "text" && (
          <div>
            <textarea
              value={raw}
              onChange={(e) => setRaw(e.target.value)}
              rows={8}
              placeholder={"a hunch /hʌntʃ/ — передчуття\n• I had a hunch. — У мене було передчуття."}
              className="w-full resize-y rounded-xl border border-line bg-surface-2 px-3.5 py-3 font-mono text-[13px] leading-relaxed text-content outline-none transition placeholder:text-faint focus:border-accent"
            />
            {parsed && (
              <p className="mt-1.5 text-[11px] text-faint">
                Разобрано записей: {parsed.phrases.length}
                {parsed.warnings.length ? `, предупреждений: ${parsed.warnings.length}` : ""}
              </p>
            )}
          </div>
        )}

        <p className="text-[11px] text-faint">
          Добавленное встанет в свой раздел по алфавиту. Уже существующие записи не тронутся.
        </p>

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
            disabled={saving || ready === 0}
            className="h-11 flex-1 rounded-xl bg-accent text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
          >
            {saving ? "Добавляю…" : `Добавить (${ready})`}
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------- правка

/** Правка или удаление одной записи словника. */
export function PhraseEditor({
  phrase,
  sections,
  translationLang,
  onClose,
}: {
  phrase:
    | {
        id: string;
        section: string | null;
        icon: string | null;
        phrase: string;
        transcription: string | null;
        translation: string | null;
        examples: Example[];
      }
    | null;
  sections: SectionHint[];
  translationLang: "RU" | "UK";
  onClose: () => void;
}) {
  const [draft, setDraft] = useState<Draft | null>(() =>
    phrase
      ? {
          key: phrase.id,
          section: phrase.section ?? "",
          icon: phrase.icon ?? "💬",
          phrase: phrase.phrase,
          transcription: phrase.transcription ?? "",
          translation: phrase.translation ?? "",
          examples: phrase.examples.map((example) => ({ ...example })),
        }
      : null,
  );
  const [showIcons, setShowIcons] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, startSave] = useTransition();

  if (!phrase || !draft) return null;

  function save() {
    setError(null);
    startSave(async () => {
      const res = await updatePhraseAction(phrase!.id, toInput(draft!));
      if (res.error) setError(res.error);
      else onClose();
    });
  }

  function remove() {
    if (!confirm(`Удалить «${phrase!.phrase}»? Это необратимо.`)) return;
    startSave(async () => {
      const res = await deletePhraseAction(phrase!.id);
      if (res.error) setError(res.error);
      else onClose();
    });
  }

  async function refreshTranscription(d: Draft) {
    const word = d.phrase.trim();
    if (!word || d.transcription.trim()) return;

    const ipa = await transcribeAction(word);
    setDraft((current) =>
      current &&
      current.key === d.key &&
      current.phrase.trim() === word &&
      !current.transcription.trim()
        ? { ...current, transcription: ipa ?? "" }
        : current,
    );
  }

  async function refreshTranslation(d: Draft) {
    if (!d.phrase.trim()) return;
    const needsTranslation =
      !d.translation.trim() ||
      d.examples.some((example) => example.en.trim() && !example.tr.trim());
    if (!needsTranslation) return;

    const result = await translateVocabularyDraftAction(d, translationLang);
    if (result.error) setError(result.error);
    setDraft((current) =>
      current ? mergeAutomaticTranslation(current, d, result) : current,
    );
  }

  return (
    <Modal
      open
      onClose={onClose}
      wide
      title={`Запись: ${phrase.phrase}`}
      icon={<IconPencil className="h-5 w-5" />}
    >
      <div className="flex flex-col gap-4">
        <DraftFields
          draft={draft}
          sections={sections}
          iconActive={showIcons}
          onPickIcon={() => setShowIcons((v) => !v)}
          onChange={setDraft}
          onWordEntered={refreshTranscription}
          onTranslationRequested={refreshTranslation}
        />

        {showIcons && (
          <div className="rounded-xl border border-line p-3">
            <IconPicker
              value={draft.icon}
              onChange={(icon) => setDraft({ ...draft, icon })}
            />
          </div>
        )}

        {error && <p className="text-sm text-rose-500">{error}</p>}

        <div className="flex flex-wrap gap-2.5">
          <button
            type="button"
            onClick={remove}
            disabled={saving}
            className="h-11 rounded-xl border border-line px-4 text-sm font-semibold text-rose-500 transition hover:bg-surface-2 disabled:opacity-50"
          >
            Удалить запись
          </button>
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
            disabled={saving || !draft.phrase.trim()}
            className="flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-accent text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
          >
            {saving ? "Сохраняю…" : (<><IconCheck className="h-4 w-4" /> Сохранить</>)}
          </button>
        </div>
      </div>
    </Modal>
  );
}
