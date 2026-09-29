"use client";

/**
 * Урок глазами ученика.
 *
 * Открыт всегда только словник — с него урок и начинается. Остальные
 * секции появляются, когда учитель их откроет: список вкладок растёт по
 * ходу занятия, а не встречает ученика пятью закрытыми дверями.
 *
 * Подсветки приходят из закрепления, а не из урока: у каждого ученика
 * подчёркнуто своё, и заготовка от этого не меняется.
 */
import { useMemo, useState } from "react";
import Image from "next/image";
import { useT } from "@/components/i18n-provider";
import { SpeakPair, useSpeech } from "@/components/materials/speech";
import {
  lineKey,
  lineWordKey,
  lineWords,
  speakerTint,
  speakersOf,
  wordKey,
  type LessonSection,
} from "@/lib/lesson-unit";
import type { LessonView as Lesson } from "@/lib/actions/lessons";
import { cn } from "@/lib/utils";

/** Цвет подсветки — в цвет фона, а не текста: читаемость важнее. */
const MARK: Record<string, string> = {
  red: "bg-rose-500/25 ring-1 ring-rose-500/40",
  amber: "bg-amber-400/30 ring-1 ring-amber-500/40",
  green: "bg-emerald-500/25 ring-1 ring-emerald-500/40",
  sky: "bg-sky-500/25 ring-1 ring-sky-500/40",
  violet: "bg-violet-500/25 ring-1 ring-violet-500/40",
};

export type LessonViewProps = {
  lesson: Lesson;
  /** Какие секции открыты этому ученику. */
  open: LessonSection[];
  highlights: Record<string, string>;
  /** Куда смотреть прямо сейчас — ключ места из lesson-unit. */
  focus?: string | null;
  /** Нажатие по месту: учителю — подсветить, ученику ничего. */
  onPick?: (key: string) => void;
};

export function LessonView({
  lesson,
  open,
  highlights,
  focus,
  onPick,
}: LessonViewProps) {
  const { t } = useT();
  const [tab, setTab] = useState<LessonSection>(open[0] ?? "vocab");

  const LABEL: Record<LessonSection, string> = {
    vocab: t.lessonUnits.secVocab,
    video: t.lessonUnits.secVideo,
    transcript: t.lessonUnits.secTranscript,
    questions: t.lessonUnits.secQuestions,
    homework: t.lessonUnits.secHomework,
  };

  // Закрытую вкладку не оставляем выбранной: секцию могли закрыть.
  const current = open.includes(tab) ? tab : (open[0] ?? "vocab");

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-1 rounded-2xl bg-surface p-1 ring-1 ring-line">
        {open.map((section) => (
          <button
            key={section}
            type="button"
            onClick={() => setTab(section)}
            className={cn(
              "h-9 rounded-xl px-3.5 text-sm font-semibold transition",
              current === section
                ? "bg-accent text-white"
                : "text-muted hover:bg-surface-2 hover:text-content",
            )}
          >
            {LABEL[section]}
          </button>
        ))}
      </div>

      {current === "vocab" && (
        <Vocab
          words={lesson.words}
          highlights={highlights}
          focus={focus}
          onPick={onPick}
        />
      )}
      {current === "video" && <Video lesson={lesson} />}
      {current === "transcript" && (
        <Transcript
          lines={lesson.transcript}
          highlights={highlights}
          focus={focus}
          onPick={onPick}
        />
      )}
      {current === "questions" && <Questions lesson={lesson} />}
      {current === "homework" && <Homework lesson={lesson} />}
    </div>
  );
}

/* ------------------------------------------------------------------ */

