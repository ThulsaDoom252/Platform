"use client";

/**
 * Сборка урока-активности.
 *
 * Шесть секций, и каждая правится на месте: урок редко собирается за
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
import { upload } from "@vercel/blob/client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useT } from "@/components/i18n-provider";
import { fmt } from "@/lib/i18n";
import {
  deleteLessonLexisAction,
  fillLessonLexisAction,
  fillVocabAction,
  saveLessonLexisAction,
  saveLessonAction,
  type LessonView,
} from "@/lib/actions/lessons";
import {
  groupWords,
  parseTranscript,
  richLineWords,
  speakerTint,
  speakersOf,
} from "@/lib/lesson-unit";
import { parseLexisDocuments } from "@/lib/keyed-parser";
import { sanitizeBlocks } from "@/lib/rule-blocks";
import { RuleReader } from "@/components/materials/rule-reader";
import {
  IconCheck,
  IconChevronLeft,
  IconEye,
  IconEyeOff,
  IconPencil,
  IconPlus,
  IconTrash,
  IconVolume,
} from "@/components/icons";
import { cn } from "@/lib/utils";
import type { WordDeckActivity } from "@/lib/actions/word-deck";
import { RegularLessonView } from "@/components/lessons/regular-lesson-view";
import { LessonVocabToMaterials } from "@/components/lessons/lesson-vocab-to-materials";
import { regularSectionKey } from "@/lib/regular-lesson";

const inputCls =
  "h-11 w-full rounded-xl border border-line bg-surface-2 px-3.5 text-sm text-content outline-none transition placeholder:text-faint focus:border-accent";
const areaCls =
  "min-h-32 w-full rounded-xl border border-line bg-surface-2 px-3.5 py-2.5 text-sm leading-relaxed text-content outline-none transition placeholder:text-faint focus:border-accent";

type LessonEditorProps = {
  lesson: LessonView;
  vocabs: { id: string; name: string; scope: string; words: number }[];
  lexises: { id: string; name: string; scope: string; blocks: number }[];
  activities: WordDeckActivity[];
};

export function LessonEditor(props: LessonEditorProps) {
  if (props.lesson.kind === "REGULAR") {
    return <RegularLessonEditor lesson={props.lesson} />;
  }
  return <ActivityLessonEditor {...props} />;
}

function ActivityLessonEditor({
  lesson,
  vocabs,
  lexises,
  activities,
}: LessonEditorProps) {
  const { t } = useT();
  const router = useRouter();

  const [title, setTitle] = useState(lesson.title);
  const [vocabNodeId, setVocabNodeId] = useState(lesson.vocabNodeId ?? "");
  const [lexisNodeId, setLexisNodeId] = useState("");
  const [lexisSource, setLexisSource] = useState("");
  const [lexis, setLexis] = useState(lesson.lexis);
  const [activeLexisId, setActiveLexisId] = useState(lesson.lexis[0]?.id ?? "");
  const [lexisError, setLexisError] = useState<string | null>(null);
  const [lexisSaved, setLexisSaved] = useState(false);
  const [videoUrl, setVideoUrl] = useState(lesson.videoUrl ?? "");
  const [videoTitle, setVideoTitle] = useState(lesson.videoTitle ?? "");
  const [videoUploading, setVideoUploading] = useState(false);
  const [videoUploadError, setVideoUploadError] = useState<string | null>(null);
  const [transcriptText, setTranscriptText] = useState(
    lesson.transcript.map((l) => `${l.speaker}: ${l.text}`).join("\n"),
  );
  const [afterVideo, setAfterVideo] = useState(lesson.questions.afterVideo.join("\n"));
  const [afterReading, setAfterReading] = useState(
    lesson.questions.afterReading.join("\n"),
  );
  const [homework, setHomework] = useState(lesson.homework);
  const [activityIds, setActivityIds] = useState(() => new Set(lesson.activities.map((activity) => activity.id)));
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [filled, setFilled] = useState<number | null>(null);
  const [busy, startBusy] = useTransition();

  /* Разбор идёт на лету: что получилось из вставленного, видно сразу. */
  const lines = useMemo(() => parseTranscript(transcriptText), [transcriptText]);
  const speakers = useMemo(() => speakersOf(lines), [lines]);
  const parsedLexis = useMemo(
    () => (lexisSource.trim() ? parseLexisDocuments(lexisSource) : []),
    [lexisSource],
  );
  const lexisInvalid =
    !!lexisSource.trim() &&
    (parsedLexis.length === 0 ||
      parsedLexis.some(
        (group) => !sanitizeBlocks(group.blocks).some((block) => block.type === "word"),
      ));
  const activeLexis =
    lexis.find((group) => group.id === activeLexisId) ?? lexis[0] ?? null;

  const uploadVideo = async (file: File) => {
    setVideoUploading(true);
    setVideoUploadError(null);
    try {
      const suppliedExtension = file.name.split(".").pop()?.toLowerCase() ?? "";
      const byMime: Record<string, string> = {
        "video/mp4": "mp4",
        "video/webm": "webm",
        "video/ogg": "ogv",
        "video/quicktime": "mov",
        "video/x-m4v": "m4v",
      };
      const allowed = new Set(["mp4", "webm", "ogv", "ogg", "mov", "m4v"]);
      const extension = allowed.has(suppliedExtension)
        ? suppliedExtension
        : byMime[file.type];
      if (!extension) {
        setVideoUploadError(t.lessonUnits.videoUploadFailed);
        return;
      }

      const nextTitle = file.name.replace(/\.[^.]+$/, "").trim() || "Video";
      const blob = await upload(
        `uploads/lesson-videos/${lesson.id}-${crypto.randomUUID()}.${extension}`,
        file,
        {
          access: "public",
          handleUploadUrl: `/api/lesson-video/${lesson.id}`,
          clientPayload: JSON.stringify({ lessonId: lesson.id, title: nextTitle }),
          multipart: true,
        },
      );
      const response = await fetch(`/api/lesson-video/${lesson.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url: blob.url, title: nextTitle }),
      });
      const result = (await response.json()) as {
        url?: string;
        title?: string;
        error?: string;
      };
      if (!response.ok || !result.url) {
        setVideoUploadError(result.error ?? t.lessonUnits.videoUploadFailed);
        return;
      }
      setVideoUrl(result.url);
      setVideoTitle(result.title ?? nextTitle);
      setSaved(true);
    } catch {
      setVideoUploadError(t.lessonUnits.videoUploadFailed);
    } finally {
      setVideoUploading(false);
    }
  };

  const saveLexis = async () => {
    setLexisError(null);
    setLexisSaved(false);
    const result = await saveLessonLexisAction(lesson.id, lexisSource);
    if (result.error) {
      setLexisError(result.error);
      return false;
    }
    const groups = result.lexis ?? [];
    setLexis(groups);
    const addedTitle = parsedLexis.at(-1)?.title?.trim().toLocaleLowerCase();
    const added = [...groups]
      .reverse()
      .find((group) => group.title.toLocaleLowerCase() === addedTitle);
    setActiveLexisId(added?.id ?? groups.at(-1)?.id ?? "");
    setLexisSource("");
    setLexisSaved(true);
    return true;
  };

  function save() {
    setSaved(false);
    setSaveError(null);
    startBusy(async () => {
      const result = await saveLessonAction(lesson.id, {
        title,
        vocabNodeId: vocabNodeId || null,
        videoUrl,
        videoTitle,
        transcriptText,
        afterVideo: afterVideo.split("\n"),
        afterReading: afterReading.split("\n"),
        homework,
        activityIds: [...activityIds],
      });
      if (result.error) {
        setSaveError(result.error);
        return;
      }
      setSaved(true);
    });
  }

  function saveTitle() {
    const next = title.trim().slice(0, 160);
    if (!next) return;
    setSaved(false);
    setSaveError(null);
    startBusy(async () => {
      const result = await saveLessonAction(lesson.id, { title: next });
      if (result.error) {
        setSaveError(result.error);
        return;
      }
      setTitle(next);
      setSaved(true);
      router.refresh();
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

      <div>
        <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-faint">
          {t.lessonUnits.lessonName}
        </label>
        <div className="flex items-center gap-2">
          <div className="flex min-w-0 flex-1 items-center gap-2 rounded-2xl border border-line bg-surface px-4 shadow-sm transition focus-within:border-accent">
            <IconPencil className="h-4 w-4 shrink-0 text-accent" />
            <input
              value={title}
              maxLength={160}
              onChange={(event) => {
                setTitle(event.target.value);
                setSaved(false);
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter") saveTitle();
              }}
              className="h-14 min-w-0 flex-1 bg-transparent text-xl font-bold text-content outline-none sm:text-2xl"
            />
          </div>
          <button
            type="button"
            disabled={busy || !title.trim()}
            onClick={saveTitle}
            className="h-14 shrink-0 rounded-2xl bg-accent px-4 text-sm font-bold text-white shadow-sm transition hover:opacity-90 disabled:opacity-50"
          >
            {busy ? t.lessonUnits.saving : t.lessonUnits.save}
          </button>
        </div>
        {saveError && (
          <p className="mt-1.5 text-[12px] font-semibold text-rose-500">{saveError}</p>
        )}
      </div>

      {/* Словник: свой у урока, наполняется из материалов по желанию. */}
      <Section title={t.lessonUnits.secVocab}>
        <div className="flex flex-wrap items-center gap-2">
          {vocabs.length === 0 ? (
            <p className="text-sm text-faint">{t.lessonUnits.noVocab}</p>
          ) : (
            <>
              <select
                value={vocabNodeId}
                onChange={(e) => setVocabNodeId(e.target.value)}
                className={`${inputCls} min-w-0 flex-1`}
              >
                <option value="">— {t.lessonUnits.pickVocab} —</option>
                {vocabs.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name} · {fmt(t.lessonUnits.words, { n: v.words })}
                    {v.scope === "PERSONAL" ? " · " + t.materials.mine : ""}
                  </option>
                ))}
              </select>

              <button
                type="button"
                disabled={busy || !vocabNodeId}
                onClick={() =>
                  startBusy(async () => {
                    const result = await fillVocabAction(lesson.id, vocabNodeId);
                    setFilled(result.added ?? null);
                    router.refresh();
                  })
                }
                className="h-11 rounded-xl bg-accent px-4 text-sm font-bold text-white transition hover:opacity-90 disabled:opacity-50"
              >
                {t.lessonUnits.fillFromMaterials}
              </button>
            </>
          )}
        </div>

        {filled !== null && (
          <p className="mt-2 text-[12px] font-semibold text-emerald-500">
            {fmt(t.lessonUnits.filled, { n: filled })}
          </p>
        )}

        {lesson.words.length > 0 && (
          <>
            <div className="mt-3 flex justify-end">
              <LessonVocabToMaterials unitId={lesson.id} lessonTitle={lesson.title} />
            </div>
            <VocabPreview words={lesson.words} />
          </>
        )}
      </Section>

      {lesson.kind !== "REGULAR" && (
        <Section title={t.lessonUnits.secLexis} hint={t.lessonUnits.lexisHint}>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={lexisNodeId}
              onChange={(event) => setLexisNodeId(event.target.value)}
              className={`${inputCls} min-w-0 flex-1`}
            >
              <option value="">— {t.lessonUnits.pickLexis} —</option>
              {lexises.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name} · {item.blocks} {t.lessonUnits.blocks}
                  {item.scope === "PERSONAL" ? " · " + t.materials.mine : ""}
                </option>
              ))}
            </select>
            <button
              type="button"
              disabled={busy || !lexisNodeId}
              onClick={() =>
                startBusy(async () => {
                  setLexisError(null);
                  setLexisSaved(false);
                  const result = await fillLessonLexisAction(lesson.id, lexisNodeId);
                  if (result.error || !result.lexis) {
                    setLexisError(result.error ?? t.lessonUnits.lexisFailed);
                    return;
                  }
                  setLexis(result.lexis);
                  const added = [...result.lexis]
                    .reverse()
                    .find((group) => group.sourceNodeId === lexisNodeId);
                  setActiveLexisId(added?.id ?? result.lexis.at(-1)?.id ?? "");
                  setLexisSaved(true);
                })
              }
              className="h-11 rounded-xl bg-accent px-4 text-sm font-bold text-white transition hover:opacity-90 disabled:opacity-50"
            >
              {t.lessonUnits.takeFromMaterials}
            </button>
          </div>

          <textarea
            value={lexisSource}
            onChange={(event) => {
              setLexisSource(event.target.value);
              setLexisSaved(false);
              setLexisError(null);
            }}
            placeholder={t.lessonUnits.lexisPlaceholder}
            className={`${areaCls} mt-3 min-h-72 font-mono text-[12px]`}
          />

          {lexisInvalid && (
            <p className="mt-2 text-[12px] font-semibold text-rose-500">
              {t.lessonUnits.lexisTypeError}
            </p>
          )}
          {!lexisInvalid && parsedLexis.length > 0 && (
            <p className="mt-2 text-[12px] font-semibold text-emerald-500">
              {fmt(t.lessonUnits.lexisParsed, { n: parsedLexis.length })}: {parsedLexis
                .map((group) => group.title || "Lexis")
                .join(", ")}
            </p>
          )}
          {lexisError && (
            <p className="mt-2 text-[12px] font-semibold text-rose-500">{lexisError}</p>
          )}

          <div className="mt-2 flex items-center gap-2">
            <button
              type="button"
              disabled={busy || !lexisSource.trim() || lexisInvalid}
              onClick={() => startBusy(async () => void (await saveLexis()))}
              className="h-10 rounded-xl border border-accent px-3.5 text-[12px] font-bold text-accent transition hover:bg-accent-soft disabled:opacity-50"
            >
              {t.lessonUnits.parseAndSaveLexis}
            </button>
            {lexisSaved && (
              <span className="text-[12px] font-semibold text-emerald-500">
                {t.lessonUnits.saved}
              </span>
            )}
          </div>

          {lexis.length > 0 && (
            <div className="mt-4 border-t border-line pt-4">
              <div className="mb-3 flex flex-wrap items-center gap-2">
                {lexis.map((group) => (
                  <button
                    key={group.id}
                    type="button"
                    onClick={() => setActiveLexisId(group.id)}
                    className={cn(
                      "h-9 rounded-xl px-3 text-[12px] font-bold transition",
                      activeLexis?.id === group.id
                        ? "bg-accent text-white"
                        : "bg-surface-2 text-muted hover:text-content",
                    )}
                  >
                    {group.title}
                  </button>
                ))}
                {activeLexis && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => {
                      if (!window.confirm(t.lessonUnits.removeLexisConfirm)) return;
                      startBusy(async () => {
                        const result = await deleteLessonLexisAction(
                          lesson.id,
                          activeLexis.id,
                        );
                        if (result.error || !result.lexis) {
                          setLexisError(result.error ?? t.lessonUnits.lexisFailed);
                          return;
                        }
                        setLexis(result.lexis);
                        setActiveLexisId(result.lexis[0]?.id ?? "");
                      });
                    }}
                    className="ml-auto h-9 rounded-xl border border-rose-500/40 px-3 text-[12px] font-bold text-rose-500 transition hover:bg-rose-500/10 disabled:opacity-50"
                  >
                    {t.lessonUnits.removeLexis}
                  </button>
                )}
              </div>
              {activeLexis && activeLexis.warnings.length > 0 && (
                <div className="mb-3 rounded-xl bg-yellow-300/20 px-3 py-2 text-[12px] text-content">
                  {activeLexis.warnings.map((warning, index) => (
                    <p key={index}>⚠ {warning}</p>
                  ))}
                </div>
              )}
              {activeLexis && (
                <RuleReader
                  title={activeLexis.title}
                  icon="🔀"
                  description={activeLexis.intro}
                  blocks={activeLexis.blocks}
                />
              )}
            </div>
          )}
        </Section>
      )}

      {/* Видео */}
      <Section title={t.lessonUnits.secVideo}>
        <div className="mb-3 rounded-xl border border-dashed border-accent/45 bg-accent-soft p-3.5">
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex h-10 cursor-pointer items-center rounded-xl bg-accent px-4 text-sm font-bold text-white transition hover:opacity-90">
              {videoUploading
                ? t.lessonUnits.videoUploading
                : t.lessonUnits.videoUpload}
              <input
                type="file"
                accept="video/mp4,video/webm,video/ogg,video/quicktime,video/x-m4v,.m4v"
                disabled={videoUploading}
                className="sr-only"
                onChange={(event) => {
                  const file = event.currentTarget.files?.[0];
                  event.currentTarget.value = "";
                  if (file) void uploadVideo(file);
                }}
              />
            </label>
            <p className="min-w-0 flex-1 text-[12px] leading-relaxed text-muted">
              {t.lessonUnits.videoUploadHint}
            </p>
          </div>
          {videoUploadError && (
            <p className="mt-2 text-[12px] font-semibold text-rose-500">
              {videoUploadError}
            </p>
          )}
        </div>
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
        {videoUrl.includes("/uploads/lesson-videos/") && (
          <video
            src={videoUrl}
            controls
            preload="metadata"
            className="mt-3 aspect-video max-h-[420px] w-full rounded-xl bg-black"
          />
        )}
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
                <span className="text-[13px] text-content">
                  {richLineWords(line.text).map((part, at) => (
                    <span key={at} className={part.bold ? "font-extrabold" : undefined}>
                      {part.text}
                    </span>
                  ))}
                </span>
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

      {/* Shorts keeps its compact content flow; attached games stay in full activities. */}
      {lesson.kind !== "SHORTS" && <Section title={t.wordDeck.attachedGames}>
        {activities.length === 0 ? (
          <p className="text-sm text-faint">{t.wordDeck.empty}</p>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            {activities.map((activity) => {
              const picked = activityIds.has(activity.id);
              return (
                <button
                  key={activity.id}
                  type="button"
                  onClick={() => setActivityIds((current) => {
                    const next = new Set(current);
                    if (next.has(activity.id)) next.delete(activity.id);
                    else next.add(activity.id);
                    return next;
                  })}
                  className={cn(
                    "flex items-center gap-3 rounded-xl border p-3 text-left transition",
                    picked ? "border-accent bg-accent-soft" : "border-line bg-surface-2",
                  )}
                >
                  <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg", picked ? "bg-accent text-white" : "bg-surface text-faint")}>
                    {picked ? <IconCheck className="h-4 w-4" /> : "♠"}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-bold text-content">{activity.title}</span>
                    <span className="block text-[11px] text-faint">{fmt(t.wordDeck.cardCount, { n: activity.cards.length * activity.settings.repeats })}</span>
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </Section>}

      {/* Домашка */}
      <Section id="lesson-homework" title={t.lessonUnits.secHomework}>
        <div className="flex flex-col gap-2.5">
          {lesson.interactiveHomework && (
            <InteractiveHomeworkPreview plan={lesson.interactiveHomework} />
          )}
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

function InteractiveHomeworkPreview({
  plan,
}: {
  plan: NonNullable<LessonView["interactiveHomework"]>;
}) {
  const { t } = useT();
  const [showAnswers, setShowAnswers] = useState(false);

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-accent/25 bg-accent-soft/30 p-3 sm:p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-accent">
            {t.interactiveHomework.eyebrow}
          </p>
          <p className="mt-0.5 text-base font-black text-content">{plan.title}</p>
        </div>
        <button
          type="button"
          aria-pressed={showAnswers}
          onClick={() => setShowAnswers((current) => !current)}
          className="flex h-9 items-center gap-2 rounded-xl bg-surface px-3 text-xs font-black text-accent ring-1 ring-line transition hover:ring-accent"
        >
          {showAnswers ? <IconEyeOff className="h-4 w-4" /> : <IconEye className="h-4 w-4" />}
          {showAnswers
            ? t.interactiveHomework.hideAnswers
            : t.interactiveHomework.showAnswers}
        </button>
      </div>

      {plan.exercises.map((exercise, exerciseIndex) => (
        <div key={exercise.id} className="rounded-xl bg-surface p-3 ring-1 ring-line">
          <div className="flex items-start gap-2">
            <span className="flex h-7 min-w-7 items-center justify-center rounded-lg bg-accent text-xs font-black text-white">
              {exerciseIndex + 1}
            </span>
            <div className="min-w-0">
              <p className="text-sm font-black text-content">{exercise.title}</p>
              <p className="mt-0.5 text-xs text-muted">{exercise.instruction}</p>
            </div>
          </div>

          {exercise.wordBank && exercise.kind !== "describe" && (
            <ul className="mt-3 grid gap-1 rounded-xl bg-accent-soft/60 p-3 sm:grid-cols-2">
              {exercise.wordBank.map((word) => (
                <li key={word} className="text-xs font-semibold text-content">{word}</li>
              ))}
            </ul>
          )}

          <div className="mt-3 flex flex-col gap-1.5">
            {exercise.items.map((item, itemIndex) => (
              <div key={item.id} className="rounded-lg bg-surface-2 px-3 py-2 text-xs text-content">
                {item.questionAudioUrl && (
                  <audio
                    controls
                    preload="metadata"
                    src={item.questionAudioUrl}
                    aria-label={item.prompt}
                    className="mb-2 w-full"
                  />
                )}
                <div>
                  <span className="mr-2 font-black text-accent">{itemIndex + 1}.</span>
                  <span className="font-semibold">{exercise.kind === "describe" ? item.word : item.prompt}</span>
                </div>
                {showAnswers && item.answer && (
                  <span className="mt-1 block pl-5 font-bold text-emerald-600">{item.answer}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function RegularLessonEditor({ lesson }: { lesson: LessonView }) {
  const { t } = useT();
  const router = useRouter();
  const [title, setTitle] = useState(lesson.title);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, startBusy] = useTransition();

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2 rounded-2xl bg-surface p-4 ring-1 ring-line">
        <Link href="/teacher/lessons" className="mr-1 text-sm font-semibold text-muted hover:text-accent">
          <IconChevronLeft className="inline h-4 w-4" />
        </Link>
        <input
          value={title}
          maxLength={160}
          onChange={(event) => { setTitle(event.target.value); setSaved(false); }}
          className={`${inputCls} min-w-0 flex-1 font-bold`}
        />
        <button
          type="button"
          disabled={busy || !title.trim()}
          onClick={() => startBusy(async () => {
            setError(null);
            const result = await saveLessonAction(lesson.id, { title });
            if (result.error) setError(result.error);
            else { setSaved(true); router.refresh(); }
          })}
          className="flex h-11 items-center gap-1.5 rounded-xl bg-accent px-4 text-sm font-bold text-white disabled:opacity-50"
        >
          <IconCheck className="h-4 w-4" />
          {saved ? t.lessonUnits.saved : t.lessonUnits.save}
        </button>
        {error && <p className="w-full text-sm text-rose-500">{error}</p>}
      </div>

      {lesson.regularSections.length > 0 ? (
        <RegularLessonView
          sections={lesson.regularSections}
          teacher
          open={lesson.regularSections.map((section) => regularSectionKey(section.id))}
          words={lesson.words}
          unitId={lesson.id}
          lessonTitle={lesson.title}
        />
      ) : (
        <div className="rounded-2xl bg-surface p-8 text-center text-sm text-faint ring-1 ring-line">
          {t.lessonUnits.emptyRegularLesson}
        </div>
      )}
      {lesson.interactiveHomework && (
        <Section id="lesson-homework" title={t.lessonUnits.secHomework}>
          <InteractiveHomeworkPreview plan={lesson.interactiveHomework} />
        </Section>
      )}
    </div>
  );
}

function Section({
  id,
  title,
  hint,
  children,
}: {
  id?: string;
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-24 rounded-2xl bg-surface p-4 ring-1 ring-line shadow-sm sm:p-5">
      <p className="text-sm font-bold text-content">{title}</p>
      {hint && <p className="mb-2 mt-0.5 text-[12px] text-faint">{hint}</p>}
      <div className={hint ? "" : "mt-3"}>{children}</div>
    </section>
  );
}

/** Как словник ляжет у ученика: по категориям и алфавиту. */
function VocabPreview({ words }: { words: LessonView["words"] }) {
  const groups = useMemo(() => groupWords(words), [words]);

  return (
    <div className="mt-3 flex flex-col gap-3">
      {groups.map((group) => (
        <div key={group.category}>
          {group.category && (
            <p className="mb-1 text-[11px] font-bold uppercase tracking-wide text-faint">
              {group.category}
            </p>
          )}
          <div className="flex flex-wrap gap-1.5">
            {group.words.map((w) => (
              <span
                key={w.id}
                className="flex items-center gap-1 rounded-lg bg-surface-2 px-2 py-1 text-[12px] text-content"
              >
                {w.icon && <span>{w.icon}</span>}
                {w.word}
                {(w.ipaUs || w.ipaUk) && <IconVolume className="h-3 w-3 text-faint" />}
              </span>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
