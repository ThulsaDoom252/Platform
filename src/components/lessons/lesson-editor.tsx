"use client";

/**
 * Сборка урока-активности.
 *
 * Пять секций, и каждая правится на месте: урок редко собирается за
 * один присест, возвращаться к нему приходится по частям.
 *
 * Словник выбирается из материалов, а не набирается заново: слова там
 * уже с транскрипциями, описаниями и картинками, и вторая их копия
 * разошлась бы с первой на первой же правке.
 *
 * Расшифровка вставляется текстом — в том виде, в каком расшифровки и
 * пишут. Разбор на реплики живёт в lesson-unit.ts и покрыт тестами:
 * ломается он молча, а замечается на уроке.
 */
import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useT } from "@/components/i18n-provider";
import { fmt } from "@/lib/i18n";
import { saveLessonAction, type LessonView } from "@/lib/actions/lessons";
import { parseTranscript, speakerTint, speakersOf } from "@/lib/lesson-unit";
import {
  IconChevronLeft,
  IconPlus,
  IconTrash,
  IconVolume,
} from "@/components/icons";
import { cn } from "@/lib/utils";

const inputCls =
  "h-11 w-full rounded-xl border border-line bg-surface-2 px-3.5 text-sm text-content outline-none transition placeholder:text-faint focus:border-accent";
const areaCls =
  "min-h-32 w-full rounded-xl border border-line bg-surface-2 px-3.5 py-2.5 text-sm leading-relaxed text-content outline-none transition placeholder:text-faint focus:border-accent";