function Vocab({
  words,
  highlights,
  focus,
  onPick,
}: {
  words: Lesson["words"];
  highlights: Record<string, string>;
  focus?: string | null;
  onPick?: (key: string) => void;
}) {
  const speech = useSpeech();

  /* По категориям словника: Nouns, Adjectives, Idioms — как их собрали. */
  const groups = useMemo(() => {
    const map = new Map<string, Lesson["words"]>();
    for (const w of words) {
      const key = w.category ?? "";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(w);
    }
    return [...map.entries()];
  }, [words]);

  return (
    <div className="flex flex-col gap-5">
      {groups.map(([category, list]) => (
        <section key={category}>
          {category && (
            <h3 className="mb-2 text-[11px] font-bold uppercase tracking-wide text-faint">
              {category}
            </h3>
          )}

          <div className="flex flex-col gap-2">
            {list.map((w) => {
              const key = wordKey(w.phraseId);
              const mark = highlights[key];

              return (
                <div
                  key={w.phraseId}
                  onClick={onPick ? () => onPick(key) : undefined}
                  className={cn(
                    "flex items-start gap-3 rounded-2xl bg-surface p-3 ring-1 ring-line transition",
                    onPick && "cursor-pointer hover:ring-accent",
                    mark && MARK[mark],
                    focus === key && "ring-2 ring-accent",
                  )}
                >
                  {w.imageUrl ? (
                    <span className="relative h-11 w-11 shrink-0 overflow-hidden rounded-xl bg-surface-2">
                      <Image src={w.imageUrl} alt="" fill unoptimized className="object-cover" />
                    </span>
                  ) : (
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-surface-2 text-xl">
                      {w.icon ?? "•"}
                    </span>
                  )}

                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                      <span className="text-base font-bold text-content">{w.word}</span>

                      <span onClick={(e) => e.stopPropagation()}>
                        <SpeakPair text={w.word} id={w.phraseId} speech={speech} />
                      </span>

                      {w.translation && (
                        <span className="text-sm text-accent">— {w.translation}</span>
                      )}
                    </p>

                    {(w.transcriptionUs || w.transcriptionUk) && (
                      <p className="mt-0.5 font-mono text-[11px] text-faint">
                        {w.transcriptionUs}
                        {w.transcriptionUs && w.transcriptionUk ? " · " : ""}
                        {w.transcriptionUk}
                      </p>
                    )}

                    {w.description && (
                      <p className="mt-1 text-[13px] leading-snug text-muted">
                        {w.description}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}

/** Ссылка на YouTube — во встраиваемый вид; остальное отдаём как есть. */
function embedUrl(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.hostname === "youtu.be") return `https://www.youtube.com/embed${u.pathname}`;
    if (u.hostname.endsWith("youtube.com")) {
      const id = u.searchParams.get("v");
      if (id) return `https://www.youtube.com/embed/${id}`;
      if (u.pathname.startsWith("/embed/")) return u.toString();
    }
    return null;
  } catch {
    return null;
  }
}

function Video({ lesson }: { lesson: Lesson }) {
  const { t } = useT();
  const src = lesson.videoUrl ? embedUrl(lesson.videoUrl) : null;

  if (!lesson.videoUrl) {
    return <p className="text-sm text-faint">{t.lessonUnits.empty}</p>;
  }

  return (
    <section className="overflow-hidden rounded-2xl bg-surface ring-1 ring-line">
      {lesson.videoTitle && (
        <p className="border-b border-line px-4 py-2.5 text-sm font-semibold text-content">
          {lesson.videoTitle}
        </p>
      )}

      {src ? (
        <iframe
          src={src}
          title={lesson.videoTitle ?? "video"}
          allowFullScreen
          allow="accelerometer; clipboard-write; encrypted-media; picture-in-picture"
          className="aspect-video w-full border-0"
        />
      ) : (
        /* Не YouTube — отдаём ссылкой: чужой плеер в iframe может и не открыться. */
        <a
          href={lesson.videoUrl}
          target="_blank"
          rel="noreferrer"
          className="block px-4 py-6 text-sm font-semibold text-accent underline"
        >
          {lesson.videoUrl}
        </a>
      )}
    </section>
  );
}

function Transcript({
  lines,
  highlights,
  focus,
  onPick,
}: {
  lines: Lesson["transcript"];
  highlights: Record<string, string>;
  focus?: string | null;
  onPick?: (key: string) => void;
}) {
  const { t } = useT();
  const speakers = useMemo(() => speakersOf(lines), [lines]);

  if (lines.length === 0) {
    return <p className="text-sm text-faint">{t.lessonUnits.empty}</p>;
  }

  return (
    <div className="flex flex-col gap-2">
      {lines.map((line, i) => {
        const key = lineKey(i);
        const mark = highlights[key];

        return (
          <div
            key={i}
            className={cn(
              "rounded-2xl bg-surface p-3 ring-1 ring-line transition",
              mark && MARK[mark],
              focus === key && "ring-2 ring-accent",
            )}
          >
            <span
              onClick={onPick ? () => onPick(key) : undefined}
              className={cn(
                "mr-2 inline-block rounded-md px-1.5 py-0.5 text-[11px] font-bold",
                speakerTint(speakers, line.speaker),
                onPick && "cursor-pointer",
              )}
            >
              {line.speaker || "—"}
            </span>

            {/* По слову: подсветить можно и отдельное слово реплики. */}
            <span className="text-[14px] leading-relaxed text-content">
              {lineWords(line.text).map((part, at) => {
                if (!part.trim()) return <span key={at}>{part}</span>;
                const wKey = lineWordKey(i, at);
                const wMark = highlights[wKey];
                return (
                  <span
                    key={at}
                    onClick={onPick ? () => onPick(wKey) : undefined}
                    className={cn(
                      "rounded px-0.5",
                      onPick && "cursor-pointer hover:bg-accent-soft",
                      wMark && MARK[wMark],
                      focus === wKey && "ring-2 ring-accent",
                    )}
                  >
                    {part}
                  </span>
                );
              })}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function Questions({ lesson }: { lesson: Lesson }) {
  const { t } = useT();
  const blocks: [string, string[]][] = [
    [t.lessonUnits.afterVideo, lesson.questions.afterVideo],
    [t.lessonUnits.afterReading, lesson.questions.afterReading],
  ];

  return (
    <div className="flex flex-col gap-4">
      {blocks.map(([label, list]) =>
        list.length === 0 ? null : (
          <section key={label} className="rounded-2xl bg-surface p-4 ring-1 ring-line">
            <h3 className="mb-2 text-[11px] font-bold uppercase tracking-wide text-faint">
              {label}
            </h3>
            <ol className="flex list-decimal flex-col gap-1.5 pl-5">
              {list.map((q, i) => (
                <li key={i} className="text-[14px] leading-snug text-content">
                  {q}
                </li>
              ))}
            </ol>
          </section>
        ),
      )}
    </div>
  );
}

function Homework({ lesson }: { lesson: Lesson }) {
  const { t } = useT();

  if (lesson.homework.length === 0) {
    return <p className="text-sm text-faint">{t.lessonUnits.empty}</p>;
  }

  return (
    <div className="flex flex-col gap-2.5">
      {lesson.homework.map((task, i) => (
        <section key={i} className="rounded-2xl bg-surface p-4 ring-1 ring-line">
          {task.title && (
            <p className="text-sm font-bold text-content">{task.title}</p>
          )}
          {task.text && (
            <p className="mt-1 whitespace-pre-wrap text-[14px] leading-relaxed text-muted">
              {task.text}
            </p>
          )}
        </section>
      ))}
    </div>
  );
}
