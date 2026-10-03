"use client";

/**
 * Выданный урок: то же содержимое, разные права.
 *
 * Ученик читает. Учитель тыкает по слову — у ученика остаётся один
 * фокус в цвете его собственной темы. Правится закрепление, а не урок.
 */
import { useEffect, useRef, useState, useTransition } from "react";
import { useT } from "@/components/i18n-provider";
import {
  answerAction,
  focusHomeworkElementAction,
  focusLessonWordAction,
  focusRegularLessonElementAction,
  highlightLessonTextAction,
  lessonVocabularyRevealAction,
  selectLessonLexisGroupAction,
  setLessonVocabularyRevealAction,
  showBritishAction,
  submitRegularLessonAnswerAction,
} from "@/lib/actions/lessons";
import type { LessonAssignmentCard, LessonView as Lesson } from "@/lib/actions/lessons";
import {
  LESSON_SECTIONS,
  lessonSectionsForKind,
  lessonFocus,
  selectLexisGroup,
  selectedLexisGroup,
  toggleLessonHighlight,
  toggleWordFocus,
  dialogueHighlights,
  type HighlightColor,
  type LessonVocabularyReveal,
} from "@/lib/lesson-unit";
import { LessonView } from "@/components/lessons/lesson-view";
import { RegularLessonView } from "@/components/lessons/regular-lesson-view";
import { LessonTextHighlighter } from "@/components/lessons/lesson-text-highlighter";
import { IconVolume } from "@/components/icons";
import { cn } from "@/lib/utils";
import type { ClassVideoState } from "@/lib/class-video";

export function AssignedLesson({
  data,
  teacher,
  classVideo,
  sectionFocus,
  sectionVisibilityBusy = false,
  onSectionVisibilityChange,
  liveClass = false,
  initialSection,
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
  initialSection?: (typeof LESSON_SECTIONS)[number];
}) {
  const { t } = useT();
  const [marks, setMarks] = useState(data.assignment.highlights);
  const [british, setBritish] = useState(data.showBritish);
  const [highlightMode, setHighlightMode] = useState(false);
  const [highlightColor, setHighlightColor] = useState<HighlightColor>("yellow");
  const [vocabularyReveal, setVocabularyReveal] = useState(data.vocabularyReveal);
  const [busy, startBusy] = useTransition();
  const revealQueue = useRef(Promise.resolve());

  // В классе состояние приходит коротким опросом. Обновляем подсветки,
  // не перемонтируя весь урок: выбранная вкладка и режим выделения при
  // этом остаются на месте.
  useEffect(() => {
    if (teacher) return;
    const frame = requestAnimationFrame(() => {
      setMarks(data.assignment.highlights);
      setBritish(data.showBritish);
      setVocabularyReveal(data.vocabularyReveal);
    });
    return () => cancelAnimationFrame(frame);
  }, [data.assignment.highlights, data.showBritish, data.vocabularyReveal, teacher]);

  useEffect(() => {
    if (teacher || !liveClass) return;
    let alive = true;
    let pulling = false;
    const pull = async () => {
      if (pulling) return;
      pulling = true;
      try {
        const next = await lessonVocabularyRevealAction(data.assignment.id);
        if (alive && next) setVocabularyReveal(next);
      } finally {
        pulling = false;
      }
    };
    const timer = window.setInterval(() => void pull(), 500);
    return () => {
      alive = false;
      window.clearInterval(timer);
    };
  }, [data.assignment.id, liveClass, teacher]);

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
    setMarks((prev) => toggleWordFocus(prev, key));
    startBusy(() => focusLessonWordAction(data.assignment.id, key).then(() => undefined));
  };

  const highlight = (key: string) => {
    setMarks((prev) => toggleLessonHighlight(prev, key, highlightColor));
    startBusy(() =>
      highlightLessonTextAction(data.assignment.id, key, highlightColor).then(() => undefined),
    );
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
    setMarks((prev) => selectLexisGroup(prev, groupId));
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
      <h1 className="mt-1 text-xl font-black leading-tight text-content sm:text-2xl">
        {data.lesson.title}
      </h1>
    </header>
  );
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
