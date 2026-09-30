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
import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { useT } from "@/components/i18n-provider";
import { fmt } from "@/lib/i18n";
import { hasTranscription } from "@/lib/phrase-words";
import { SpeakPair, useSpeech } from "@/components/materials/speech";
import {
  categoryKey,
  findWords,
  groupWords,
  parseKey,
  wordKey,
  type LessonWord,
} from "@/lib/lesson-unit";
import { IconEye, IconEyeOff, IconSearch } from "@/components/icons";
import { cn } from "@/lib/utils";

export function LessonVocab({
  words,
  highlights,
  focus,
  onPick,
  showBritish = false,
  canReveal = true,
}: {
  words: LessonWord[];
  highlights: Record<string, string>;
  focus?: string | null;
  onPick?: (key: string) => void;
  showBritish?: boolean;
  /** В живом классе ученик видит раскрытие только по решению учителя. */
  canReveal?: boolean;
}) {
  const { t } = useT();
  const speech = useSpeech();

  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string | null>(null);
  /** Что открыто поштучно — поверх общего «показать всё». */
  const [shownTr, setShownTr] = useState<string[]>([]);
  const [shownDesc, setShownDesc] = useState<string[]>([]);
  const [allTr, setAllTr] = useState(false);
  const [allDesc, setAllDesc] = useState(false);
  const focusedCard = useRef<HTMLDivElement>(null);
  const pickTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const groups = useMemo(() => groupWords(words), [words]);
  const categories = useMemo(() => groups.map((g) => g.category), [groups]);

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
  const toggleAllTr = () => {
    setAllTr((v) => !v);
    setShownTr([]);
  };
  const toggleAllDesc = () => {
    setAllDesc((v) => !v);
    setShownDesc([]);
  };

  const trShown = (id: string) => canReveal && allTr !== shownTr.includes(id);
  const descShown = (id: string) => canReveal && allDesc !== shownDesc.includes(id);

  const flip = (list: string[], id: string) =>
    list.includes(id) ? list.filter((x) => x !== id) : [...list, id];

  return (
    <div className="flex h-full flex-col gap-3">
      {/* Шапка: сколько слов и два переключателя видимости. */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[12px] font-semibold text-faint">
          {fmt(t.lessonUnits.words, { n: words.length })}
        </span>

        {canReveal && (
          <span className="ml-auto flex items-center gap-1">
            <Toggle on={allTr} onClick={toggleAllTr} label={t.lessonUnits.showTranslations} />
            <Toggle on={allDesc} onClick={toggleAllDesc} label={t.lessonUnits.showDescriptions} />
          </span>
        )}
      </div>

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
              <h3 className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-faint">
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
                            if (canReveal) setShownTr((p) => flip(p, w.id));
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
                          <span className="text-[13px] text-accent">
                            — {w.translation ?? "—"}
                          </span>
                        ) : canReveal ? (
                          <button
                            type="button"
                            onClick={() => setShownTr((p) => flip(p, w.id))}
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
                          <p className="mt-1 text-[12px] leading-snug text-muted">
                            {w.description}
                          </p>
                        ) : canReveal ? (
                          <button
                            type="button"
                            onClick={() => setShownDesc((p) => flip(p, w.id))}
                            className="mt-1 text-[11px] text-faint transition hover:text-accent"
                          >
                            {t.lessonUnits.revealDescription}
                          </button>
                        ) : (
                          <span className="mt-1 block text-[11px] text-faint">•••</span>
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
  children,
}: {
  on: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "h-7 rounded-lg px-2.5 text-[11px] font-semibold transition",
        on ? "bg-accent text-white" : "bg-surface-2 text-muted hover:text-content",
      )}
    >
      {children}
    </button>
  );
}
