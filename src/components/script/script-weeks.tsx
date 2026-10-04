"use client";

/**
 * Недели с уроками — левая колонка скриптов.
 *
 * Готовятся к ближайшим занятиям, поэтому открыта текущая неделя.
 * Следующую можно дописать снизу, прошлые — пролистать стрелками.
 * Отдельно есть история: там только те уроки, к которым скрипт
 * действительно написан, и искать прошлую подготовку проще по ней, чем
 * листая недели назад.
 */
import { useEffect, useState, useTransition } from "react";
import { Avatar } from "@/components/avatar";
import { StudentPresence } from "@/components/student-presence";
import {
  listScriptHistoryAction,
  listScriptWeekAction,
  type ScriptLesson,
} from "@/lib/actions/script";
import { IconChevronLeft, IconChevronRight } from "@/components/icons";
import { cn } from "@/lib/utils";
import {
  SCHEDULE_FORMAT_TIME_ZONE,
  addScheduleDays,
  sameScheduleDay,
  scheduleNow,
  scheduleStartOfWeek,
} from "@/lib/schedule-time";

const dayName = new Intl.DateTimeFormat("en-GB", {
  weekday: "long",
  timeZone: SCHEDULE_FORMAT_TIME_ZONE,
});
const dayShort = new Intl.DateTimeFormat("ru", {
  day: "2-digit",
  month: "2-digit",
  timeZone: SCHEDULE_FORMAT_TIME_ZONE,
});
const timeOf = new Intl.DateTimeFormat("ru", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: SCHEDULE_FORMAT_TIME_ZONE,
});

/** Понедельник недели, в которую попадает дата. */
function weekStart(date: Date): Date {
  return scheduleStartOfWeek(date);
}

const addDays = (date: Date, days: number) => {
  return addScheduleDays(date, days);
};

const sameDay = sameScheduleDay;

/** Неделя строится от понедельника; воскресенье показываем только с уроками. */
const WEEKDAYS = 6;

type Week = { start: Date; lessons: ScriptLesson[] };

