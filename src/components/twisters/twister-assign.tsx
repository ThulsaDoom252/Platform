"use client";

/**
 * Закрепить скороговорку за учеником.
 *
 * Предупреждение о повторе считается до выбора, а не после: узнать, что
 * ту же карточку уже давали трижды, нужно прежде чем нажать, иначе
 * предупреждение бесполезно. Поэтому счётчик стоит у каждого имени.
 */
import { useEffect, useState, useTransition } from "react";
import { Avatar } from "@/components/avatar";
import { useT } from "@/components/i18n-provider";
import { fmt } from "@/lib/i18n";
import {
  assignTwisterAction,
  twisterSeenByStudentAction,
  twisterStudentsAction,
  type Twister,
  type TwisterSeen,
  type TwisterStudent,
} from "@/lib/actions/tongue-twisters";
import { repeatWarning } from "@/lib/twisters";
import { IconCheck, IconX } from "@/components/icons";
import { cn } from "@/lib/utils";

export function TwisterAssign({
  twister,
  onClose,
  onDone,
}: {
  twister: Twister;
  onClose: () => void;
  onDone: () => void;
}) {
  const { t, locale } = useT();
  const [students, setStudents] = useState<TwisterStudent[] | null>(null);
  const [seen, setSeen] = useState<Record<string, TwisterSeen>>({});
  const [done, setDone] = useState<string | null>(null);
  const [busy, startBusy] = useTransition();

  const when = new Intl.DateTimeFormat(locale === "en" ? "en-GB" : locale, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  useEffect(() => {
    let alive = true;
    Promise.all([twisterStudentsAction(), twisterSeenByStudentAction(twister.id)])
      .then(([list, counts]) => {
        if (!alive) return;
        setStudents(list);
        setSeen(counts);
      })
      .catch(() => alive && setStudents([]));
    return () => {
      alive = false;
    };
  }, [twister.id]);

  function assign(studentId: string) {
    startBusy(async () => {
      await assignTwisterAction(twister.id, studentId);
      setDone(studentId);
      setSeen((prev) => {
        const was = prev[studentId];
        return {
          ...prev,
          [studentId]: {
            times: (was?.times ?? 0) + 1,
            lastAt: new Date().toISOString(),
          },
        };
      });
      onDone();
    });
  }

  return (
    <div
      className="fixed inset-0 z-40 flex items-end justify-center bg-black/50 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl bg-surface ring-1 ring-line sm:rounded-2xl"
      >
        <div className="flex items-center gap-3 border-b border-line px-4 py-3">
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-bold text-content">
              {fmt(t.twisters.assignTo, {
                title: twister.title || t.twisters.untitled,
              })}
            </span>
            <span className="block text-[12px] text-faint">{t.twisters.chooseStudent}</span>
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label={t.common.close}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-faint transition hover:bg-surface-2 hover:text-content"
          >
            <IconX className="h-4 w-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-2">
          {students === null && <p className="p-3 text-sm text-faint">{t.common.loading}</p>}

          {(students ?? []).map((student) => {
            const warn = repeatWarning(seen[student.id]);
            const justDone = done === student.id;

            return (
              <button
                key={student.id}
                type="button"
                disabled={busy}
                onClick={() => assign(student.id)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left transition disabled:opacity-60",
                  justDone ? "bg-accent-soft" : "hover:bg-surface-2",
                )}
              >
                <Avatar
                  name={student.name}
                  src={student.avatarUrl}
                  className="h-9 w-9 shrink-0 text-[11px]"
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-content">
                    {student.name}
                  </span>
                  {warn && (
                    <span className="mt-0.5 block text-[11px] text-[color:var(--lesson-amber,#d97706)]">
                      {fmt(t.twisters.seenBefore, {
                        n: warn.times,
                        date: warn.lastAt ? when.format(new Date(warn.lastAt)) : "—",
                      })}
                    </span>
                  )}
                </span>

                {justDone ? (
                  <span className="flex shrink-0 items-center gap-1 text-[12px] font-semibold text-accent">
                    <IconCheck className="h-4 w-4" /> {t.twisters.assigned}
                  </span>
                ) : (
                  warn && (
                    <span className="tint-amber shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold">
                      {fmt(t.twisters.seenShort, { n: warn.times })}
                    </span>
                  )
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
