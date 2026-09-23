import Link from "next/link";
import { and, asc, desc, eq, gte, isNotNull, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { users, lessons, homework, materialNodes, lessonPackages } from "@/lib/db/schema";
import { getSession } from "@/lib/session";
import { getDict } from "@/lib/i18n/server";
import { fmt } from "@/lib/i18n";
import { Avatar } from "@/components/avatar";
import {
  IconCheckCircle,
  IconLayers,
  IconMaterials,
  IconStar,
  IconChevronRight,
  IconCalendar,
  IconVideo,
  IconMessage,
  IconGlobe,
  IconCamera,
} from "@/components/icons";

const fileKindStyle: Record<string, string> = {
  PDF: "tint-rose",
  PPT: "tint-orange",
  DOC: "tint-sky",
  MP3: "tint-violet",
};

export default async function StudentHomePage() {
  const session = await getSession();
  const { t, locale } = await getDict();
  const now = new Date();

  const intl = locale === "en" ? "en-GB" : locale;
  const dayFmt = new Intl.DateTimeFormat(intl, { weekday: "short", day: "numeric", month: "short" });
  const timeFmt = new Intl.DateTimeFormat(intl, { hour: "2-digit", minute: "2-digit" });
  const dateFmt = new Intl.DateTimeFormat(intl, { day: "2-digit", month: "long", year: "numeric" });

  const [me] = await db
    .select()
    .from(users)
    .where(eq(users.id, session!.userId))
    .limit(1);

  const [teacher] = await db
    .select({ name: users.name, avatarUrl: users.avatarUrl })
    .from(users)
    .where(eq(users.role, "TEACHER"))
    .limit(1);

  const pkg = me.packageId
    ? (
        await db
          .select()
          .from(lessonPackages)
          .where(eq(lessonPackages.id, me.packageId))
          .limit(1)
      )[0]
    : null;

  const [doneRow] = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(lessons)
    .where(and(eq(lessons.studentId, me.id), eq(lessons.status, "COMPLETED")));

  const [nextLesson] = await db
    .select({
      id: lessons.id,
      startTime: lessons.startTime,
      duration: lessons.durationMinutes,
      topic: lessons.topic,
    })
    .from(lessons)
    .where(
      and(
        eq(lessons.studentId, me.id),
        eq(lessons.status, "SCHEDULED"),
        gte(lessons.startTime, now),
      ),
    )
    .orderBy(asc(lessons.startTime))
    .limit(1);

  const myHomework = await db
    .select()
    .from(homework)
    .where(eq(homework.studentId, me.id))
    .orderBy(desc(homework.createdAt))
    .limit(3);

  const pendingHw = myHomework.filter(
    (h) => h.status === "NOT_DONE" || h.status === "NEEDS_REVISION",
  ).length;

  const materials = await db
    .select({
      id: materialNodes.id,
      name: materialNodes.name,
      fileKind: materialNodes.fileKind,
      sizeLabel: materialNodes.sizeLabel,
    })
    .from(materialNodes)
    .where(and(eq(materialNodes.type, "FILE"), isNotNull(materialNodes.category)))
    .orderBy(desc(materialNodes.createdAt))
    .limit(3);

  const lessonsLeft = pkg ? pkg.remainingLessons : me.lessonBalance;
  // Учитель решает, что из баланса и статистики показывать ученику.
  const approx = me.statsApproximate ? "≈ " : "";
  // lessonsBefore — поправка учителя, она бывает и отрицательной.
  const lessonsDone = Math.max(0, (doneRow?.c ?? 0) + me.lessonsBefore);

  const stats = [
    me.showTotalLessons && {
      value: `${approx}${lessonsDone}`,
      label: t.studentDash.lessonsCompleted,
      Icon: IconCheckCircle,
      grad: "grad-c1",
    },
    me.showBalance && {
      value: String(lessonsLeft),
      label: t.studentDash.lessonsLeft,
      Icon: IconLayers,
      grad: "grad-c2",
    },
    {
      value: String(pendingHw),
      label: t.studentDash.homeworkToDo,
      Icon: IconMaterials,
      grad: "grad-c3",
    },
    { value: "4.9", label: t.studentDash.avgRating, Icon: IconStar, grad: "grad-c4" },
  ].filter((s): s is { value: string; label: string; Icon: typeof IconStar; grad: string } => !!s);

  // «через N дней» для ближайшего урока
  let whenLabel = "";
  if (nextLesson) {
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfLesson = new Date(
      nextLesson.startTime.getFullYear(),
      nextLesson.startTime.getMonth(),
      nextLesson.startTime.getDate(),
    );
    const days = Math.round(
      (startOfLesson.getTime() - startOfToday.getTime()) / 86400000,
    );
    whenLabel =
      days === 0
        ? t.studentDash.today
        : days === 1
          ? t.studentDash.tomorrow
          : fmt(t.studentDash.inDays, { n: days });
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Профиль + прогресс + статистика */}
      <div className="grid gap-6 xl:grid-cols-3">
        <section className="rounded-2xl bg-surface p-5 ring-1 ring-line shadow-sm sm:p-6 xl:col-span-2">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <Link href="/student/profile" className="group relative w-fit shrink-0">
              <Avatar
                name={me.name}
                src={me.avatarUrl}
                className="h-20 w-20 text-2xl sm:h-24 sm:w-24 sm:text-3xl"
              />
              <span className="absolute bottom-0 right-0 flex h-8 w-8 items-center justify-center rounded-full bg-accent text-white ring-4 ring-surface transition group-hover:opacity-90">
                <IconCamera className="h-4 w-4" />
              </span>
            </Link>

            <div className="min-w-0">
              <h1 className="text-2xl font-bold text-content">{me.name}</h1>
              <div className="mt-2 flex flex-wrap gap-2">
                {me.level && (
                  <span className="tint-accent rounded-full px-3 py-1 text-[11px] font-semibold">
                    {me.level}
                  </span>
                )}
                <span className="rounded-full bg-surface-2 px-3 py-1 text-[11px] font-medium text-muted">
                  General English
                </span>
              </div>
              <p className="mt-2 text-sm text-muted">{t.studentDash.tagline}</p>
              <p className="mt-0.5 text-xs italic text-faint">{t.studentDash.motto}</p>
            </div>
          </div>

          {/* Статистика */}
          <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
            {stats.map((s) => (
              <div key={s.label} className="rounded-xl bg-surface-2 p-3.5">
                <span
                  className={`flex h-9 w-9 items-center justify-center rounded-lg ${s.grad} text-white`}
                >
                  <s.Icon className="h-4.5 w-4.5" />
                </span>
                <p className="mt-2.5 text-2xl font-bold text-content">{s.value}</p>
                <p className="text-[11px] leading-tight text-muted">{s.label}</p>
              </div>
            ))}
          </div>

          {pkg?.expiresAt && (
            <p className="mt-4 text-[11px] text-faint">
              {fmt(t.studentDash.packageUntil, { date: dateFmt.format(pkg.expiresAt) })}
            </p>
          )}
        </section>

        {/* Цитата */}
        <section className="grad-accent relative overflow-hidden rounded-2xl p-6 text-white shadow-md">
          <div className="relative z-10 flex h-full flex-col">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/20 backdrop-blur">
              <IconGlobe className="h-6 w-6" />
            </span>
            <p className="mt-4 text-lg font-bold leading-snug">
              {t.greeting.globeQuote}
            </p>
            <p className="mt-auto pt-4 text-sm text-white/80">
              {fmt(t.studentDash.keepGoing, { name: me.name })}
            </p>
            <p className="text-xs text-white/70">{t.studentDash.keepGoingHint}</p>
          </div>
          <div className="pointer-events-none absolute -right-6 -bottom-6 h-32 w-32 rounded-full bg-white/10" />
          <div className="pointer-events-none absolute right-10 -top-8 h-24 w-24 rounded-full bg-white/10" />
        </section>
      </div>

      {/* Ближайший урок | Домашка | Учитель */}
      <div className="grid gap-6 xl:grid-cols-3">
        <section className="rounded-2xl bg-surface p-5 ring-1 ring-line shadow-sm sm:p-6">
          <div className="mb-4 flex items-center justify-between gap-2">
            <h2 className="font-semibold text-content">{t.studentDash.nextClass}</h2>
            <Link
              href="/student/schedule"
              className="flex shrink-0 items-center gap-1 text-sm font-medium text-accent hover:opacity-80"
            >
              {t.common.all} <IconChevronRight className="h-4 w-4" />
            </Link>
          </div>

          {!nextLesson && (
            <p className="py-6 text-center text-sm text-faint">
              {t.studentDash.noNextClass}
            </p>
          )}

          {nextLesson && (
            <>
              <div className="flex items-center gap-3">
                <span className="flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-xl bg-accent-soft text-accent">
                  <span className="text-[10px] font-semibold uppercase">
                    {dayFmt.format(nextLesson.startTime).split(" ")[0]}
                  </span>
                  <span className="text-lg font-bold leading-none">
                    {nextLesson.startTime.getDate()}
                  </span>
                </span>
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-content">
                    {timeFmt.format(nextLesson.startTime)}
                    <span className="tint-green rounded-full px-2 py-0.5 text-[10px] font-semibold">
                      {whenLabel}
                    </span>
                  </p>
                  <p className="truncate text-sm text-muted">
                    {nextLesson.topic ?? t.common.lesson}
                  </p>
                </div>
              </div>

              {teacher && (
                <div className="mt-4 flex items-center gap-2.5 border-t border-line pt-4">
                  <Avatar
                    name={teacher.name}
                    src={teacher.avatarUrl}
                    className="h-9 w-9 text-xs"
                  />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-content">
                      {teacher.name}
                    </p>
                    <p className="text-[11px] text-faint">{t.topbar.roleTeacher}</p>
                  </div>
                </div>
              )}

              <Link
                href="/student/schedule"
                className="mt-4 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-accent text-sm font-semibold text-white transition hover:opacity-90"
              >
                <IconVideo className="h-4 w-4" /> {t.studentDash.joinClass}
              </Link>
            </>
          )}
        </section>

        <section className="rounded-2xl bg-surface p-5 ring-1 ring-line shadow-sm sm:p-6">
          <div className="mb-4 flex items-center justify-between gap-2">
            <h2 className="font-semibold text-content">{t.nav.homework}</h2>
            <Link
              href="/student/homework"
              className="flex shrink-0 items-center gap-1 text-sm font-medium text-accent hover:opacity-80"
            >
              {t.common.all} <IconChevronRight className="h-4 w-4" />
            </Link>
          </div>

          {myHomework.length === 0 && (
            <p className="py-6 text-center text-sm text-faint">
              {t.studentArea.homeworkEmpty}
            </p>
          )}

          <div className="flex flex-col gap-3">
            {myHomework.map((h) => (
              <Link
                key={h.id}
                href="/student/homework"
                className="flex items-center gap-3 rounded-xl bg-surface-2 px-3 py-2.5 transition hover:brightness-95"
              >
                <span className="tint-accent flex h-9 w-9 shrink-0 items-center justify-center rounded-lg">
                  <IconMaterials className="h-4.5 w-4.5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-content">
                    {h.title}
                  </span>
                  <span className="block text-[11px] text-faint">
                    {t.homeworkStatus[h.status as keyof typeof t.homeworkStatus]}
                  </span>
                </span>
              </Link>
            ))}
          </div>
        </section>

        <section className="rounded-2xl bg-surface p-5 ring-1 ring-line shadow-sm sm:p-6">
          <h2 className="mb-4 font-semibold text-content">
            {t.studentDash.messageTeacher}
          </h2>
          {teacher && (
            <div className="flex items-center gap-3">
              <Avatar
                name={teacher.name}
                src={teacher.avatarUrl}
                className="h-12 w-12 text-base"
              />
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-content">
                  {teacher.name}
                </p>
                <p className="text-[11px] text-faint">{t.topbar.roleTeacher}</p>
              </div>
            </div>
          )}
          <p className="mt-4 rounded-xl bg-surface-2 px-3.5 py-3 text-sm text-muted">
            {t.studentDash.messageHint}
          </p>
          <Link
            href="/student/messages"
            className="mt-4 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-accent text-sm font-semibold text-white transition hover:opacity-90"
          >
            <IconMessage className="h-4 w-4" /> {t.studentDash.sendMessage}
          </Link>
        </section>
      </div>

      {/* Материалы */}
      <section className="rounded-2xl bg-surface p-5 ring-1 ring-line shadow-sm sm:p-6">
        <div className="mb-4 flex items-center justify-between gap-2">
          <h2 className="font-semibold text-content">{t.studentDash.learningMaterials}</h2>
          <Link
            href="/student/materials"
            className="flex shrink-0 items-center gap-1 text-sm font-medium text-accent hover:opacity-80"
          >
            {t.common.all} <IconChevronRight className="h-4 w-4" />
          </Link>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {materials.map((m) => (
            <div
              key={m.id}
              className="flex items-center gap-3 rounded-xl bg-surface-2 px-3 py-2.5"
            >
              <span
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-xs font-bold ${fileKindStyle[m.fileKind ?? ""] ?? "tint-accent"}`}
              >
                {m.fileKind}
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold text-content">
                  {m.name}
                </span>
                <span className="block text-[11px] text-faint">
                  {m.fileKind} · {m.sizeLabel}
                </span>
              </span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
