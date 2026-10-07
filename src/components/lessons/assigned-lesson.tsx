"use client";

/**
 * Выданный урок: то же содержимое, разные права.
 *
 * Ученик читает. Учитель тыкает по слову — у ученика остаётся один
 * фокус в цвете его собственной темы. Правится закрепление, а не урок.
 */
import { useEffect, useRef, useState, useTransition } from "react";
import dynamic from "next/dynamic";
import { useT } from "@/components/i18n-provider";
import {
  answerAction,
  focusHomeworkElementAction,
  focusLessonWordAction,
  focusRegularLessonElementAction,
  lessonPresentationStateAction,
  lessonVocabularyRevealAction,
  selectLessonLexisGroupAction,
  setLessonHighlightsAction,
  setLessonVocabularyRevealAction,
  showBritishAction,
  submitRegularLessonAnswerAction,
} from "@/lib/actions/lessons";
import type { LessonAssignmentCard, LessonView as Lesson } from "@/lib/actions/lessons";
import {
  LESSON_SECTIONS,
  clearLessonHighlights,
  dialogueHighlights,
  lessonSectionsForKind,
  lessonFocus,
  replaceLessonHighlights,
  selectLexisGroup,
  selectedLexisGroup,
  toggleLessonHighlight,
  toggleWordFocus,
  type HighlightColor,
  type LessonVocabularyReveal,
} from "@/lib/lesson-unit";
import { LessonView } from "@/components/lessons/lesson-view";
import { RegularLessonView } from "@/components/lessons/regular-lesson-view";
import { LessonTextHighlighter } from "@/components/lessons/lesson-text-highlighter";
const LiveLessonEditor = dynamic(() => import("@/components/lessons/live-lesson-editor").then((m) => m.LiveLessonEditor));
import { IconPencil, IconReset, IconTrash, IconVolume } from "@/components/icons";
import { cn } from "@/lib/utils";
import type { ClassVideoState } from "@/lib/class-video";
import { useRealtimeSubscription } from "@/lib/use-realtime";

