"use client";

/** Активный урок внутри класса: выбор учителя и общий просмотр. */
import { useCallback, useEffect, useState, useTransition, type MouseEvent } from "react";
import Link from "next/link";
import { useT } from "@/components/i18n-provider";
import { AssignedLesson } from "@/components/lessons/assigned-lesson";
import {
  addLessonToClassAction,
  assignedLessonAction,
  listLessonsAction,
  openSectionAction,
  type LessonCard,
} from "@/lib/actions/lessons";
import { LESSON_SECTIONS, type LessonSection } from "@/lib/lesson-unit";
import { IconCheck, IconPlus } from "@/components/icons";
import { cn } from "@/lib/utils";
import type { ClassVideoState } from "@/lib/class-video";
import type { ClassTextSelection } from "./selection-translation-popover";

type Assigned = NonNullable<Awaited<ReturnType<typeof assignedLessonAction>>>;

const POLL_MS = 4_000;

export function ClassLesson({
  teacher,
  assignmentId,
  videoSync,
  onAssigned,
  onTextSelect,
}: {
  teacher: boolean;
  assignmentId: string | null;
  videoSync: ClassVideoState | null;
  onAssigned?: (id: string) => void;
  onTextSelect?: (selection: ClassTextSelection) => void;
}) {
  const { t } = useT();
  const [lessons, setLessons] = useState<LessonCard[]>([]);
  const [selected, setSelected] = useState("");
  const [data, setData] = useState<Assigned | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, startBusy] = useTransition();

  useEffect(() => {
    if (!teacher) return;
    let alive = true;
    listLessonsAction()
      .then((items) => {
        if (!alive) return;
        setLessons(items);
        setSelected((value) => value || items[0]?.id || "");
      })
      .catch(() => alive && setError(t.lessonUnits.classLessonFailed));
    return () => {
      alive = false;
    };
  }, [teacher, t.lessonUnits.classLessonFailed]);

  const reload = useCallback(async () => {
    if (!assignmentId) {
      setData(null);
      setLoaded(true);
      return;
    }
    const next = await assignedLessonAction(assignmentId);
    setData(next);
    setLoaded(true);
    if (next && teacher) setSelected(next.lesson.id);
  }, [assignmentId, teacher]);

  useEffect(() => {
    let alive = true;
    const load = () =>
      reload().catch(() => alive && setError(t.lessonUnits.classLessonFailed));
    void load();
    const timer = setInterval(load, POLL_MS);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [reload, t.lessonUnits.classLessonFailed]);

  // Focus по видео приходит быстрым тактом класса. Не ждём следующего
  // четырёхсекундного обновления, если этим же действием секцию только открыли.
  useEffect(() => {
    if (
      !videoSync?.focusAt ||
      videoSync.assignmentId !== assignmentId
    ) return;
    const frame = requestAnimationFrame(() => {
      void reload().catch(() => setError(t.lessonUnits.classLessonFailed));
    });
    return () => cancelAnimationFrame(frame);
  }, [assignmentId, reload, t.lessonUnits.classLessonFailed, videoSync?.assignmentId, videoSync?.focusAt]);

  const add = () => {
    if (!selected) return;
    setError(null);
    startBusy(async () => {
      const result = await addLessonToClassAction(selected);
      if (result.error || !result.id) {
        setError(result.error ?? t.lessonUnits.classLessonFailed);
        return;
      }
      onAssigned?.(result.id);
      const next = await assignedLessonAction(result.id);
      setData(next);
      setLoaded(true);
    });
  };

  const LABEL: Record<LessonSection, string> = {
    vocab: t.lessonUnits.secVocab,
    lexis: t.lessonUnits.secLexis,
    video: t.lessonUnits.secVideo,
    transcript: t.lessonUnits.secTranscript,
    questions: t.lessonUnits.secQuestions,
    homework: t.lessonUnits.secHomework,
  };

  const captureSelection = (
    event: MouseEvent<HTMLDivElement>,
    fallbackText = "",
  ) => {
    if (!onTextSelect) return;
    const selection = window.getSelection();
    const selectionInside = !!selection &&
      !selection.isCollapsed &&
      !!selection.anchorNode &&
      !!selection.focusNode &&
      event.currentTarget.contains(selection.anchorNode) &&
      event.currentTarget.contains(selection.focusNode);
    const text = (selectionInside ? selection.toString() : fallbackText)
      .replace(/\s+/g, " ")
      .trim();
    if (!text) return;
    const range = selectionInside && selection.rangeCount > 0
      ? selection.getRangeAt(0)
      : null;
    const rect = range?.getBoundingClientRect();
    onTextSelect({
      text,
      x: event.clientX || rect?.left || 12,
      y: rect?.bottom || event.clientY || 12,
      nonce: Date.now(),
    });
  };

  const captureDoubleClick = (event: MouseEvent<HTMLDivElement>) => {
    const target = event.target instanceof Element
      ? event.target.closest<HTMLElement>("[data-lookup-text]")
      : null;
    captureSelection(event, target?.dataset.lookupText ?? "");
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      {teacher && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl bg-surface-2 p-2.5">
          {lessons.length > 0 ? (
            <>
              <select
                value={selected}
                onChange={(event) => setSelected(event.target.value)}
                className="h-10 min-w-0 flex-1 rounded-xl border border-line bg-surface px-3 text-sm font-semibold text-content outline-none focus:border-accent"
              >
                {lessons.map((lesson) => (
                  <option key={lesson.id} value={lesson.id}>
                    {lesson.title}
                  </option>
                ))}
              </select>
              <button
                type="button"
                disabled={busy || !selected}
                onClick={add}
                className="flex h-10 items-center gap-1.5 rounded-xl bg-accent px-3.5 text-sm font-bold text-white transition hover:opacity-90 disabled:opacity-50"
              >
                <IconPlus className="h-4 w-4" />
                {t.lessonUnits.addToClass}
              </button>
            </>
          ) : (
            <Link
              href="/teacher/lessons"
              className="text-sm font-semibold text-accent hover:underline"
            >
              {t.lessonUnits.createClassLesson}
            </Link>
          )}
        </div>
      )}

      {error && <p className="text-sm text-rose-500">{error}</p>}

      {!loaded ? (
        <p className="py-8 text-center text-sm text-faint">{t.common.loading}</p>
      ) : !data ? (
        <div className="flex flex-1 items-center justify-center rounded-2xl bg-surface-2 p-8 text-center">
          <div>
            <p className="text-sm font-semibold text-content">{t.lessonUnits.noClassLesson}</p>
            <p className="mt-1 text-[12px] text-faint">{t.lessonUnits.classLessonHint}</p>
          </div>
        </div>
      ) : (
        <>
          {teacher && (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="mr-1 text-[12px] font-semibold text-muted">
                {t.lessonUnits.openForStudent}
              </span>
              {LESSON_SECTIONS.map((section) => {
                const always = section === "vocab";
                const opened = always || data.open.includes(section);
                return (
                  <button
                    key={section}
                    type="button"
                    disabled={busy || always}
                    onClick={() =>
                      startBusy(async () => {
                        await openSectionAction(data.assignment.id, section, !opened);
                        await reload();
                      })
                    }
                    className={cn(
                      "flex h-8 items-center gap-1 rounded-lg px-2.5 text-[11px] font-semibold transition",
                      opened
                        ? "bg-accent text-white"
                        : "bg-surface-2 text-muted hover:text-content",
                      always && "opacity-70",
                    )}
                  >
                    {opened && <IconCheck className="h-3 w-3" />}
                    {LABEL[section]}
                  </button>
                );
              })}
            </div>
          )}

          <div onMouseUp={captureSelection} onDoubleClick={captureDoubleClick}>
            <AssignedLesson
              key={data.assignment.id}
              data={data}
              teacher={teacher}
              liveClass
              classVideo={
                videoSync?.assignmentId === data.assignment.id
                  ? videoSync
                  : null
              }
            />
          </div>
        </>
      )}
    </div>
  );
}
