"use client";

/**
 * Выданный урок: то же содержимое, разные права.
 *
 * Ученик читает. Учитель выбирает цвет и тыкает по месту — слову
 * словника, реплике или слову в реплике. Правится закрепление, а не
 * урок: у каждого ученика подчёркнуто своё, заготовка не меняется.
 */
import { useState, useTransition } from "react";
import { useT } from "@/components/i18n-provider";
import { highlightAction } from "@/lib/actions/lessons";
import type { LessonAssignmentCard, LessonView as Lesson } from "@/lib/actions/lessons";
import { HIGHLIGHTS, type HighlightColor, type LessonSection } from "@/lib/lesson-unit";
import { LessonView } from "@/components/lessons/lesson-view";
import { cn } from "@/lib/utils";

/** Кружки выбора цвета — в тот же цвет, что и подсветка. */
const DOT: Record<HighlightColor, string> = {
  red: "bg-rose-500",
  amber: "bg-amber-400",
  green: "bg-emerald-500",
  sky: "bg-sky-500",
  violet: "bg-violet-500",
};

export function AssignedLesson({
  data,
  teacher,
}: {
  data: {
    assignment: LessonAssignmentCard;
    lesson: Lesson;
    answers: Record<string, string>;
    open: LessonSection[];
  };
  teacher: boolean;
}) {
  const { t } = useT();
  const [marks, setMarks] = useState(data.assignment.highlights);
  const [color, setColor] = useState<HighlightColor>("red");
  const [, startBusy] = useTransition();

  /*
   * Подсветка ставится сразу, а на сервер уходит следом: ждать ответа
   * посреди объяснения — это пауза на ровном месте.
   */
  const pick = (key: string) => {
    setMarks((prev) => {
      const next = { ...prev };
      if (next[key] === color) delete next[key];
      else next[key] = color;
      return next;
    });
    startBusy(() => highlightAction(data.assignment.id, key, color).then(() => undefined));
  };

  return (
    <div className="flex flex-col gap-4">
      {teacher && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl bg-surface-2 px-3 py-2">
          <span className="text-[12px] font-semibold text-muted">
            {t.lessonUnits.openForStudent}
          </span>
          {HIGHLIGHTS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setColor(c)}
              aria-label={c}
              className={cn(
                "h-6 w-6 rounded-full ring-2 transition",
                DOT[c],
                color === c ? "ring-content" : "ring-transparent hover:ring-line",
              )}
            />
          ))}
        </div>
      )}

      <LessonView
        lesson={data.lesson}
        open={data.open}
        highlights={marks}
        onPick={teacher ? pick : undefined}
      />
    </div>
  );
}
