"use client";

/**
 * Страница скриптов: слева уроки, справа тот, что выбран.
 *
 * Список идёт от ближайшего занятия назад — готовятся всегда к
 * следующему уроку. Видно, к каким дням скрипт уже написан: по значку и
 * по первой строке текста.
 */
import { useEffect, useState, useTransition } from "react";
import { Avatar } from "@/components/avatar";
import {
  getScriptAction,
  type ScriptDoc,
  type ScriptLesson,
} from "@/lib/actions/script";
import { ScriptEditor } from "./script-editor";
import { IconChevronLeft } from "@/components/icons";
import { cn } from "@/lib/utils";

const day = new Intl.DateTimeFormat("ru", { day: "numeric", month: "short" });
const time = new Intl.DateTimeFormat("ru", { hour: "2-digit", minute: "2-digit" });

const sameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

export function ScriptWorkspace({
  lessons,
  initialLessonId,
}: {
  lessons: ScriptLesson[];
  initialLessonId?: string;
}) {
  const [openId, setOpenId] = useState<string | null>(
    initialLessonId ?? lessons[0]?.lessonId ?? null,
  );
  const [doc, setDoc] = useState<ScriptDoc | null>(null);
  const [written, setWritten] = useState<Set<string>>(
    () => new Set(lessons.filter((l) => l.hasScript).map((l) => l.lessonId)),
  );
  const [busy, startLoad] = useTransition();

  useEffect(() => {
    if (!openId) return;
    let alive = true;
    startLoad(async () => {
      const next = await getScriptAction(openId);
      if (alive) setDoc(next);
    });
    return () => {
      alive = false;
    };
  }, [openId]);

  const open = lessons.find((l) => l.lessonId === openId) ?? null;
  const now = new Date();

  return (
    <div className="grid min-h-[70vh] items-start gap-4 lg:grid-cols-[300px_minmax(0,1fr)]">
      {/* Уроки */}
      <aside
        className={cn(
          "flex max-h-[80vh] flex-col overflow-hidden rounded-2xl bg-surface ring-1 ring-line",
          open && "hidden lg:flex",
        )}
      >
        <p className="border-b border-line px-3.5 py-2.5 text-sm font-bold text-content">
          Уроки
        </p>

        <div className="min-h-0 flex-1 overflow-y-auto p-1.5">
          {lessons.length === 0 && (
            <p className="p-3 text-[13px] text-faint">
              Уроков пока нет — они появятся из расписания.
            </p>
          )}

          {lessons.map((lesson) => {
            const start = new Date(lesson.startTime);
            const today = sameDay(start, now);
            return (
              <button
                key={lesson.lessonId}
                type="button"
                onClick={() => setOpenId(lesson.lessonId)}
                className={cn(
                  "flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left transition",
                  openId === lesson.lessonId
                    ? "bg-accent-soft ring-1 ring-accent"
                    : "hover:bg-surface-2",
                )}
              >
                <Avatar
                  name={lesson.studentName}
                  src={lesson.avatarUrl}
                  className="h-9 w-9 text-xs"
                />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5">
                    <span
                      className={cn(
                        "text-[11px] font-bold",
                        today ? "text-accent" : "text-faint",
                      )}
                    >
                      {today ? "Сегодня" : day.format(start)}
                    </span>
                    <span className="text-[11px] text-faint">{time.format(start)}</span>
                    {written.has(lesson.lessonId) && (
                      <span
                        title="Скрипт написан"
                        className="ml-auto h-1.5 w-1.5 shrink-0 rounded-full bg-accent"
                      />
                    )}
                  </span>
                  <span className="block truncate text-[13px] font-semibold text-content">
                    {lesson.studentName}
                  </span>
                  {lesson.preview && (
                    <span className="block truncate text-[11px] text-faint">
                      {lesson.preview}
                    </span>
                  )}
                </span>
              </button>
            );
          })}
        </div>
      </aside>

      {/* Скрипт */}
      <section className="flex min-h-[70vh] flex-col gap-3">
        {open ? (
          <>
            <div className="flex flex-wrap items-center gap-3 rounded-2xl bg-surface px-3.5 py-2.5 ring-1 ring-line">
              <button
                type="button"
                onClick={() => setOpenId(null)}
                aria-label="К списку уроков"
                className="flex h-8 w-8 items-center justify-center rounded-lg text-faint transition hover:text-content lg:hidden"
              >
                <IconChevronLeft className="h-4 w-4" />
              </button>

              <Avatar
                name={open.studentName}
                src={open.avatarUrl}
                className="h-10 w-10 text-sm"
              />
              <span className="min-w-0">
                <span className="block text-sm font-bold text-content">
                  {open.studentName}
                </span>
                <span className="block text-[12px] text-faint">
                  {day.format(new Date(open.startTime))} ·{" "}
                  {time.format(new Date(open.startTime))} · {open.duration} мин
                  {open.studentLevel ? ` · ${open.studentLevel}` : ""}
                </span>
              </span>
              <span className="ml-auto text-[11px] text-faint">Видишь только ты</span>
            </div>

            {doc && !busy ? (
              <ScriptEditor
                key={doc.lessonId}
                doc={doc}
                onSaved={() =>
                  setWritten((prev) => new Set(prev).add(open.lessonId))
                }
              />
            ) : (
              <p className="rounded-2xl bg-surface p-5 text-sm text-faint ring-1 ring-line">
                Открываю…
              </p>
            )}
          </>
        ) : (
          <p className="rounded-2xl bg-surface p-5 text-sm text-faint ring-1 ring-line">
            Выбери урок слева — скрипт откроется здесь.
          </p>
        )}
      </section>
    </div>
  );
}
