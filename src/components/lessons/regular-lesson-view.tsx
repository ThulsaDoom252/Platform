"use client";

import { useEffect, useMemo, useState } from "react";
import { useT } from "@/components/i18n-provider";
import { IconEyeOff } from "@/components/icons";
import { regularSectionKey, type RegularLessonSection } from "@/lib/regular-lesson";
import { cn } from "@/lib/utils";

export function RegularLessonView({
  sections,
  teacher,
  open,
  lockClosed = false,
  sectionFocus,
}: {
  sections: RegularLessonSection[];
  teacher: boolean;
  open: string[];
  lockClosed?: boolean;
  sectionFocus?: { section: string; at: string } | null;
}) {
  const { t } = useT();
  const available = useMemo(
    () => sections.filter((section) => teacher || !section.teacherOnly),
    [sections, teacher],
  );
  const first =
    available.find((section) => teacher || open.includes(regularSectionKey(section.id))) ??
    available[0];
  const [activeId, setActiveId] = useState(first?.id ?? "");
  const [answersFor, setAnswersFor] = useState<string | null>(null);

  useEffect(() => {
    if (!sectionFocus?.section) return;
    const focused = available.find(
      (section) => regularSectionKey(section.id) === sectionFocus.section,
    );
    if (!focused) return;
    const frame = requestAnimationFrame(() => setActiveId(focused.id));
    return () => cancelAnimationFrame(frame);
  }, [available, sectionFocus?.at, sectionFocus?.section]);

  const active = available.find((section) => section.id === activeId) ?? first;
  if (!active) return null;
  const showingAnswers = teacher && answersFor === active.id;

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <nav className="flex gap-2 overflow-x-auto pb-1" aria-label={t.lessonUnits.lessonSections}>
        {available.map((section) => {
          const key = regularSectionKey(section.id);
          const opened = teacher || open.includes(key);
          const forced = sectionFocus?.section === key;
          const disabled = lockClosed && !opened && !forced;
          return (
            <button
              key={section.id}
              type="button"
              disabled={disabled}
              onClick={() => !disabled && setActiveId(section.id)}
              className={cn(
                "flex h-10 shrink-0 items-center gap-1.5 rounded-xl px-3 text-[12px] font-bold transition",
                active.id === section.id
                  ? "bg-accent text-white shadow-sm"
                  : "bg-surface-2 text-muted hover:text-content",
                disabled && "cursor-not-allowed opacity-55",
              )}
            >
              {disabled && <IconEyeOff className="h-3.5 w-3.5" />}
              {section.title}
            </button>
          );
        })}
      </nav>

      <article className={cn("regular-lesson-content", `regular-tone-${active.tone}`)}>
        <div className="regular-lesson-heading">
          <h2>{active.title}</h2>
          {teacher && active.teacherHtml !== active.studentHtml && !active.teacherOnly && (
            <button
              type="button"
              onClick={() => setAnswersFor(showingAnswers ? null : active.id)}
              className={cn(
                "h-9 shrink-0 rounded-xl px-3 text-[12px] font-bold transition",
                showingAnswers
                  ? "bg-emerald-500 text-white"
                  : "bg-surface text-accent ring-1 ring-line hover:ring-accent",
              )}
            >
              {showingAnswers ? t.lessonUnits.hideAnswers : t.lessonUnits.showAnswers}
            </button>
          )}
        </div>
        <div
          className="regular-lesson-body"
          dangerouslySetInnerHTML={{
            __html: showingAnswers || active.teacherOnly
              ? active.teacherHtml
              : active.studentHtml,
          }}
        />
      </article>
    </div>
  );
}
