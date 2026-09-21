import { asc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { lessons, users, lessonPackages } from "@/lib/db/schema";
import { getSession } from "@/lib/session";
import { getDict } from "@/lib/i18n/server";
import { fmt } from "@/lib/i18n";
import { cancelLessonAction } from "@/lib/actions/student";
import { IconCalendar, IconLayers } from "@/components/icons";

const CANCELLED = ["CANCELLED_BY_STUDENT", "CANCELLED_BY_TEACHER", "BURNED"];

function lessonTone(status: string, startTime: Date, now: Date) {
  if (CANCELLED.includes(status)) return "var(--lesson-rose)";
  if (startTime.getTime() < now.getTime()) return "var(--lesson-green)";
  return "var(--lesson-amber)";
}

export default async function StudentSchedulePage() {
  const session = await getSession();
  const { t, locale } = await getDict();
  const now = new Date();

  const intl = locale === "en" ? "en-GB" : locale;
  const dtFmt = new Intl.DateTimeFormat(intl, {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
  const dateFmt = new Intl.DateTimeFormat(intl, {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  const [me] = await db
    .select()
    .from(users)
    .where(eq(users.id, session!.userId))
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

  const myLessons = await db
    .select()
    .from(lessons)
    .where(eq(lessons.studentId, session!.userId))
    .orderBy(asc(lessons.startTime));

  const upcoming = myLessons.filter((l) => l.status === "SCHEDULED");
  const history = myLessons.filter((l) => l.status !== "SCHEDULED").reverse();
  const balance = pkg ? pkg.remainingLessons : me.lessonBalance;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-content">{t.studentArea.scheduleTitle}</h1>
        <p className="mt-1 text-sm text-muted">{t.studentArea.scheduleSubtitle}</p>
      </div>

      {/* Баланс */}
      <section className="rounded-2xl bg-surface p-5 ring-1 ring-line shadow-sm sm:p-6">
        <div className="flex flex-wrap items-center gap-4">
          <span className="grad-accent flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-white shadow-sm">
            <IconLayers className="h-6 w-6" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-content">{t.studentArea.balanceTitle}</p>
            <p className="mt-0.5 text-sm text-muted">{t.studentArea.balanceHint}</p>
          </div>
          <div className="flex flex-col items-start gap-1 sm:items-end">
            <span
              className={`rounded-full px-3 py-1 text-xs font-semibold ${balance > 0 ? "tint-green" : "tint-rose"}`}
            >
              {fmt(t.studentArea.balanceLeft, { n: balance })}
            </span>
            {pkg?.expiresAt && (
              <span className="text-[11px] text-faint">
                {fmt(t.studentDash.packageUntil, { date: dateFmt.format(pkg.expiresAt) })}
              </span>
            )}
          </div>
        </div>
      </section>

      {/* Предстоящие */}
      <section className="rounded-2xl bg-surface p-5 ring-1 ring-line shadow-sm sm:p-6">
        <div className="mb-1.5 flex items-center gap-2">
          <IconCalendar className="h-4 w-4 text-accent" />
          <h2 className="font-semibold text-content">{t.studentArea.myLessons}</h2>
        </div>
        <p className="mb-4 text-xs text-faint">{t.studentArea.cancelRules}</p>

        {upcoming.length === 0 && (
          <p className="py-6 text-center text-sm text-faint">
            {t.studentArea.noScheduled}
          </p>
        )}

        <div className="flex flex-col gap-3">
          {upcoming.map((l) => (
            <div
              key={l.id}
              className="rounded-xl p-3.5"
              style={{
                background: `color-mix(in srgb, ${lessonTone(l.status, l.startTime, now)} 14%, var(--surface))`,
                borderLeft: `3px solid ${lessonTone(l.status, l.startTime, now)}`,
              }}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-semibold text-content">
                  {dtFmt.format(l.startTime)}
                </p>
                <span className="text-xs text-muted">{l.topic}</span>
              </div>
              {l.teacherCommentVisible && l.teacherComment && (
                <p className="mt-1.5 text-xs text-muted">
                  {fmt(t.studentArea.teacherComment, { text: l.teacherComment })}
                </p>
              )}
              <form action={cancelLessonAction} className="mt-3 flex flex-wrap gap-2">
                <input type="hidden" name="lessonId" value={l.id} />
                <input
                  name="reason"
                  required
                  placeholder={t.studentArea.cancelReasonPlaceholder}
                  className="h-10 min-w-0 flex-1 rounded-xl border border-line bg-surface px-3.5 text-sm text-content outline-none transition placeholder:text-faint focus:border-accent"
                />
                <button
                  type="submit"
                  className="h-10 shrink-0 rounded-xl bg-rose-600 px-4 text-sm font-semibold text-white transition hover:bg-rose-500"
                >
                  {t.studentArea.cancelBtn}
                </button>
              </form>
            </div>
          ))}
        </div>
      </section>

      {/* История */}
      {history.length > 0 && (
        <section className="rounded-2xl bg-surface p-5 ring-1 ring-line shadow-sm sm:p-6">
          <h2 className="mb-4 font-semibold text-content">{t.studentArea.history}</h2>
          <div className="flex flex-col gap-2">
            {history.map((l) => (
              <div
                key={l.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-surface-2 px-3.5 py-2.5"
              >
                <span className="flex items-center gap-2.5 text-sm text-content">
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ background: lessonTone(l.status, l.startTime, now) }}
                  />
                  {dtFmt.format(l.startTime)}
                </span>
                <span className="text-xs text-muted">
                  {t.lessonStatus[l.status as keyof typeof t.lessonStatus]}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