export function ScriptWeeks({
  openId,
  onOpen,
}: {
  openId: string | null;
  onOpen: (lesson: ScriptLesson) => void;
}) {
  const [anchor, setAnchor] = useState(() => weekStart(scheduleNow()));
  const [extra, setExtra] = useState(0);
  const [weeks, setWeeks] = useState<Week[]>([]);
  const [history, setHistory] = useState<ScriptLesson[] | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [busy, startLoad] = useTransition();

  useEffect(() => {
    let alive = true;
    const starts = Array.from({ length: extra + 1 }, (_, i) => addDays(anchor, i * 7));

    startLoad(async () => {
      const loaded = await Promise.all(
        starts.map(async (start) => ({
          start,
          lessons: await listScriptWeekAction(
            start.toISOString(),
            addDays(start, 7).toISOString(),
          ),
        })),
      );
      if (alive) setWeeks(loaded);
    });

    return () => {
      alive = false;
    };
  }, [anchor, extra]);

  useEffect(() => {
    if (!showHistory || history) return;
    let alive = true;
    startLoad(async () => {
      const rows = await listScriptHistoryAction();
      if (alive) setHistory(rows);
    });
    return () => {
      alive = false;
    };
  }, [showHistory, history]);

  const today = scheduleNow();
  const thisWeek = weekStart(today);

  const range = (start: Date) =>
    `${dayShort.format(start)} — ${dayShort.format(addDays(start, 6))}`;

  const lessonRow = (lesson: ScriptLesson, withDate = false) => {
    const start = new Date(lesson.startTime);
    return (
      <button
        key={lesson.lessonId}
        type="button"
        onClick={() => onOpen(lesson)}
        className={cn(
          "flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left transition",
          openId === lesson.lessonId
            ? "bg-accent-soft ring-1 ring-accent"
            : lesson.status === "DELETED"
              ? "bg-orange-500/10 hover:bg-orange-500/15"
              : lesson.status.startsWith("CANCELLED") || lesson.status === "BURNED"
                ? "bg-rose-500/10 hover:bg-rose-500/15"
                : "hover:bg-surface-2",
        )}
      >
        <Avatar name={lesson.studentName} src={lesson.avatarUrl} className="h-7 w-7 text-[10px]" />
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5">
            <span className="font-mono text-[11px] text-faint">
              {withDate ? dayShort.format(start) : timeOf.format(start)}
            </span>
            <span className="truncate text-[13px] font-semibold text-content">
              {lesson.studentName}
            </span>
            <StudentPresence studentId={lesson.studentId} />
            {lesson.hasScript && (
              <span
                title="Скрипт написан"
                className="ml-auto h-1.5 w-1.5 shrink-0 rounded-full bg-accent"
              />
            )}
          </span>
          {lesson.preview && (
            <span className="block truncate text-[11px] text-faint">{lesson.preview}</span>
          )}
        </span>
      </button>
    );
  };

  return (
    <div className="flex max-h-[80vh] flex-col overflow-hidden rounded-2xl bg-surface ring-1 ring-line">
      {/* Переключение недель */}
      <div className="flex items-center gap-1 border-b border-line px-2 py-2">
        <button
          type="button"
          onClick={() => setAnchor(addDays(anchor, -7))}
          aria-label="Предыдущая неделя"
          className="flex h-7 w-7 items-center justify-center rounded-lg text-faint transition hover:bg-surface-2 hover:text-content"
        >
          <IconChevronLeft className="h-4 w-4" />
        </button>

        <span className="flex-1 text-center font-mono text-[12px] font-bold text-content">
          {range(anchor)}
        </span>

        <button
          type="button"
          onClick={() => setAnchor(addDays(anchor, 7))}
          aria-label="Следующая неделя"
          className="flex h-7 w-7 items-center justify-center rounded-lg text-faint transition hover:bg-surface-2 hover:text-content"
        >
          <IconChevronRight className="h-4 w-4" />
        </button>

        {!sameDay(anchor, thisWeek) && (
          <button
            type="button"
            onClick={() => setAnchor(thisWeek)}
            className="h-7 rounded-lg px-2 text-[11px] font-semibold text-accent transition hover:bg-surface-2"
          >
            Текущая
          </button>
        )}
      </div>

      <div className="flex items-center gap-1 border-b border-line px-2 py-1.5">
        <button
          type="button"
          onClick={() => setShowHistory(false)}
          className={cn(
            "h-7 rounded-lg px-2.5 text-[11px] font-semibold transition",
            !showHistory ? "bg-accent text-white" : "text-muted hover:bg-surface-2",
          )}
        >
          Неделя
        </button>
        <button
          type="button"
          onClick={() => setShowHistory(true)}
          className={cn(
            "h-7 rounded-lg px-2.5 text-[11px] font-semibold transition",
            showHistory ? "bg-accent text-white" : "text-muted hover:bg-surface-2",
          )}
        >
          История
        </button>
        {busy && <span className="ml-auto text-[11px] text-faint">…</span>}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-1.5">
        {showHistory ? (
          <>
            {history?.length === 0 && (
              <p className="p-3 text-[13px] text-faint">
                Скриптов пока нет — напиши первый, и он появится здесь.
              </p>
            )}
            {(history ?? []).map((lesson) => lessonRow(lesson, true))}
          </>
        ) : (
          <>
            {weeks.map((week) => (
              <div key={week.start.toISOString()} className="mb-2">
                {weeks.length > 1 && (
                  <p className="px-2 py-1 font-mono text-[11px] font-bold text-faint">
                    {range(week.start)}
                  </p>
                )}

                {Array.from({ length: 7 }, (_, i) => addDays(week.start, i))
                  // Воскресенье показываем, только если на него есть урок.
                  .filter(
                    (day, i) =>
                      i < WEEKDAYS ||
                      week.lessons.some((l) => sameDay(new Date(l.startTime), day)),
                  )
                  .map((day) => {
                    const ofDay = week.lessons.filter((l) =>
                      sameDay(new Date(l.startTime), day),
                    );
                    const isToday = sameDay(day, today);

                    return (
                      <div key={day.toISOString()} className="mb-1">
                        <p
                          className={cn(
                            "flex items-center gap-1.5 px-2 py-1 text-[11px] font-bold uppercase tracking-wide",
                            isToday ? "text-accent" : "text-faint",
                          )}
                        >
                          {dayName.format(day)}
                          <span className="font-mono normal-case">
                            {dayShort.format(day)}
                          </span>
                          {isToday && <span className="normal-case">· сегодня</span>}
                        </p>

                        {ofDay.length === 0 ? (
                          <p className="px-2 pb-1 text-[11px] text-faint/70">—</p>
                        ) : (
                          ofDay.map((lesson) => lessonRow(lesson))
                        )}
                      </div>
                    );
                  })}
              </div>
            ))}

            <button
              type="button"
              onClick={() => setExtra((v) => (v > 0 ? 0 : 1))}
              className="w-full rounded-lg px-2 py-2 text-[12px] font-semibold text-accent transition hover:bg-surface-2"
            >
              {extra > 0 ? "Убрать следующую неделю" : "+ Следующая неделя"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
