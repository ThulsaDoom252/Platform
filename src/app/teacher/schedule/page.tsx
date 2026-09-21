import Link from "next/link";
import { and, asc, eq, gte, lt } from "drizzle-orm";
import { db } from "@/lib/db";
import { users, lessons } from "@/lib/db/schema";
import { ScheduleClient } from "@/components/teacher/schedule-client";
import { getDict } from "@/lib/i18n/server";
import { IconChevronLeft, IconChevronRight } from "@/components/icons";

/** Высота часа в недельной сетке. */
const ROW_H = 64;

const dMon = new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "short" });
const dMonY = new Intl.DateTimeFormat("ru-RU", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

function toISODate(d: Date) {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function parseISODate(s?: string) {
  if (!s) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(d.getTime()) ? null : d;
}

function startOfWeek(d: Date) {
  const r = new Date(d);
  r.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  r.setHours(0, 0, 0, 0);
  return r;
}

function sameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export default async function SchedulePage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; view?: string }>;
}) {
  const sp = await searchParams;
  const { t } = await getDict();
  const now = new Date();
  const anchor = parseISODate(sp.date) ?? now;
  const isDay = sp.view === "day";
  const view = isDay ? "day" : "week";

  // Навигация ограничена: от прошлой недели до последней недели текущего года.
  const minWeek = startOfWeek(
    new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7),
  );
  const maxWeek = startOfWeek(new Date(now.getFullYear(), 11, 31));

  let weekStart = startOfWeek(anchor);
  if (weekStart < minWeek) weekStart = minWeek;
  if (weekStart > maxWeek) weekStart = maxWeek;

  const canPrev = weekStart.getTime() > minWeek.getTime();
  const canNext = weekStart.getTime() < maxWeek.getTime();

  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 7);
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + i);
    return d;
  });

  const rows = await db
    .select({
      id: lessons.id,
      startTime: lessons.startTime,
      duration: lessons.durationMinutes,
      topic: lessons.topic,
      status: lessons.status,
      teacherComment: lessons.teacherComment,
      cancelReason: lessons.cancelReason,
      studentId: lessons.studentId,
      studentName: users.name,
      studentLevel: users.level,
      studentBalance: users.lessonBalance,
    })
    .from(lessons)
    .innerJoin(users, eq(lessons.studentId, users.id))
    .where(and(gte(lessons.startTime, weekStart), lt(lessons.startTime, weekEnd)))
    .orderBy(asc(lessons.startTime));

  const studentList = await db
    .select({
      id: users.id,
      name: users.name,
      level: users.level,
      balance: users.lessonBalance,
    })
    .from(users)
    .where(eq(users.role, "STUDENT"))
    .orderBy(asc(users.name));

  // Диапазон часов подстраивается под реальные уроки (минимум 8:00–20:00).
  let hFrom = 8;
  let hTo = 20;
  for (const r of rows) {
    const s = r.startTime.getHours();
    const e = Math.ceil(
      r.startTime.getHours() + r.startTime.getMinutes() / 60 + r.duration / 60,
    );
    if (s < hFrom) hFrom = s;
    if (e > hTo) hTo = e;
  }
  const hours = Array.from({ length: hTo - hFrom }, (_, i) => hFrom + i);

  const selected =
    days.find((d) => sameDay(d, anchor)) ??
    days.find((d) => sameDay(d, now)) ??
    days[0];

  const prevWeek = new Date(weekStart);
  prevWeek.setDate(weekStart.getDate() - 7);
  const nextWeek = new Date(weekStart);
  nextWeek.setDate(weekStart.getDate() + 7);
  const lastDay = new Date(weekEnd);
  lastDay.setDate(weekEnd.getDate() - 1);

  const href = (d: Date, v: string) => `/teacher/schedule?date=${toISODate(d)}&view=${v}`;

  return (
    <div className="flex flex-col gap-5">
      {/* Header */}
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-content">{t.schedule.title}</h1>
          <p className="mt-1 text-sm text-muted">{t.schedule.subtitle}</p>
          {/* Легенда цветов */}
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px] text-muted">
            <span className="flex items-center gap-1.5">
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ background: "var(--lesson-green)" }}
              />
              {t.lessonStatus.COMPLETED}
            </span>
            <span className="flex items-center gap-1.5">
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ background: "var(--lesson-amber)" }}
              />
              {t.lessonStatus.SCHEDULED}
            </span>
            <span className="flex items-center gap-1.5">
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ background: "var(--lesson-rose)" }}
              />
              {t.schedule.cancelled}
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <div className="flex items-center gap-1 rounded-xl bg-surface px-1.5 py-1.5 ring-1 ring-line">
            {canPrev ? (
              <Link
                href={href(prevWeek, view)}
                aria-label={t.schedule.prevWeek}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-muted transition hover:bg-surface-2 hover:text-content"
              >
                <IconChevronLeft className="h-4 w-4" />
              </Link>
            ) : (
              <span className="flex h-8 w-8 items-center justify-center rounded-lg text-faint opacity-40">
                <IconChevronLeft className="h-4 w-4" />
              </span>
            )}
            <span className="px-2 text-sm font-semibold text-content">
              {dMon.format(weekStart)} — {dMonY.format(lastDay)}
            </span>
            {canNext ? (
              <Link
                href={href(nextWeek, view)}
                aria-label={t.schedule.nextWeek}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-muted transition hover:bg-surface-2 hover:text-content"
              >
                <IconChevronRight className="h-4 w-4" />
              </Link>
            ) : (
              <span className="flex h-8 w-8 items-center justify-center rounded-lg text-faint opacity-40">
                <IconChevronRight className="h-4 w-4" />
              </span>
            )}
          </div>

          <Link
            href={href(now, view)}
            className="rounded-xl bg-surface px-3.5 py-2 text-sm font-medium text-muted ring-1 ring-line transition hover:text-content"
          >
            {t.common.today}
          </Link>

          <div className="flex items-center gap-1 rounded-xl bg-surface p-1 ring-1 ring-line">
            <Link
              href={href(weekStart, "week")}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${!isDay ? "bg-accent text-white" : "text-muted hover:text-content"}`}
            >
              {t.common.week}
            </Link>
            <Link
              href={href(selected, "day")}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${isDay ? "bg-accent text-white" : "text-muted hover:text-content"}`}
            >
              {t.common.day}
            </Link>
          </div>
        </div>
      </div>

      <ScheduleClient
        days={days}
        hours={hours}
        rowH={ROW_H}
        lessons={rows}
        students={studentList}
        now={now}
        selected={selected}
        isDay={isDay}
        view={view}
      />
    </div>
  );
}
