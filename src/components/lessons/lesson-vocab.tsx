"use client";

/**
 * Словник урока.
 *
 * Слова разложены по категориям и внутри каждой стоят по алфавиту —
 * служебные to и артикли в счёт не идут, иначе половина списка
 * собирается на «t» и «a».
 *
 * Перевод и описание закрыты. В этом весь смысл словника на уроке:
 * ученик сначала вспоминает сам, и только потом проверяет себя. Открыть
 * можно всё разом или по одному нажатию на само слово, и закрыть так же.
 */
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useT } from "@/components/i18n-provider";
import { fmt } from "@/lib/i18n";
import { hasTranscription } from "@/lib/phrase-words";
import { SpeakPair, useSpeech } from "@/components/materials/speech";
import { LessonVocabToMaterials } from "@/components/lessons/lesson-vocab-to-materials";
import { categoryColor } from "@/lib/category-color";
import {
  categoryKey,
  emptyLessonVocabularyReveal,
  findWords,
  groupWords,
  parseKey,
  toggleLessonVocabularyReveal,
  toggleAllLessonVocabularyReveal,
  wordKey,
  type LessonVocabularyReveal,
  type LessonWord,
} from "@/lib/lesson-unit";
import { IconEye, IconEyeOff, IconSearch, IconVolume } from "@/components/icons";
import { cn } from "@/lib/utils";
import { translateLessonVocabularyAction } from "@/lib/actions/lessons";

