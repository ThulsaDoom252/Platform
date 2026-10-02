"use client";

/**
 * Выдача урока ученикам и управление тем, что ему открыто.
 *
 * Закрепление — это копия состояния, а не урока: открытые секции и
 * подсветки живут здесь, заготовка не меняется. Поэтому один урок
 * выдаётся скольким угодно, и у каждого своя история.
 */
import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useT } from "@/components/i18n-provider";
import {
  openSectionAction,
  pinLessonAction,
  studentLessonsAction,
  unpinLessonAction,
  type LessonAssignmentCard,
  type LessonKind,
} from "@/lib/actions/lessons";
import { lessonSectionsForKind, type LessonSection } from "@/lib/lesson-unit";
import { regularSectionKey, type RegularLessonSection } from "@/lib/regular-lesson";
import { Avatar } from "@/components/avatar";
import { IconCheck, IconChevronRight, IconTrash } from "@/components/icons";
import { cn } from "@/lib/utils";

export function LessonPin({
  unitId,
  students,
  kind,
  regularSections,
}: {
  unitId: string;
  students: { id: string; name: string; avatarUrl: string | null }[];
  kind: LessonKind;
  regularSections: RegularLessonSection[];
}) {
  const { t } = useT();
  const [given, setGiven] = useState<LessonAssignmentCard[]>([]);
  const [busy, startBusy] = useTransition();

  /* Кому урок уже выдан — собираем по всем ученикам сразу. */
  const reload = async () => {
    const lists = await Promise.all(students.map((s) => studentLessonsAction(s.id)));
    setGiven(lists.flat().filter((a) => a.unitId === unitId));
  };

  useEffect(() => {
    let alive = true;
    Promise.all(students.map((s) => studentLessonsAction(s.id)))
      .then((lists) => {
        if (alive) setGiven(lists.flat().filter((a) => a.unitId === unitId));
      })
      .catch(() => {
        /* пусто — значит ещё никому */
      });
    return () => {
      alive = false;
    };
  }, [unitId, students]);

  const cardOf = (studentId: string) => given.find((a) => a.studentId === studentId);

  const LABEL: Record<LessonSection, string> = {
    vocab: t.lessonUnits.secVocab,
    lexis: t.lessonUnits.secLexis,
    video: t.lessonUnits.secVideo,
    transcript: t.lessonUnits.secTranscript,
    questions: t.lessonUnits.secQuestions,
    homework: t.lessonUnits.secHomework,
  };
  const controlledSections = kind === "REGULAR"
    ? regularSections
        .filter((section) => !section.teacherOnly)
        .map((section) => ({ key: regularSectionKey(section.id), label: section.title }))
    : lessonSectionsForKind(kind).map((section) => ({ key: section, label: LABEL[section] }));

  return (
    <section className="rounded-2xl bg-surface p-4 ring-1 ring-line shadow-sm sm:p-5">
      <p className="text-sm font-bold text-content">{t.lessonUnits.pinTo}</p>
      {kind !== "REGULAR" && (
        <p className="mt-0.5 text-[12px] text-faint">{t.lessonUnits.onlyVocabAtFirst}</p>
      )}

      <div className="mt-3 flex flex-col gap-2">
        {students.map((s) => {
          const card = cardOf(s.id);

          return (
            <div
              key={s.id}
              className={cn(
                "flex flex-wrap items-center gap-2 rounded-xl p-2.5 ring-1 transition",
                card ? "bg-accent-soft ring-accent" : "bg-surface-2 ring-transparent",
              )}
            >
              <Avatar name={s.name} src={s.avatarUrl} className="h-8 w-8 text-[11px]" />
              <span className="text-[13px] font-semibold text-content">{s.name}</span>

              {card ? (
                <>
                  {/* Что открыто ученику. Словник закрыть нельзя. */}
                  <span className="ml-2 flex flex-wrap items-center gap-1">
                    {controlledSections.map(({ key: section, label }) => {
                      const always = kind !== "REGULAR" && section === "vocab";
                      const on = always || card.openSections.includes(section);

                      return (
                        <button
                          key={section}
                          type="button"
                          disabled={busy || always}
                          onClick={() =>
                            startBusy(async () => {
                              await openSectionAction(card.id, section, !on);
                              await reload();
                            })
                          }
                          title={always ? t.lessonUnits.onlyVocabAtFirst : label}
                          className={cn(
                            "flex h-7 items-center gap-1 rounded-lg px-2 text-[11px] font-semibold transition",
                            on
                              ? "bg-accent text-white"
                              : "bg-surface text-muted hover:text-content",
                            always && "opacity-70",
                          )}
                        >
                          {on && <IconCheck className="h-3 w-3" />}
                          {label}
                        </button>
                      );
                    })}
                  </span>

                  <Link
                    href={`/teacher/lessons/given/${card.id}`}
                    className="ml-auto flex h-8 items-center gap-1 rounded-lg border border-line px-2.5 text-[12px] font-semibold text-content transition hover:border-accent hover:text-accent"
                  >
                    {t.lessonUnits.open}
                    <IconChevronRight className="h-3.5 w-3.5" />
                  </Link>

                  <button
                    type="button"
                    disabled={busy}
                    title={t.lessonUnits.remove}
                    onClick={() =>
                      startBusy(async () => {
                        await unpinLessonAction(card.id);
                        await reload();
                      })
                    }
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-faint transition hover:bg-surface hover:text-rose-500"
                  >
                    <IconTrash className="h-3.5 w-3.5" />
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    startBusy(async () => {
                      await pinLessonAction(unitId, s.id);
                      await reload();
                    })
                  }
                  className="ml-auto h-8 rounded-lg bg-accent px-3 text-[12px] font-bold text-white transition hover:opacity-90 disabled:opacity-50"
                >
                  {t.lessonUnits.pinTo}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
