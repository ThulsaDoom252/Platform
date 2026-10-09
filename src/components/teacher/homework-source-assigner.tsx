"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { BookOpen, Check, Gamepad2, Plus, X } from "lucide-react";
import { useT } from "@/components/i18n-provider";
import {
  assignHomeworkFromLessonSourceAction,
  listHomeworkLessonSourcesAction,
  type HomeworkLessonSource,
} from "@/lib/actions/lesson-homework";
import {
  assignWordDeckHomeworkAction,
  listWordDeckActivitiesAction,
} from "@/lib/actions/word-deck";
import {
  assignGuessPicturePresetHomeworkAction,
  listGuessPicturePresetsAction,
} from "@/lib/actions/guess-picture";
import {
  assignRevisionPresetAction,
  listRevisionPresetsAction,
} from "@/lib/actions/revision";
import { cn } from "@/lib/utils";
import { HomeworkMediaOptions } from "@/components/lessons/homework-media-options";
import type { HomeworkMediaSelection } from "@/lib/homework-media";

type Stage = "choice" | "lesson" | "activity";
type ActivitySource = {
  key: string;
  id: string;
  kind: "WORD_DECK" | "GUESS_PICTURE" | "REVISION";
  title: string;
  meta: string;
};

export function HomeworkSourceAssigner({
  studentId,
  studentName,
}: {
  studentId: string;
  studentName: string;
}) {
  const { t } = useT();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [stage, setStage] = useState<Stage>("choice");
  const [lessons, setLessons] = useState<HomeworkLessonSource[] | null>(null);
  const [lessonId, setLessonId] = useState<string | null>(null);
  const [exerciseIds, setExerciseIds] = useState<string[]>([]);
  const [media, setMedia] = useState<HomeworkMediaSelection>({ video: false, transcript: false });
  const [activities, setActivities] = useState<ActivitySource[] | null>(null);
  const [activityKeys, setActivityKeys] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [busy, startAssign] = useTransition();

  const resetAndClose = () => {
    setOpen(false);
    setStage("choice");
    setError(null);
    if (done) setLessons(null);
    setDone(null);
  };

  const openLessons = async () => {
    setStage("lesson");
    setError(null);
    if (lessons) return;
    setLoading(true);
    try {
      const rows = await listHomeworkLessonSourcesAction(studentId);
      setLessons(rows);
      if (rows[0]) {
        setLessonId(rows[0].id);
        setExerciseIds(rows[0].exercises.map((exercise) => exercise.id));
        setMedia(rows[0].mediaSelection);
      }
    } catch {
      setError(t.teacherHomeworks.sourceLoadFailed);
    } finally {
      setLoading(false);
    }
  };

  const openActivities = async () => {
    setStage("activity");
    setError(null);
    if (activities) return;
    setLoading(true);
    try {
      const [decks, pictures, revisions] = await Promise.all([
        listWordDeckActivitiesAction(),
        listGuessPicturePresetsAction(),
        listRevisionPresetsAction(),
      ]);
      setActivities([
        ...decks.map((deck): ActivitySource => ({
          key: `WORD_DECK:${deck.id}`,
          id: deck.id,
          kind: "WORD_DECK",
          title: deck.title,
          meta: deck.settings.gameType === "SPELLING"
            ? t.wordDeck.spellingTitle
            : deck.settings.gameType === "GUESS_DESCRIPTION"
              ? t.wordDeck.guessByDescription
              : t.wordDeck.wordsGame,
        })),
        ...pictures.map((game): ActivitySource => ({
          key: `GUESS_PICTURE:${game.id}`,
          id: game.id,
          kind: "GUESS_PICTURE",
          title: game.title,
          meta: t.teacherHomeworks.activityGuessPicture,
        })),
        ...revisions.map((revision): ActivitySource => ({
          key: `REVISION:${revision.id}`,
          id: revision.id,
          kind: "REVISION",
          title: revision.title,
          meta: t.teacherHomeworks.activityRevision,
        })),
      ]);
    } catch {
      setError(t.teacherHomeworks.sourceLoadFailed);
    } finally {
      setLoading(false);
    }
  };

  const selectedLesson = lessons?.find((lesson) => lesson.id === lessonId) ?? null;
  const chooseLesson = (lesson: HomeworkLessonSource) => {
    setLessonId(lesson.id);
    setExerciseIds(lesson.exercises.map((exercise) => exercise.id));
    setMedia(lesson.mediaSelection);
    setError(null);
  };

  const toggle = (value: string, selected: string[], setSelected: (next: string[]) => void) => {
    setSelected(selected.includes(value)
      ? selected.filter((item) => item !== value)
      : [...selected, value]);
    setError(null);
  };

  const assignLesson = () => {
    if (!lessonId || exerciseIds.length === 0) {
      setError(t.teacherHomeworks.selectAtLeastOne);
      return;
    }
    startAssign(async () => {
      const result = await assignHomeworkFromLessonSourceAction({ studentId, lessonId, exerciseIds, media });
      if (result.error) return setError(result.error);
      setLessons((current) => current?.map((lesson) => lesson.id === lessonId
        ? { ...lesson, assignmentId: result.assignmentId ?? lesson.assignmentId, mediaSelection: media }
        : lesson) ?? null);
      setDone(t.teacherHomeworks.homeworkAdded);
      router.refresh();
    });
  };

  const assignActivities = () => {
    const chosen = (activities ?? []).filter((activity) => activityKeys.includes(activity.key));
    if (chosen.length === 0) {
      setError(t.teacherHomeworks.selectAtLeastOne);
      return;
    }
    startAssign(async () => {
      for (const activity of chosen) {
        const result = activity.kind === "WORD_DECK"
          ? await assignWordDeckHomeworkAction(activity.id, studentId)
          : activity.kind === "GUESS_PICTURE"
            ? await assignGuessPicturePresetHomeworkAction(activity.id, studentId)
            : await assignRevisionPresetAction(activity.id, studentId, "HOMEWORK");
        if (result.error) return setError(result.error);
      }
      setDone(t.teacherHomeworks.activitiesAdded.replace("{n}", String(chosen.length)));
      setActivityKeys([]);
      router.refresh();
    });
  };

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setOpen(true);
          setStage("choice");
          setError(null);
          setDone(null);
        }}
        className="flex h-11 items-center gap-2 rounded-xl bg-accent px-4 text-sm font-black text-white shadow-lg transition hover:-translate-y-0.5 hover:brightness-110"
      >
        <Plus className="h-4 w-4" />
        {t.teacherHomeworks.addHomework}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/75 p-3 backdrop-blur-sm sm:p-6"
          onMouseDown={(event) => event.target === event.currentTarget && resetAndClose()}
        >
          <section className="max-h-[94dvh] w-full max-w-4xl overflow-y-auto rounded-3xl bg-surface p-5 shadow-2xl ring-1 ring-line sm:p-6">
            <div className="flex items-start gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-black uppercase tracking-[.2em] text-accent">
                  {t.teacherHomeworks.addHomework}
                </p>
                <h2 className="mt-1 text-xl font-black text-content">{studentName}</h2>
                <p className="mt-1 text-sm text-muted">{t.teacherHomeworks.addHomeworkHint}</p>
              </div>
              <button
                type="button"
                onClick={resetAndClose}
                className="flex h-9 w-9 items-center justify-center rounded-xl text-muted transition hover:bg-surface-2 hover:text-content"
                aria-label={t.common.close}
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {stage !== "choice" && (
              <button
                type="button"
                onClick={() => {
                  setStage("choice");
                  setError(null);
                  setDone(null);
                }}
                className="mt-4 text-xs font-black text-muted transition hover:text-accent"
              >
                ← {t.teacherHomeworks.backToSources}
              </button>
            )}

            {stage === "choice" && (
              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => void openLessons()}
                  className="group rounded-3xl border border-violet-300/50 bg-gradient-to-br from-violet-100 via-white to-indigo-100 p-5 text-left shadow-sm transition hover:-translate-y-1 hover:shadow-xl dark:from-violet-950 dark:via-slate-950 dark:to-indigo-950"
                >
                  <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-500 text-white shadow-lg"><BookOpen className="h-6 w-6" /></span>
                  <h3 className="mt-4 text-lg font-black text-content">{t.teacherHomeworks.fromLesson}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-muted">{t.teacherHomeworks.fromLessonHint}</p>
                </button>
                <button
                  type="button"
                  onClick={() => void openActivities()}
                  className="group rounded-3xl border border-cyan-300/50 bg-gradient-to-br from-cyan-100 via-white to-emerald-100 p-5 text-left shadow-sm transition hover:-translate-y-1 hover:shadow-xl dark:from-cyan-950 dark:via-slate-950 dark:to-emerald-950"
                >
                  <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-cyan-500 text-white shadow-lg"><Gamepad2 className="h-6 w-6" /></span>
                  <h3 className="mt-4 text-lg font-black text-content">{t.teacherHomeworks.fromActivities}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-muted">{t.teacherHomeworks.fromActivitiesHint}</p>
                </button>
              </div>
            )}

            {loading && <p className="mt-6 rounded-2xl bg-surface-2 p-6 text-center text-sm font-bold text-muted">{t.common.loading}</p>}

            {stage === "lesson" && !loading && (
              <div className="mt-5 grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
                <div className="flex max-h-[56dvh] flex-col gap-2 overflow-y-auto pr-1">
                  {(lessons ?? []).map((lesson) => (
                    <button
                      key={lesson.id}
                      type="button"
                      onClick={() => chooseLesson(lesson)}
                      className={cn(
                        "rounded-2xl p-3 text-left ring-1 transition",
                        lessonId === lesson.id
                          ? "bg-accent-soft text-content ring-accent"
                          : "bg-surface-2 text-muted ring-line hover:text-content hover:ring-accent/40",
                      )}
                    >
                      <span className="block text-sm font-black">{lesson.title}</span>
                      <span className="mt-1 block text-[11px] opacity-75">{lesson.exercises.length} · {t.teacherHomeworks.exercises}</span>
                    </button>
                  ))}
                  {(lessons ?? []).length === 0 && <p className="rounded-2xl bg-surface-2 p-4 text-sm text-muted">{t.teacherHomeworks.noLessonSources}</p>}
                </div>
                {selectedLesson && (
                  <div className="min-w-0 rounded-2xl bg-surface-2 p-4 ring-1 ring-line">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <h3 className="text-base font-black text-content">{selectedLesson.homeworkTitle}</h3>
                        <p className="mt-1 text-xs text-muted">{t.teacherHomeworks.chooseLessonParts}</p>
                      </div>
                      <div className="flex gap-2">
                        <button type="button" onClick={() => setExerciseIds(selectedLesson.exercises.map((exercise) => exercise.id))} className="text-xs font-black text-accent">{t.wordDeck.selectAll}</button>
                        <button type="button" onClick={() => setExerciseIds([])} className="text-xs font-black text-muted">{t.wordDeck.selectNone}</button>
                      </div>
                    </div>
                    <HomeworkMediaOptions available={selectedLesson.mediaAvailable} value={media} onChange={setMedia} disabled={busy} />
                    <div className="mt-4 grid gap-2">
                      {selectedLesson.exercises.map((exercise, index) => {
                        const checked = exerciseIds.includes(exercise.id);
                        return (
                          <label key={exercise.id} className={cn("flex cursor-pointer items-center gap-3 rounded-xl p-3 ring-1 transition", checked ? "bg-accent-soft ring-accent/35" : "bg-surface ring-line")}>
                            <input type="checkbox" checked={checked} onChange={() => toggle(exercise.id, exerciseIds, setExerciseIds)} className="h-4 w-4 accent-[var(--accent)]" />
                            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-surface-2 text-xs font-black text-accent">{index + 1}</span>
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-sm font-black text-content">{exercise.title}</span>
                              <span className="block text-[11px] text-muted">{exercise.optional ? t.interactiveHomework.bonus : t.teacherHomeworks.required} · {exercise.items}</span>
                            </span>
                            {checked && <Check className="h-4 w-4 text-accent" />}
                          </label>
                        );
                      })}
                    </div>
                    <button type="button" disabled={busy || exerciseIds.length === 0} onClick={assignLesson} className="mt-4 h-11 w-full rounded-xl bg-accent text-sm font-black text-white shadow-sm transition hover:brightness-110 disabled:opacity-40">
                      {busy ? t.teacherHomeworks.addingHomework : t.teacherHomeworks.assignSelected}
                    </button>
                  </div>
                )}
              </div>
            )}

            {stage === "activity" && !loading && (
              <div className="mt-5">
                <div className="grid max-h-[58dvh] gap-2 overflow-y-auto p-1 sm:grid-cols-2">
                  {(activities ?? []).map((activity) => {
                    const checked = activityKeys.includes(activity.key);
                    return (
                      <label key={activity.key} className={cn("flex cursor-pointer items-center gap-3 rounded-2xl p-3.5 ring-1 transition", checked ? "bg-accent-soft ring-accent" : "bg-surface-2 ring-line hover:ring-accent/35")}>
                        <input type="checkbox" checked={checked} onChange={() => toggle(activity.key, activityKeys, setActivityKeys)} className="h-4 w-4 accent-[var(--accent)]" />
                        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent text-lg text-white shadow-sm">🎮</span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-black text-content">{activity.title}</span>
                          <span className="mt-0.5 block text-[11px] font-semibold text-muted">{activity.meta}</span>
                        </span>
                        {checked && <Check className="h-4 w-4 text-accent" />}
                      </label>
                    );
                  })}
                  {(activities ?? []).length === 0 && <p className="sm:col-span-2 rounded-2xl bg-surface-2 p-6 text-center text-sm text-muted">{t.teacherHomeworks.noActivitySources}</p>}
                </div>
                <button type="button" disabled={busy || activityKeys.length === 0} onClick={assignActivities} className="mt-4 h-11 w-full rounded-xl bg-accent text-sm font-black text-white shadow-sm transition hover:brightness-110 disabled:opacity-40">
                  {busy ? t.teacherHomeworks.addingHomework : t.teacherHomeworks.assignSelected}
                </button>
              </div>
            )}

            {error && <p className="mt-4 rounded-xl bg-rose-50 px-3 py-2 text-sm font-bold text-rose-600 dark:bg-rose-950/30 dark:text-rose-300">{error}</p>}
            {done && <p className="mt-4 rounded-xl bg-emerald-50 px-3 py-2 text-sm font-bold text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300">✓ {done}</p>}
          </section>
        </div>
      )}
    </>
  );
}
