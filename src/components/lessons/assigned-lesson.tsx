"use client";

/**
 * Выданный урок: то же содержимое, разные права.
 *
 * Ученик читает. Учитель тыкает по слову — у ученика остаётся один
 * фокус в цвете его собственной темы. Правится закрепление, а не урок.
 */
import { useEffect, useState, useTransition } from "react";
import { useT } from "@/components/i18n-provider";
import {
  focusLessonWordAction,
  highlightLessonDialogueAction,
  selectLessonLexisGroupAction,
  showBritishAction,
} from "@/lib/actions/lessons";
import type { LessonAssignmentCard, LessonView as Lesson } from "@/lib/actions/lessons";
import {
  LESSON_SECTIONS,
  lessonFocus,
  selectLexisGroup,
  selectedLexisGroup,
  toggleDialogueHighlight,
  toggleWordFocus,
  yellowHighlights,
  type LessonSection,
} from "@/lib/lesson-unit";
import { LessonView } from "@/components/lessons/lesson-view";
import { IconVolume } from "@/components/icons";
import { cn } from "@/lib/utils";
import type { ClassVideoState } from "@/lib/class-video";

export function AssignedLesson({
  data,
  teacher,
  classVideo,
  liveClass = false,
}: {
  data: {
    assignment: LessonAssignmentCard;
    lesson: Lesson;
    answers: Record<string, string>;
    open: LessonSection[];
    showBritish: boolean;
  };
  teacher: boolean;
  /** Есть только внутри живого класса; вне класса видео остаётся обычным. */
  classVideo?: ClassVideoState | null;
  liveClass?: boolean;
}) {
  const { t } = useT();
  const [marks, setMarks] = useState(data.assignment.highlights);
  const [british, setBritish] = useState(data.showBritish);
  const [highlightMode, setHighlightMode] = useState(false);
  const [busy, startBusy] = useTransition();

  // В классе состояние приходит коротким опросом. Обновляем подсветки,
  // не перемонтируя весь урок: выбранная вкладка и режим выделения при
  // этом остаются на месте.
  useEffect(() => {
    if (teacher) return;
    const frame = requestAnimationFrame(() => {
      setMarks(data.assignment.highlights);
      setBritish(data.showBritish);
    });
    return () => cancelAnimationFrame(frame);
  }, [data.assignment.highlights, data.showBritish, teacher]);

  /*
   * Подсветка ставится сразу, а на сервер уходит следом: ждать ответа
   * посреди объяснения — это пауза на ровном месте.
   */
  const pick = (key: string) => {
    setMarks((prev) => toggleWordFocus(prev, key));
    startBusy(() => focusLessonWordAction(data.assignment.id, key).then(() => undefined));
  };

  const highlight = (key: string) => {
    setMarks((prev) => toggleDialogueHighlight(prev, key));
    startBusy(() =>
      highlightLessonDialogueAction(data.assignment.id, key).then(() => undefined),
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

  const focus = lessonFocus(marks);
  const yellow = yellowHighlights(marks);
  const lexisGroup = selectedLexisGroup(marks);

  return (
    <div className="flex flex-col gap-4">
      {teacher && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl bg-surface-2 px-3 py-2">
          <span className="mr-auto text-[12px] font-semibold text-muted">
            {highlightMode
              ? t.lessonUnits.highlightModeHint
              : t.lessonUnits.focusWordHint}
          </span>
          <button
            type="button"
            onClick={() => setHighlightMode((value) => !value)}
            aria-pressed={highlightMode}
            className={cn(
              "flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-[11px] font-semibold ring-1 transition",
              highlightMode
                ? "bg-yellow-300 text-slate-950 ring-yellow-500"
                : "bg-surface text-muted ring-line hover:text-content",
            )}
          >
            <span aria-hidden>🖍️</span>
            {t.lessonUnits.highlightMode}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={toggleBritish}
            aria-pressed={british}
            className={cn(
              "flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-[11px] font-semibold transition disabled:opacity-50",
              british
                ? "bg-accent text-white"
                : "bg-surface text-muted ring-1 ring-line hover:text-content",
            )}
          >
            <IconVolume className="h-3.5 w-3.5" />
            {t.lessonUnits.showBritish}
          </button>
        </div>
      )}

      {/* Учителю видны все секции, ученику — только открытые ему. */}
      <LessonView
        lesson={data.lesson}
        open={
          teacher
            ? [...LESSON_SECTIONS]
            : data.open.filter((section) => section !== "homework")
        }
        closed={
          teacher ? LESSON_SECTIONS.filter((s) => !data.open.includes(s)) : undefined
        }
        highlights={yellow}
        focus={focus}
        showBritish={british}
        canRevealVocabulary={teacher || !liveClass}
        selectedLexisId={lexisGroup}
        onSelectLexis={teacher ? selectLexis : undefined}
        onPick={teacher ? pick : undefined}
        highlightMode={teacher && highlightMode}
        onHighlight={teacher ? highlight : undefined}
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
  );
}