export function LessonEditor({
  lesson,
  vocabs,
}: {
  lesson: LessonView;
  vocabs: { id: string; name: string; scope: string; words: number }[];
}) {
  const { t } = useT();

  const [title, setTitle] = useState(lesson.title);
  const [vocabNodeId, setVocabNodeId] = useState(lesson.vocabNodeId ?? "");
  const [videoUrl, setVideoUrl] = useState(lesson.videoUrl ?? "");
  const [videoTitle, setVideoTitle] = useState(lesson.videoTitle ?? "");
  const [transcriptText, setTranscriptText] = useState(
    lesson.transcript.map((l) => `${l.speaker}: ${l.text}`).join("\n"),
  );
  const [afterVideo, setAfterVideo] = useState(lesson.questions.afterVideo.join("\n"));
  const [afterReading, setAfterReading] = useState(
    lesson.questions.afterReading.join("\n"),
  );
  const [homework, setHomework] = useState(lesson.homework);
  const [saved, setSaved] = useState(false);
  const [busy, startBusy] = useTransition();

  /* Разбор идёт на лету: что получилось из вставленного, видно сразу. */
  const lines = useMemo(() => parseTranscript(transcriptText), [transcriptText]);
  const speakers = useMemo(() => speakersOf(lines), [lines]);

  function save() {
    setSaved(false);
    startBusy(async () => {
      await saveLessonAction(lesson.id, {
        title,
        vocabNodeId: vocabNodeId || null,
        videoUrl,
        videoTitle,
        transcriptText,
        afterVideo: afterVideo.split("\n"),
        afterReading: afterReading.split("\n"),
        homework,
      });
      setSaved(true);
    });
  }

  return (
    <div className="flex flex-col gap-5">
      <Link
        href="/teacher/lessons"
        className="flex w-fit items-center gap-1 text-[13px] font-semibold text-muted transition hover:text-accent"
      >
        <IconChevronLeft className="h-4 w-4" />
        {t.lessonUnits.title}
      </Link>

      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        className="w-full rounded-xl bg-transparent text-2xl font-bold text-content outline-none"
      />

      {/* Словник */}
      <Section title={t.lessonUnits.secVocab}>
        {vocabs.length === 0 ? (
          <p className="text-sm text-faint">{t.lessonUnits.noVocab}</p>
        ) : (
          <select
            value={vocabNodeId}
            onChange={(e) => setVocabNodeId(e.target.value)}
            className={inputCls}
          >
            <option value="">— {t.lessonUnits.pickVocab} —</option>
            {vocabs.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name} · {fmt(t.lessonUnits.words, { n: v.words })}
                {v.scope === "PERSONAL" ? " · " + t.materials.mine : ""}
              </option>
            ))}
          </select>
        )}

        {lesson.words.length > 0 && vocabNodeId === lesson.vocabNodeId && (
          <VocabPreview words={lesson.words} />
        )}
      </Section>

      {/* Видео */}
      <Section title={t.lessonUnits.secVideo}>
        <input
          value={videoUrl}
          onChange={(e) => setVideoUrl(e.target.value)}
          placeholder={t.lessonUnits.videoLink}
          className={inputCls}
        />
        <input
          value={videoTitle}
          onChange={(e) => setVideoTitle(e.target.value)}
          placeholder={t.lessonUnits.videoName}
          className={`${inputCls} mt-2`}
        />
      </Section>

      {/* Расшифровка */}
      <Section title={t.lessonUnits.secTranscript} hint={t.lessonUnits.transcriptHint}>
        <textarea
          value={transcriptText}
          onChange={(e) => setTranscriptText(e.target.value)}
          className={areaCls}
        />

        {lines.length > 0 && (
          <div className="mt-3 flex flex-col gap-1.5">
            {lines.map((line, i) => (
              <p key={i} className="flex flex-wrap items-baseline gap-2">
                <span
                  className={cn(
                    "shrink-0 rounded-md px-1.5 py-0.5 text-[11px] font-bold",
                    speakerTint(speakers, line.speaker),
                  )}
                >
                  {line.speaker || "—"}
                </span>
                <span className="text-[13px] text-content">{line.text}</span>
              </p>
            ))}
          </div>
        )}
      </Section>

      {/* Вопросы */}
      <Section title={t.lessonUnits.secQuestions} hint={t.lessonUnits.questionHint}>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="text-[12px] font-semibold text-muted">
              {t.lessonUnits.afterVideo}
            </span>
            <textarea
              value={afterVideo}
              onChange={(e) => setAfterVideo(e.target.value)}
              className={`${areaCls} mt-1.5`}
            />
          </label>
          <label className="block">
            <span className="text-[12px] font-semibold text-muted">
              {t.lessonUnits.afterReading}
            </span>
            <textarea
              value={afterReading}
              onChange={(e) => setAfterReading(e.target.value)}
              className={`${areaCls} mt-1.5`}
            />
          </label>
        </div>
      </Section>

      {/* Домашка */}
      <Section title={t.lessonUnits.secHomework}>
        <div className="flex flex-col gap-2.5">
          {homework.map((task, i) => (
            <div key={i} className="flex items-start gap-2 rounded-xl bg-surface-2 p-2.5">
              <div className="min-w-0 flex-1">
                <input
                  value={task.title}
                  onChange={(e) =>
                    setHomework((prev) =>
                      prev.map((x, k) => (k === i ? { ...x, title: e.target.value } : x)),
                    )
                  }
                  placeholder={t.lessonUnits.taskTitle}
                  className="h-9 w-full rounded-lg border border-line bg-surface px-3 text-[13px] font-semibold text-content outline-none focus:border-accent"
                />
                <textarea
                  value={task.text}
                  onChange={(e) =>
                    setHomework((prev) =>
                      prev.map((x, k) => (k === i ? { ...x, text: e.target.value } : x)),
                    )
                  }
                  placeholder={t.lessonUnits.taskText}
                  className="mt-1.5 min-h-20 w-full rounded-lg border border-line bg-surface px-3 py-2 text-[13px] text-content outline-none focus:border-accent"
                />
              </div>
              <button
                type="button"
                onClick={() => setHomework((prev) => prev.filter((_, k) => k !== i))}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-faint transition hover:bg-surface hover:text-rose-500"
              >
                <IconTrash className="h-4 w-4" />
              </button>
            </div>
          ))}

          <button
            type="button"
            onClick={() => setHomework((prev) => [...prev, { title: "", text: "" }])}
            className="flex h-10 w-fit items-center gap-1.5 rounded-xl border border-line px-3 text-[13px] font-semibold text-content transition hover:border-accent hover:text-accent"
          >
            <IconPlus className="h-4 w-4" />
            {t.lessonUnits.addTask}
          </button>
        </div>
      </Section>

      <div className="sticky bottom-4 flex items-center gap-3">
        <button
          type="button"
          onClick={save}
          disabled={busy}
          className="h-12 rounded-xl bg-accent px-6 text-sm font-bold text-white shadow-lg transition hover:opacity-90 disabled:opacity-50"
        >
          {busy ? t.lessonUnits.saving : t.lessonUnits.save}
        </button>
        {saved && !busy && (
          <span className="text-sm font-semibold text-emerald-500">
            {t.lessonUnits.saved}
          </span>
        )}
      </div>
    </div>
  );
}

function Section({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl bg-surface p-4 ring-1 ring-line shadow-sm sm:p-5">
      <p className="text-sm font-bold text-content">{title}</p>
      {hint && <p className="mb-2 mt-0.5 text-[12px] text-faint">{hint}</p>}
      <div className={hint ? "" : "mt-3"}>{children}</div>
    </section>
  );
}

/** Как словник будет выглядеть у ученика — по категориям. */
function VocabPreview({ words }: { words: LessonView["words"] }) {
  const groups = useMemo(() => {
    const map = new Map<string, LessonView["words"]>();
    for (const w of words) {
      const key = w.category ?? "";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(w);
    }
    return [...map.entries()];
  }, [words]);

  return (
    <div className="mt-3 flex flex-col gap-3">
      {groups.map(([category, list]) => (
        <div key={category}>
          {category && (
            <p className="mb-1 text-[11px] font-bold uppercase tracking-wide text-faint">
              {category}
            </p>
          )}
          <div className="flex flex-wrap gap-1.5">
            {list.map((w) => (
              <span
                key={w.phraseId}
                className="flex items-center gap-1 rounded-lg bg-surface-2 px-2 py-1 text-[12px] text-content"
              >
                {w.icon && <span>{w.icon}</span>}
                {w.word}
                {(w.transcriptionUs || w.transcriptionUk) && (
                  <IconVolume className="h-3 w-3 text-faint" />
                )}
              </span>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
