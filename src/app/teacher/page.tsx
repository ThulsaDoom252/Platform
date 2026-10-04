import Link from "next/link";
import { and, asc, desc, eq, gte, isNotNull, lt, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { users, lessons, materialNodes } from "@/lib/db/schema";
import { getSession } from "@/lib/session";
import { getDict } from "@/lib/i18n/server";
import { fmt, type Dict } from "@/lib/i18n";
import {
  IconUsers,
  IconCalendar,
  IconTrendUp,
  IconStar,
  IconVideo,
  IconChevronRight,
  IconDots,
  IconGlobe,
  IconSprout,
  IconChart,
} from "@/components/icons";
import { StudentPresence } from "@/components/student-presence";
import {
  SCHEDULE_FORMAT_TIME_ZONE,
  scheduleNow,
  scheduleStartOfWeek,
} from "@/lib/schedule-time";

/** Ставка за проведённый урок (для расчёта дохода). */
const LESSON_RATE = 40;

/** Градиенты активной палитры — меняются вместе с темой. */
const chipGrads = ["grad-c1", "grad-c2", "grad-c3", "grad-c4"];

function initials(name: string) {
  return name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();
}

function greeting(hour: number, t: Dict) {
  if (hour < 6) return t.greeting.night;
  if (hour < 12) return t.greeting.morning;
  if (hour < 18) return t.greeting.afternoon;
  return t.greeting.evening;
}

const fileKindStyle: Record<string, string> = {
  PDF: "tint-rose",
  PPT: "tint-orange",
  DOC: "tint-sky",
};

export default async function TeacherOverviewPage() {
  const session = await getSession();
  const { t, locale } = await getDict();
  const now = scheduleNow();

  // Даты тоже идут по языку пользователя: «ср, 1 окт.» и «Wed, 1 Oct».
  const intlLocale = locale === "en" ? "en-GB" : locale;
  const timeFmt = new Intl.DateTimeFormat(intlLocale, {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: SCHEDULE_FORMAT_TIME_ZONE,
  });
  const dateFmt = new Intl.DateTimeFormat(intlLocale, {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: SCHEDULE_FORMAT_TIME_ZONE,
  });

  const startOfWeek = scheduleStartOfWeek(now);
  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setUTCDate(startOfWeek.getUTCDate() + 7);
  const startOfMonth = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
  );
  const endOfMonth = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1),
  );

  const students = await db
    .select({
      id: users.id,
      name: users.name,
      level: users.level,
      balance: users.lessonBalance,
    })
    .from(users)
    .where(eq(users.role, "STUDENT"))
    .orderBy(asc(users.name));

  const upcoming = await db
    .select({
      id: lessons.id,
      startTime: lessons.startTime,
      topic: lessons.topic,
      studentId: lessons.studentId,
      studentName: users.name,
    })
    .from(lessons)
    .innerJoin(users, eq(lessons.studentId, users.id))
    .where(and(eq(lessons.status, "SCHEDULED"), gte(lessons.startTime, now)))
    .orderBy(asc(lessons.startTime))
    .limit(6);

  const [weekRow] = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(lessons)
    .where(and(gte(lessons.startTime, startOfWeek), lt(lessons.startTime, endOfWeek)));

  const [completedRow] = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(lessons)
    .where(
      and(
        eq(lessons.status, "COMPLETED"),
        gte(lessons.startTime, startOfMonth),
        lt(lessons.startTime, endOfMonth),
      ),
    );

  const materials = await db
    .select({
      id: materialNodes.id,
      name: materialNodes.name,
      fileKind: materialNodes.fileKind,
      category: materialNodes.category,
      sizeLabel: materialNodes.sizeLabel,
    })
    .from(materialNodes)
    .where(and(eq(materialNodes.type, "FILE"), isNotNull(materialNodes.category)))
    .orderBy(desc(materialNodes.createdAt))
    .limit(3);

  const activeStudents = students.length;
  const lessonsThisWeek = weekRow?.c ?? 0;
  const completedThisMonth = completedRow?.c ?? 0;
  const earnings = completedThisMonth * LESSON_RATE;

  const stats = [
    {
      value: String(activeStudents),
      label: t.stats.activeStudents,
      hint: t.stats.hintTotal,
      Icon: IconUsers,
      grad: "grad-c1",
      href: "/teacher/students",
    },
    {
      value: String(lessonsThisWeek),
      label: t.stats.lessonsThisWeek,
      hint: t.stats.hintVsLastWeek,
      Icon: IconCalendar,
      grad: "grad-c2",
      href: "/teacher/schedule",
    },
    {
      value: String(completedThisMonth),
      label: t.stats.lessonsPerMonth,
      hint: t.stats.hintDone,
      Icon: IconTrendUp,
      grad: "grad-c3",
    },
    {
      value: "4.9",
      label: t.stats.avgRating,
      hint: t.stats.hintReviews,
      Icon: IconStar,
      grad: "grad-c4",
    },
  ];

  const earningsBars = [42, 58, 50, 66, 54, 74, 84];
  const completedBars = [30, 46, 40, 56, 62, 72, 86];

  return (
    <div className="flex flex-col gap-6">
      {/* Greeting */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-content sm:text-[28px]">
            {greeting(now.getUTCHours(), t)}, {session?.name}! <span className="align-middle">👋</span>
          </h1>
          <p className="mt-1 text-sm text-muted">
            {t.greeting.teacherSubtitle}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 rounded-xl bg-surface px-3.5 py-2 text-sm font-medium text-muted ring-1 ring-line">
            <IconCalendar className="h-4 w-4 text-accent" />
            {dateFmt.format(now)}
          </div>
          <div className="hidden items-center gap-2 rounded-xl bg-accent-soft px-3.5 py-2 text-sm text-content ring-1 ring-line sm:flex">
            <IconGlobe className="h-4 w-4 text-accent" />
            <span className="italic">{t.greeting.globeQuote}</span>
          </div>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        {stats.map((s) => {
          const inner = (
            <>
              <div className="flex items-start justify-between gap-2">
                <div
                  className={`flex h-11 w-11 items-center justify-center rounded-xl ${s.grad} text-white shadow-sm`}
                >
                  <s.Icon className="h-5.5 w-5.5" />
                </div>
                <span className="tint-green rounded-full px-2 py-0.5 text-[11px] font-semibold">
                  {s.hint}
                </span>
              </div>
              <p className="mt-4 text-3xl font-bold text-content">{s.value}</p>
              <p className="mt-0.5 text-sm text-muted">{s.label}</p>
            </>
          );
          const cls =
            "rounded-2xl bg-surface p-5 ring-1 ring-line shadow-sm transition hover:-translate-y-0.5 hover:shadow-md";
          return s.href ? (
            <Link key={s.label} href={s.href} className={cls}>
              {inner}
            </Link>
          ) : (
            <div key={s.label} className={cls}>
              {inner}
            </div>
          );
        })}
      </div>

      {/* Progress + Upcoming */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        {/* Student progress */}
        <section className="rounded-2xl bg-surface p-5 ring-1 ring-line shadow-sm sm:p-6">
          <div className="mb-5 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent-soft text-accent">
                <IconChart className="h-4.5 w-4.5" />
              </div>
              <h2 className="font-semibold text-content">{t.progress.title}</h2>
            </div>
            <Link
              href="/teacher/students"
              className="flex shrink-0 items-center gap-1 text-sm font-medium text-accent hover:opacity-80"
            >
              {t.common.all} <IconChevronRight className="h-4 w-4" />
            </Link>
          </div>
          <div className="flex flex-col gap-4">
            {students.slice(0, 5).map((s, i) => {
              return (
                <Link
                  key={s.id}
                  href={`/teacher/students/${s.id}`}
                  className="group flex items-center gap-3.5"
                >
                  <div
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${chipGrads[i % chipGrads.length]} text-xs font-semibold text-white`}
                  >
                    {initials(s.name)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex min-w-0 items-center gap-2">
                        <p className="truncate text-sm font-semibold text-content group-hover:text-accent">
                          {s.name}
                        </p>
                        <StudentPresence studentId={s.id} />
                      </div>
                      <span
                        className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${s.balance > 3 ? "tint-green" : s.balance > 0 ? "tint-amber" : "tint-rose"}`}
                      >
                        {fmt(t.stats.lessonsShort, { n: s.balance })}
                      </span>
                    </div>
                    <p className="mt-0.5 text-[11px] text-faint">{s.level}</p>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>

        {/* Upcoming lessons */}
        <section className="rounded-2xl bg-surface p-5 ring-1 ring-line shadow-sm sm:p-6">
          <div className="mb-5 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent-soft text-accent">
                <IconCalendar className="h-4.5 w-4.5" />
              </div>
              <h2 className="font-semibold text-content">{t.upcoming.title}</h2>
            </div>
            <Link
              href="/teacher/schedule"
              className="flex shrink-0 items-center gap-1 text-sm font-medium text-accent hover:opacity-80"
            >
              {t.nav.schedule} <IconChevronRight className="h-4 w-4" />
            </Link>
          </div>
          <div className="flex flex-col">
            {upcoming.length === 0 && (
              <p className="text-sm text-faint">{t.upcoming.empty}</p>
            )}
            {upcoming.map((l, i) => {
              const join = i < 2;
              return (
                <div
                  key={l.id}
                  className="flex items-center gap-3 border-b border-line py-3 last:border-0 sm:gap-4"
                >
                  <div className="w-12 shrink-0 text-sm font-semibold text-content">
                    {timeFmt.format(l.startTime)}
                  </div>
                  <span
                    className={`h-2 w-2 shrink-0 rounded-full ${join ? "bg-accent" : "bg-faint"}`}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex min-w-0 items-center gap-2">
                      <p className="truncate text-sm font-semibold text-content">
                        {l.studentName}
                      </p>
                      <StudentPresence studentId={l.studentId} />
                    </div>
                    <p className="truncate text-xs text-faint">{l.topic}</p>
                  </div>
                  <Link
                    href={`/teacher/students/${l.studentId}`}
                    className={
                      join
                        ? "flex shrink-0 items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-white transition hover:opacity-90"
                        : "shrink-0 rounded-lg border border-line px-3 py-1.5 text-xs font-semibold text-muted transition hover:bg-surface-2"
                    }
                  >
                    {join && <IconVideo className="h-3.5 w-3.5" />}
                    {join ? t.upcoming.join : t.upcoming.prepare}
                  </Link>
                </div>
              );
            })}
          </div>
        </section>
      </div>

      {/* Materials + Account + Promo */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        {/* Recent materials */}
        <section className="rounded-2xl bg-surface p-5 ring-1 ring-line shadow-sm sm:p-6">
          <div className="mb-4 flex items-center justify-between gap-2">
            <h2 className="font-semibold text-content">{t.materials.recentTitle}</h2>
            <Link
              href="/teacher/materials"
              className="flex shrink-0 items-center gap-1 text-sm font-medium text-accent hover:opacity-80"
            >
              {t.common.all} <IconChevronRight className="h-4 w-4" />
            </Link>
          </div>
          <div className="flex flex-col gap-3">
            {materials.map((m) => (
              <div key={m.id} className="flex items-center gap-3">
                <div
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-xs font-bold ${fileKindStyle[m.fileKind ?? ""] ?? "bg-surface-2 text-muted"}`}
                >
                  {m.fileKind}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-content">{m.name}</p>
                  <p className="text-[11px] text-faint">
                    {m.fileKind} · {m.sizeLabel}
                  </p>
                </div>
                <span className="hidden shrink-0 rounded-full bg-surface-2 px-2.5 py-1 text-[11px] font-medium text-muted sm:inline">
                  {m.category}
                </span>
                <button type="button" className="shrink-0 text-faint hover:text-muted">
                  <IconDots className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        </section>

        {/* Account overview */}
        <section className="rounded-2xl bg-surface p-5 ring-1 ring-line shadow-sm sm:p-6">
          <div className="mb-5 flex items-center justify-between gap-2">
            <h2 className="font-semibold text-content">{t.finances.title}</h2>
            <span className="rounded-lg bg-surface-2 px-2.5 py-1 text-[11px] font-medium text-muted">
              {t.finances.perMonth}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-xl bg-surface-2 p-3.5">
              <p className="text-2xl font-bold text-content">${earnings}</p>
              <p className="text-[11px] text-muted">{t.finances.income}</p>
              <div className="mt-2 flex items-end gap-1">
                {earningsBars.map((h, i) => (
                  <div
                    key={i}
                    className="grad-c1 flex-1 rounded-sm"
                    style={{ height: `${h * 0.4}px` }}
                  />
                ))}
              </div>
            </div>
            <div className="rounded-xl bg-surface-2 p-3.5">
              <p className="text-2xl font-bold text-content">{completedThisMonth}</p>
              <p className="text-[11px] text-muted">{t.finances.lessonsDone}</p>
              <div className="mt-2 flex items-end gap-1">
                {completedBars.map((h, i) => (
                  <div
                    key={i}
                    className="grad-c3 flex-1 rounded-sm"
                    style={{ height: `${h * 0.4}px` }}
                  />
                ))}
              </div>
            </div>
          </div>
          <p className="mt-4 text-[11px] text-faint">
            {fmt(t.finances.formula, { rate: LESSON_RATE })}
          </p>
        </section>

        {/* Promo card */}
        <section className="grad-accent relative overflow-hidden rounded-2xl p-6 text-white shadow-md">
          <div className="relative z-10 flex h-full flex-col">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/20 backdrop-blur">
              <IconSprout className="h-6 w-6" />
            </div>
            <p className="mt-4 text-lg font-bold leading-snug">
              {t.promo.title}
            </p>
            <p className="mt-1 text-sm text-white/80">{t.promo.subtitle}</p>
            <Link
              href="/teacher/students"
              className="mt-4 flex w-fit items-center gap-2 rounded-xl bg-white px-4 py-2 text-sm font-semibold text-accent transition hover:bg-white/90"
            >
              {t.promo.cta} <IconChevronRight className="h-4 w-4" />
            </Link>
          </div>
          <div className="pointer-events-none absolute -right-6 -bottom-6 h-32 w-32 rounded-full bg-white/10" />
          <div className="pointer-events-none absolute right-10 -top-8 h-24 w-24 rounded-full bg-white/10" />
        </section>
      </div>
    </div>
  );
}