export function LessonVocab({
  words,
  highlights,
  focus,
  onPick,
  showBritish = false,
  showBritishBusy = false,
  onShowBritishChange,
  canReveal = true,
  revealState,
  onRevealStateChange,
  teacher = false,
  unitId,
  lessonTitle,
  defaultStudentId,
}: {
  words: LessonWord[];
  highlights: Record<string, string>;
  focus?: string | null;
  onPick?: (key: string) => void;
  showBritish?: boolean;
  showBritishBusy?: boolean;
  /** Teacher-owned setting for the assigned lesson; students only receive it. */
  onShowBritishChange?: (show: boolean) => void;
  /** В живом классе ученик видит раскрытие только по решению учителя. */
  canReveal?: boolean;
  /** В классе состояние общее: учитель меняет, ученик только наблюдает. */
  revealState?: LessonVocabularyReveal;
  onRevealStateChange?: (next: LessonVocabularyReveal) => void;
  teacher?: boolean;
  unitId?: string;
  lessonTitle?: string;
  defaultStudentId?: string | null;
}) {
  const { t } = useT();
  const router = useRouter();
  const speech = useSpeech();

  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string | null>(null);
  const [localReveal, setLocalReveal] = useState(emptyLessonVocabularyReveal);
  const reveal = revealState ?? localReveal;
  const focusedCard = useRef<HTMLDivElement>(null);
  const pickTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [translationError, setTranslationError] = useState<string | null>(null);
  const [translationBusy, startTranslation] = useTransition();

  const groups = useMemo(() => groupWords(words), [words]);
  const categories = useMemo(() => groups.map((g) => g.category), [groups]);
  const translationLanguage = useMemo(() => {
    const joined = words.map((word) => word.translation ?? "").join(" ");
    return /[іїєґ]/i.test(joined) ? "UK" : "RU";
  }, [words]);

  const visible = useMemo(() => {
    const picked = category
      ? words.filter((w) => categoryKey(w.category) === category)
      : words;
    const found = findWords(picked, query);
    const parsed = focus ? parseKey(focus) : null;
    const focused =
      parsed?.kind === "word" ? words.find((word) => word.id === parsed.phraseId) : null;

    // Локальный поиск ученика не должен прятать слово, на которое прямо
    // сейчас указывает учитель.
    return groupWords(focused && !found.some((word) => word.id === focused.id)
      ? [focused, ...found]
      : found);
  }, [words, category, query, focus]);

  useEffect(() => {
    if (!focus || !focusedCard.current) return;
    focusedCard.current.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [focus]);

  useEffect(() => () => {
    if (pickTimer.current) clearTimeout(pickTimer.current);
  }, []);

  /*
   * Кнопка «показать всё» переключает общий режим и разом забывает
   * поштучные открытия: иначе после двух нажатий не понять, что сейчас
   * открыто, а что нет.
   */
  const updateReveal = (next: LessonVocabularyReveal) => {
    if (revealState) onRevealStateChange?.(next);
    else setLocalReveal(next);
  };
  const toggleReveal = (
    kind: "translation" | "description" | "example" | "note",
    wordId?: string,
  ) =>
    updateReveal(toggleLessonVocabularyReveal(reveal, kind, wordId));

  const trShown = (id: string) =>
    teacher || reveal.allTranslations !== reveal.translations.includes(id);
  const descShown = (id: string) =>
    teacher || reveal.allDescriptions !== reveal.descriptions.includes(id);
  const examplesShown = (id: string) =>
    teacher || reveal.allExamples !== reveal.examples.includes(id);
  const noteShown = (id: string) =>
    teacher || reveal.allNotes !== reveal.notes.includes(id);
  const studentShown = (
    kind: "translation" | "description" | "example" | "note",
    id: string,
  ) => {
    if (kind === "translation") return reveal.allTranslations !== reveal.translations.includes(id);
    if (kind === "description") return reveal.allDescriptions !== reveal.descriptions.includes(id);
    if (kind === "example") return reveal.allExamples !== reveal.examples.includes(id);
    return reveal.allNotes !== reveal.notes.includes(id);
  };

  return (
    <div className="flex h-full flex-col gap-3">
      {/* Шапка: сколько слов и общие переключатели видимости. */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[12px] font-semibold text-faint">
          {fmt(t.lessonUnits.words, { n: words.length })}
        </span>

        {canReveal && (
          <span className="ml-auto flex flex-wrap items-center justify-end gap-1">
            <Toggle on={reveal.allTranslations} onClick={() => toggleReveal("translation")} label={t.lessonUnits.showTranslations} />
            <Toggle on={reveal.allDescriptions} onClick={() => toggleReveal("description")} label={t.lessonUnits.showDescriptions} />
            <Toggle on={reveal.allExamples} onClick={() => toggleReveal("example")} label={t.lessonUnits.vocabExamples} />
            <Toggle on={reveal.allNotes} onClick={() => toggleReveal("note")} label={t.lessonUnits.vocabTips} />
            <Toggle
              on={reveal.allTranslations && reveal.allDescriptions && reveal.allExamples && reveal.allNotes}
              onClick={() => updateReveal(toggleAllLessonVocabularyReveal(reveal))}
              label={reveal.allTranslations && reveal.allDescriptions && reveal.allExamples && reveal.allNotes
                ? t.lessonUnits.vocabHideAll : t.lessonUnits.vocabRevealAll}
            />
            {teacher && onShowBritishChange && (
              <button
                data-no-lesson-highlight
                type="button"
                disabled={showBritishBusy}
                onClick={() => onShowBritishChange(!showBritish)}
                aria-pressed={showBritish}
                className={cn(
                  "flex h-7 shrink-0 items-center gap-1 rounded-lg px-2 text-[11px] font-semibold transition disabled:cursor-wait disabled:opacity-50",
                  showBritish
                    ? "bg-accent text-white"
                    : "bg-surface-2 text-muted hover:text-content",
                )}
              >
                <IconVolume className="h-3.5 w-3.5" />
                {t.lessonUnits.showBritish}
              </button>
            )}
            {teacher && unitId && lessonTitle && (
              <>
                <span className="flex rounded-xl bg-surface-2 p-1 ring-1 ring-line">
                  {(["UK", "RU"] as const).map((language) => (
                    <button
                      key={language}
                      type="button"
                      disabled={translationBusy || language === translationLanguage}
                      onClick={() => {
                        setTranslationError(null);
                        startTranslation(async () => {
                          const result = await translateLessonVocabularyAction(unitId, language);
                          if (result.error) setTranslationError(result.error);
                          else router.refresh();
                        });
                      }}
                      className={cn(
                        "h-7 rounded-lg px-2.5 text-[10px] font-black transition disabled:cursor-default",
                        language === translationLanguage
                          ? "bg-accent text-white"
                          : "text-muted hover:text-content disabled:opacity-45",
                      )}
                      title={`DeepL · ${language === "UK" ? "українська" : "русский"}`}
                    >
                      {language === "UK" ? "UA" : "RU"}
                    </button>
                  ))}
                </span>
                <LessonVocabToMaterials
                  unitId={unitId}
                  lessonTitle={lessonTitle}
                  defaultStudentId={defaultStudentId}
                />
              </>
            )}
          </span>
        )}
      </div>
      {translationError && (
        <p className="rounded-xl bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-600 ring-1 ring-rose-200">
          {translationError}
        </p>
      )}

      <label className="relative flex items-center">
        <IconSearch className="absolute left-3 h-4 w-4 text-faint" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t.lessonUnits.searchWords}
          className="h-10 w-full rounded-xl border border-line bg-surface-2 pl-9 pr-3 text-sm text-content outline-none transition placeholder:text-faint focus:border-accent"
        />
      </label>

      {/* Категории. «Все» первым — к нему возвращаются чаще всего. */}
      {categories.length > 1 && (
        <div className="flex flex-wrap gap-1">
          <Chip on={category === null} onClick={() => setCategory(null)}>
            {t.lessonUnits.allWords}
          </Chip>
          {categories.map((c) => (
            <Chip
              key={c}
              on={category === categoryKey(c)}
              onClick={() => setCategory(categoryKey(c))}
              color={categoryColor(c, groups.find((group) => group.category === c)?.words[0]?.sectionColor)}
            >
              {c}
            </Chip>
          ))}
        </div>
      )}

      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto">
        {visible.length === 0 && (
          <p className="text-sm text-faint">{t.lessonUnits.nothingFound}</p>
        )}

        {visible.map((group) => (
          <section key={group.category}>
            {group.category && !category && (
              <h3 className="mb-1.5 flex items-center gap-2 text-[11px] font-bold uppercase tracking-wide text-faint">
                <span
                  className="h-4 w-1 rounded-full"
                  style={{ backgroundColor: categoryColor(group.category, group.words[0]?.sectionColor) }}
                />
                {group.category}
              </h3>
            )}

            <div className="flex flex-col gap-1.5">
              {group.words.map((w) => {
                const key = wordKey(w.id);
                const mark = highlights[key];
                const single = hasTranscription(w.word);

                return (
                  <div
                    key={w.id}
                    ref={focus === key ? focusedCard : undefined}
                    className={cn(
                      "flex items-start gap-2.5 rounded-xl bg-surface p-2.5 ring-1 ring-line transition",
                      mark && "bg-accent-soft ring-2 ring-accent",
                      focus === key && "ring-2 ring-accent",
                    )}
                  >
                    {w.imageUrl ? (
                      <span className="relative h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-surface-2">
                        <Image src={w.imageUrl} alt="" fill unoptimized className="object-cover" />
                      </span>
                    ) : (
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-surface-2 text-lg">
                        {w.icon ?? "•"}
                      </span>
                    )}

                    <div className="min-w-0 flex-1">
                      <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                        {/*
                         * Нажатие по слову открывает и закрывает перевод.
                         * Учителю то же нажатие подсвечивает — у него для
                         * этого выбран цвет, и открывать ему нечего.
                         */}
                        <button
                          type="button"
                          data-lookup-text={w.word}
                          onClick={(event) => {
                            if (onPick) {
                              // Небольшая пауза отделяет одиночный фокус от
                              // двойного клика для быстрого перевода.
                              if (event.detail > 1) return;
                              if (pickTimer.current) clearTimeout(pickTimer.current);
                              pickTimer.current = setTimeout(() => onPick(key), 240);
                              return;
                            }
                            if (canReveal) toggleReveal("translation", w.id);
                          }}
                          onDoubleClick={() => {
                            if (pickTimer.current) clearTimeout(pickTimer.current);
                            pickTimer.current = null;
                          }}
                          className={cn(
                            "select-text text-left text-[15px] font-bold text-content transition",
                            (onPick || canReveal) && "hover:text-accent",
                          )}
                        >
                          {w.word}
                        </button>

                        <SpeakPair
                          text={w.word}
                          id={w.id}
                          speech={speech}
                          showUk={single && showBritish}
                        />

                        {trShown(w.id) ? (
                          <span className="inline-flex items-center gap-1 text-[13px] text-accent">
                            — {w.translation ?? "—"}
                            {teacher && w.translation && (
                              <RevealOne
                                on={studentShown("translation", w.id)}
                                onClick={() => toggleReveal("translation", w.id)}
                                label="translation"
                              />
                            )}
                          </span>
                        ) : canReveal ? (
                          <button
                            type="button"
                            onClick={() => toggleReveal("translation", w.id)}
                            title={t.lessonUnits.revealOne}
                            className="h-5 rounded bg-surface-2 px-3 text-[11px] text-faint transition hover:text-accent"
                          >
                            ···
                          </button>
                        ) : (
                          <span className="h-5 rounded bg-surface-2 px-3 text-[11px] text-faint">
                            ···
                          </span>
                        )}
                      </p>

                      {single && (w.ipaUs || (showBritish && w.ipaUk)) && (
                        <p className="mt-0.5 font-mono text-[11px] text-faint">
                          {w.ipaUs}
                          {showBritish && w.ipaUk && w.ipaUk !== w.ipaUs
                            ? `${w.ipaUs ? " · " : ""}${w.ipaUk}`
                            : ""}
                        </p>
                      )}

                      {w.description &&
                        (descShown(w.id) ? (
                          <p className="mt-1 flex items-start gap-1 text-[12px] leading-snug text-muted">
                            <span className="flex-1">{w.description}</span>
                            {teacher && (
                              <RevealOne
                                on={studentShown("description", w.id)}
                                onClick={() => toggleReveal("description", w.id)}
                                label="description"
                              />
                            )}
                          </p>
                        ) : canReveal ? (
                          <button
                            type="button"
                            onClick={() => toggleReveal("description", w.id)}
                            className="mt-1 text-[11px] text-faint transition hover:text-accent"
                          >
                            {t.lessonUnits.revealDescription}
                          </button>
                        ) : (
                          <span className="mt-1 block text-[11px] text-faint">•••</span>
                        ))}

                      {w.examples.length > 0 &&
                        (examplesShown(w.id) ? (
                          <div className="mt-2 rounded-xl bg-surface-2 px-3 py-2">
                            <div className="mb-1 flex items-center justify-between gap-2">
                              <span className="text-[10px] font-black uppercase tracking-wide text-accent">{t.lessonUnits.vocabExamples}</span>
                              {teacher && (
                                <RevealOne
                                  on={studentShown("example", w.id)}
                                  onClick={() => toggleReveal("example", w.id)}
                                  label="examples"
                                />
                              )}
                            </div>
                            <ul className="grid gap-1.5">
                              {w.examples.map((example, index) => (
                                <li key={index} className="text-[12px] leading-snug text-content">
                                  <span>{example.en}</span>
                                  {example.tr && <span className="ml-1.5 italic text-muted">— {example.tr}</span>}
                                </li>
                              ))}
                            </ul>
                          </div>
                        ) : canReveal ? (
                          <button
                            type="button"
                            onClick={() => toggleReveal("example", w.id)}
                            className="mt-1.5 text-[11px] text-faint transition hover:text-accent"
                          >
                            {t.lessonUnits.vocabRevealExamples}
                          </button>
                        ) : (
                          <span className="mt-1.5 block text-[11px] text-faint">{t.lessonUnits.vocabExamples}: •••</span>
                        ))}

                      {w.note &&
                        (noteShown(w.id) ? (
                          <div className="mt-2 flex items-start gap-2 rounded-xl bg-amber-400/10 px-3 py-2 text-[12px] leading-snug text-content ring-1 ring-amber-400/25">
                            <span aria-hidden>💡</span>
                            <span className="min-w-0 flex-1 whitespace-pre-line">{w.note}</span>
                            {teacher && (
                              <RevealOne
                                on={studentShown("note", w.id)}
                                onClick={() => toggleReveal("note", w.id)}
                                label="hint"
                              />
                            )}
                          </div>
                        ) : canReveal ? (
                          <button
                            type="button"
                            onClick={() => toggleReveal("note", w.id)}
                            className="mt-1.5 text-[11px] text-faint transition hover:text-accent"
                          >
                            {t.lessonUnits.vocabRevealTips}
                          </button>
                        ) : (
                          <span className="mt-1.5 block text-[11px] text-faint">{t.lessonUnits.vocabTips}: •••</span>
                        ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

function Toggle({
  on,
  onClick,
  label,
}: {
  on: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className={cn(
        "flex h-7 items-center gap-1 rounded-lg px-2 text-[11px] font-semibold transition",
        on ? "bg-accent text-white" : "bg-surface-2 text-muted hover:text-content",
      )}
    >
      {on ? <IconEye className="h-3.5 w-3.5" /> : <IconEyeOff className="h-3.5 w-3.5" />}
      {label}
    </button>
  );
}

function Chip({
  on,
  onClick,
  color,
  children,
}: {
  on: boolean;
  onClick: () => void;
  color?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "h-7 rounded-lg px-2.5 text-[11px] font-semibold transition",
        on
          ? color ? "text-white" : "bg-accent text-white"
          : "bg-surface-2 text-muted hover:text-content",
      )}
      style={on && color ? { backgroundColor: color } : undefined}
    >
      {children}
    </button>
  );
}

function RevealOne({
  on,
  onClick,
  label,
}: {
  on: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={`${on ? "Hide" : "Show"} ${label} for the student`}
      aria-label={`${on ? "Hide" : "Show"} ${label} for the student`}
      className={cn(
        "flex h-5 w-5 shrink-0 items-center justify-center rounded-md transition",
        on ? "bg-accent text-white" : "bg-surface text-faint ring-1 ring-line",
      )}
    >
      {on ? <IconEye className="h-3 w-3" /> : <IconEyeOff className="h-3 w-3" />}
    </button>
  );
}