export function AssignedLesson({
  data,
  teacher,
  classVideo,
  sectionFocus,
  sectionVisibilityBusy = false,
  onSectionVisibilityChange,
  liveClass = false,
  presentationManaged = false,
  initialSection,
  onLessonSaved,
}: {
  data: {
    assignment: LessonAssignmentCard;
    lesson: Lesson;
    answers: Record<string, string>;
    open: string[];
    showBritish: boolean;
    vocabularyReveal: LessonVocabularyReveal;
  };
  teacher: boolean;
  /** Есть только внутри живого класса; вне класса видео остаётся обычным. */
  classVideo?: ClassVideoState | null;
  /** Разовая команда учителя: показать секцию, не открывая её навсегда. */
  sectionFocus?: { section: string; elementId?: string | null; at: string } | null;
  sectionVisibilityBusy?: boolean;
  onSectionVisibilityChange?: (section: string, open: boolean) => void;
  liveClass?: boolean;
  /** The class parent already refreshes marks together with answers and tabs. */
  presentationManaged?: boolean;
  initialSection?: (typeof LESSON_SECTIONS)[number];
  onLessonSaved?: () => void | Promise<void>;
}) {
  const { t } = useT();
  const [marks, setMarks] = useState(data.assignment.highlights);
  const [british, setBritish] = useState(data.showBritish);
  const [highlightMode, setHighlightMode] = useState(false);
  const [highlightColor, setHighlightColor] = useState<HighlightColor>("yellow");
  const [highlightHistorySize, setHighlightHistorySize] = useState(0);
  const [vocabularyReveal, setVocabularyReveal] = useState(data.vocabularyReveal);
  const [editingLesson, setEditingLesson] = useState(false);
  const [busy, startBusy] = useTransition();
  const revealQueue = useRef(Promise.resolve());
  const marksRef = useRef<Record<string, string>>(data.assignment.highlights);
  const highlightHistory = useRef<Record<string, HighlightColor>[]>([]);
  const highlightQueue = useRef(Promise.resolve());

  // В классе состояние приходит коротким опросом. Обновляем подсветки,
  // не перемонтируя весь урок: выбранная вкладка и режим выделения при
  // этом остаются на месте.
  useEffect(() => {
    if (teacher) return;
    const frame = requestAnimationFrame(() => {
      marksRef.current = data.assignment.highlights;
      setMarks(data.assignment.highlights);
      setBritish(data.showBritish);
      setVocabularyReveal(data.vocabularyReveal);
    });
    return () => cancelAnimationFrame(frame);
  }, [data.assignment.highlights, data.showBritish, data.vocabularyReveal, teacher]);

  const pullPresentationState = async () => {
    const next = await lessonPresentationStateAction(data.assignment.id);
    if (!next) return;
    marksRef.current = next.highlights;
    setMarks(next.highlights);
    setVocabularyReveal(next.vocabularyReveal);
    setBritish(next.showBritish);
  };

  useRealtimeSubscription({
    channel: !teacher && liveClass ? `class:${data.assignment.studentId}` : null,
    events: "lesson",
    onMessage: pullPresentationState,
    onFallback: pullPresentationState,
    fallbackMs: 1_000,
    enabled: !teacher && liveClass && !presentationManaged,
  });

  const changeVocabularyReveal = (next: LessonVocabularyReveal) => {
    setVocabularyReveal(next);
    if (!teacher || !liveClass) return;
    revealQueue.current = revealQueue.current.then(async () => {
      const result = await setLessonVocabularyRevealAction(data.assignment.id, next);
      if (result.error) {
        const stored = await lessonVocabularyRevealAction(data.assignment.id);
        if (stored) setVocabularyReveal(stored);
      }
    });
  };

  /*
   * Подсветка ставится сразу, а на сервер уходит следом: ждать ответа
   * посреди объяснения — это пауза на ровном месте.
   */
  const pick = (key: string) => {
    const next = toggleWordFocus(marksRef.current, key);
    marksRef.current = next;
    setMarks(next);
    startBusy(() => focusLessonWordAction(data.assignment.id, key).then(() => undefined));
  };

  const persistHighlights = (next: Record<string, string>) => {
    const layer = dialogueHighlights(next);
    highlightQueue.current = highlightQueue.current.then(async () => {
      await setLessonHighlightsAction(data.assignment.id, layer);
    });
    startBusy(() => highlightQueue.current);
  };

  const commitHighlights = (next: Record<string, string>) => {
    marksRef.current = next;
    setMarks(next);
    persistHighlights(next);
  };

  const highlight = (key: string | string[]) => {
    const keys = Array.isArray(key) ? key : [key];
    if (keys.length === 0) return;
    const previousLayer = dialogueHighlights(marksRef.current);
    const remove = keys.every((entry) => previousLayer[entry] === highlightColor);
    let next = marksRef.current;
    for (const entry of keys) {
      if (remove) {
        const layer = dialogueHighlights(next);
        delete layer[entry];
        next = replaceLessonHighlights(next, layer);
      } else if (dialogueHighlights(next)[entry] !== highlightColor) {
        next = toggleLessonHighlight(next, entry, highlightColor);
      }
    }
    if (JSON.stringify(previousLayer) === JSON.stringify(dialogueHighlights(next))) return;
    highlightHistory.current.push(previousLayer);
    setHighlightHistorySize(highlightHistory.current.length);
    commitHighlights(next);
  };

  const undoHighlight = () => {
    const previousLayer = highlightHistory.current.pop();
    if (!previousLayer) return;
    setHighlightHistorySize(highlightHistory.current.length);
    commitHighlights(replaceLessonHighlights(marksRef.current, previousLayer));
  };

  const clearHighlights = () => {
    const currentLayer = dialogueHighlights(marksRef.current);
    if (Object.keys(currentLayer).length === 0) return;
    highlightHistory.current.push(currentLayer);
    setHighlightHistorySize(highlightHistory.current.length);
    commitHighlights(clearLessonHighlights(marksRef.current));
  };

  const toggleBritish = () => {
    const next = !british;
    setBritish(next);
    startBusy(async () => {
      const result = await showBritishAction(data.assignment.id, next);
      if (result.error) setBritish(!next);
    });
  };

  const selectLexis = (groupId: string) => {
    const next = selectLexisGroup(marksRef.current, groupId);
    marksRef.current = next;
    setMarks(next);
    startBusy(() =>
      selectLessonLexisGroupAction(data.assignment.id, groupId).then(() => undefined),
    );
  };

  // Saved highlights are content; navigation focus exists only as the latest
  // live-class command and must not survive a student page reload.
  const focus = teacher
    ? lessonFocus(marks)
    : liveClass
      ? (sectionFocus?.elementId ?? null)
      : null;
  const dialogueMarks = dialogueHighlights(marks);
  const lexisGroup = selectedLexisGroup(marks);
  const topic = (
    <header
      data-lesson-highlight-scope="lesson-topic"
      className="overflow-hidden rounded-2xl border border-line bg-gradient-to-r from-accent-soft via-surface to-surface px-4 py-3 shadow-sm sm:px-5 sm:py-4"
    >
      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-accent">
        {t.lessonUnits.topic}
      </p>
      <div className="mt-1 flex items-center gap-3">
        <h1 className="min-w-0 flex-1 text-xl font-black leading-tight text-content sm:text-2xl">
          {data.lesson.title}
        </h1>
        {teacher && (
          <button
            type="button"
            onClick={() => setEditingLesson(true)}
            className="flex h-9 shrink-0 items-center gap-1.5 rounded-xl bg-accent px-3 text-[11px] font-black text-white shadow-sm transition hover:brightness-95"
          >
            <IconPencil className="h-3.5 w-3.5" />
            Edit lesson
          </button>
        )}
      </div>
    </header>
  );
  const liveEditor = teacher && editingLesson ? (
    <LiveLessonEditor
      assignmentId={data.assignment.id}
      studentName={data.assignment.studentName}
      lesson={data.lesson}
      onClose={() => setEditingLesson(false)}
      onSaved={onLessonSaved}
    />
  ) : null;
  const highlightToolbar = teacher ? (
    <div
      data-no-lesson-highlight
      className="sticky top-20 z-30 flex flex-wrap items-center gap-2 rounded-xl border border-line bg-surface-2/95 px-3 py-2 shadow-lg backdrop-blur-md"
    >
      <span className="mr-auto text-[12px] font-semibold text-muted">
        {highlightMode
          ? t.lessonUnits.highlightModeHint
          : t.interactiveHomework.reviewHighlightOffHint}
      </span>
      <button
        type="button"
        onClick={() => setHighlightMode((value) => !value)}
        aria-pressed={highlightMode}
        className={cn(
          "flex h-9 items-center gap-1.5 rounded-lg px-3 text-[11px] font-bold ring-1 transition",
          highlightMode
            ? "bg-yellow-300 text-slate-950 ring-yellow-500 shadow-sm"
            : "bg-surface text-muted ring-line hover:text-content hover:ring-accent/50",
        )}
      >
        <span aria-hidden>🖍️</span>
        {t.lessonUnits.highlightMode}
      </button>
      <div className={cn(
        "flex items-center gap-1 rounded-lg bg-surface p-1 ring-1 ring-line transition",
        !highlightMode && "opacity-45",
      )}>
        {(["yellow", "green", "red"] as const).map((color) => (
          <button
            key={color}
            type="button"
            disabled={!highlightMode}
            onClick={() => setHighlightColor(color)}
            aria-pressed={highlightMode && highlightColor === color}
            aria-label={
              color === "yellow"
                ? t.lessonUnits.highlightYellow
                : color === "green"
                  ? t.lessonUnits.highlightGreen
                  : t.interactiveHomework.highlightRed
            }
            title={
              color === "yellow"
                ? t.lessonUnits.highlightYellow
                : color === "green"
                  ? t.lessonUnits.highlightGreen
                  : t.interactiveHomework.highlightRed
            }
            className={cn(
              "h-5 w-5 rounded-full transition enabled:hover:scale-110 disabled:cursor-default",
              color === "yellow"
                ? "bg-yellow-300"
                : color === "green"
                  ? "bg-emerald-400"
                  : "bg-rose-500",
              highlightMode && highlightColor === color
                ? "ring-2 ring-accent ring-offset-2 ring-offset-surface"
                : "ring-1 ring-black/10",
            )}
          />
        ))}
      </div>
      <button
        type="button"
        disabled={busy || highlightHistorySize === 0}
        onClick={undoHighlight}
        className="flex h-9 items-center gap-1.5 rounded-lg bg-surface px-3 text-[11px] font-bold text-muted ring-1 ring-line transition hover:text-content disabled:cursor-not-allowed disabled:opacity-40"
        title={t.lessonUnits.highlightUndoHint}
      >
        <IconReset className="h-3.5 w-3.5" />
        {t.lessonUnits.highlightUndo}
      </button>
      <button
        type="button"
        disabled={busy || Object.keys(dialogueHighlights(marks)).length === 0}
        onClick={clearHighlights}
        className="flex h-9 items-center gap-1.5 rounded-lg bg-surface px-3 text-[11px] font-bold text-muted ring-1 ring-line transition hover:bg-rose-50 hover:text-rose-600 hover:ring-rose-200 disabled:cursor-not-allowed disabled:opacity-40 dark:hover:bg-rose-950/30"
        title={t.lessonUnits.highlightClearHint}
      >
        <IconTrash className="h-3.5 w-3.5" />
        {t.lessonUnits.highlightClear}
      </button>
      <button
        type="button"
        disabled={busy}
        onClick={toggleBritish}
        aria-pressed={british}
        className={cn(
          "flex h-9 items-center gap-1.5 rounded-lg px-3 text-[11px] font-semibold transition disabled:opacity-50",
          british
            ? "bg-accent text-white"
            : "bg-surface text-muted ring-1 ring-line hover:text-content",
        )}
      >
        <IconVolume className="h-3.5 w-3.5" />
        {t.lessonUnits.showBritish}
      </button>
    </div>
  ) : null;

  if (data.lesson.kind === "REGULAR") {
    return (
      <LessonTextHighlighter
        marks={marks}
        enabled={teacher && highlightMode}
        color={highlightColor}
        onHighlight={teacher ? highlight : undefined}
      >
        <div className="flex flex-col gap-4">
          {topic}
          {highlightToolbar}
          {liveEditor}
          <RegularLessonView
          sections={data.lesson.regularSections}
          teacher={teacher}
          open={data.open}
          lockClosed={liveClass && !teacher}
          sectionFocus={liveClass && !teacher ? sectionFocus : null}
          sectionVisibilityBusy={sectionVisibilityBusy}
          onSectionVisibilityChange={onSectionVisibilityChange}
          onFocusElement={teacher && liveClass
            ? (section, elementId) => {
                startBusy(() =>
                  focusRegularLessonElementAction(
                    data.assignment.id,
                    section,
                    elementId,
                  ).then(() => undefined),
                );
              }
            : undefined}
          assignmentId={data.assignment.id}
          responses={data.answers}
          onSaveResponse={(key, value) => answerAction(data.assignment.id, key, value)}
          onSubmitAnswer={(sectionId, responseId, value) =>
            submitRegularLessonAnswerAction(
              data.assignment.id,
              sectionId,
              responseId,
              value,
            )
          }
          words={data.lesson.words}
          unitId={data.lesson.id}
          lessonTitle={data.lesson.title}
          defaultStudentId={data.assignment.studentId}
          vocabularyHighlights={marks}
          vocabularyFocus={focus}
          onPickVocabulary={teacher ? pick : undefined}
          showBritish={british}
          canRevealVocabulary={teacher || !liveClass}
          vocabularyReveal={liveClass ? vocabularyReveal : undefined}
          onVocabularyRevealChange={
            liveClass && teacher ? changeVocabularyReveal : undefined
          }
          homeworkPlan={data.lesson.interactiveHomework}
          homeworkSession={{
            assignmentId: data.assignment.id,
            unitId: data.assignment.unitId,
            teacher,
            state: data.answers,
            canAssign: teacher,
            canEdit: teacher,
            liveClass,
            studentId: data.assignment.studentId,
          }}
          onFocusHomework={teacher && liveClass
            ? (elementId) => {
                startBusy(() =>
                  focusHomeworkElementAction(data.assignment.id, elementId).then(() => undefined),
                );
              }
            : undefined}
          />
        </div>
      </LessonTextHighlighter>
    );
  }
  const activitySectionFocus =
    sectionFocus && LESSON_SECTIONS.includes(sectionFocus.section as (typeof LESSON_SECTIONS)[number])
      ? { ...sectionFocus, section: sectionFocus.section as (typeof LESSON_SECTIONS)[number] }
      : null;
  const lessonSections = lessonSectionsForKind(data.lesson.kind);

  return (
    <LessonTextHighlighter
      marks={marks}
      enabled={teacher && highlightMode}
      color={highlightColor}
      onHighlight={teacher ? highlight : undefined}
    >
      <div className="flex flex-col gap-4">
        {topic}
        {highlightToolbar}
        {liveEditor}

      {/* В классе ученик видит все вкладки, но сам открывает только разрешённые. */}
      <LessonView
        lesson={data.lesson}
        teacher={teacher}
        defaultStudentId={data.assignment.studentId}
        initialSection={initialSection}
        open={
          teacher || liveClass
            ? lessonSections
            : data.open.filter((section) => lessonSections.includes(section as (typeof LESSON_SECTIONS)[number])) as (typeof LESSON_SECTIONS)[number][]
        }
        closed={
          teacher || liveClass
            ? lessonSections.filter((s) => !data.open.includes(s))
            : undefined
        }
        lockClosed={liveClass && !teacher}
        sectionFocus={liveClass && !teacher ? activitySectionFocus : null}
        sectionVisibilityBusy={sectionVisibilityBusy}
        onSectionVisibilityChange={onSectionVisibilityChange}
        highlights={dialogueMarks}
        focus={focus}
        showBritish={british}
        canRevealVocabulary={teacher || !liveClass}
        vocabularyReveal={liveClass ? vocabularyReveal : undefined}
        onVocabularyRevealChange={
          liveClass && teacher ? changeVocabularyReveal : undefined
        }
        selectedLexisId={lexisGroup}
        onSelectLexis={teacher ? selectLexis : undefined}
        onPick={teacher ? pick : undefined}
        highlightColor={highlightColor}
        onFocusHomework={teacher && liveClass
          ? (elementId) => {
              startBusy(() =>
                focusHomeworkElementAction(data.assignment.id, elementId).then(() => undefined),
              );
            }
          : undefined}
        homeworkSession={{
          assignmentId: data.assignment.id,
          unitId: data.assignment.unitId,
          teacher,
          state: data.answers,
          canAssign: teacher,
          canEdit: teacher,
          liveClass,
          studentId: data.assignment.studentId,
        }}
        videoSession={
          liveClass
            ? {
                assignmentId: data.assignment.id,
                teacher,
                state: classVideo ?? null,
              }
            : undefined
        }
        />
      </div>
    </LessonTextHighlighter>
  );
}
