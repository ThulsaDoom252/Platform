import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { users, lessonPackages } from "@/lib/db/schema";
import { createStudentAction } from "@/lib/actions/teacher";
import { getDict } from "@/lib/i18n/server";
import { fmt } from "@/lib/i18n";
import { Avatar } from "@/components/avatar";
import { IconChevronRight, IconLayers } from "@/components/icons";

const inputCls =
  "h-10 rounded-xl border border-line bg-surface-2 px-3.5 text-sm text-content outline-none transition placeholder:text-faint focus:border-accent";

export default async function TeacherStudentsPage() {
  const { t, locale } = await getDict();
  const dateFmt = new Intl.DateTimeFormat(locale === "en" ? "en-GB" : locale, {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  const students = await db
    .select({
      id: users.id,
      name: users.name,
      login: users.login,
      level: users.level,
      progress: users.progressPercent,
      balance: users.lessonBalance,
      avatarUrl: users.avatarUrl,
      packageId: users.packageId,
    })
    .from(users)
    .where(eq(users.role, "STUDENT"))
    .orderBy(desc(users.progressPercent));

  const packages = await db.select().from(lessonPackages);
  const pkgOf = new Map(packages.map((p) => [p.id, p]));

  // Участники каждого пакета — для подписи «общий пул на: …»
  const membersOf = new Map<string, string[]>();
  for (const s of students) {
    if (!s.packageId) continue;
    membersOf.set(s.packageId, [...(membersOf.get(s.packageId) ?? []), s.name]);
  }
  const sharedPackages = packages.filter(
    (p) => (membersOf.get(p.id) ?? []).length > 0,
  );

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-content">{t.studentsPage.title}</h1>
        <p className="mt-1 text-sm text-muted">
          {fmt(t.studentsPage.subtitle, { count: students.length })}
        </p>
      </div>

      {/* Пакеты уроков */}
      {sharedPackages.map((p) => (
        <section
          key={p.id}
          className="rounded-2xl bg-surface p-5 ring-1 ring-line shadow-sm sm:p-6"
        >
          <div className="flex flex-wrap items-center gap-4">
            <span className="grad-accent flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-white shadow-sm">
              <IconLayers className="h-6 w-6" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-content">{t.studentsPage.packageTitle}</p>
              <p className="mt-0.5 text-sm text-muted">
                {fmt(t.studentsPage.packageShared, {
                  members: (membersOf.get(p.id) ?? []).join(", "),
                })}
              </p>
            </div>
            <div className="flex flex-col items-start gap-1.5 sm:items-end">
              <span className="tint-green rounded-full px-3 py-1 text-xs font-semibold">
                {fmt(t.studentsPage.packageRemaining, {
                  n: p.remainingLessons,
                  total: p.totalLessons,
                })}
              </span>
              {p.expiresAt && (
                <span className="text-[11px] text-faint">
                  {fmt(t.studentsPage.packageExpires, {
                    date: dateFmt.format(p.expiresAt),
                  })}
                </span>
              )}
            </div>
          </div>
          {/* Полоса расхода пакета */}
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-surface-2">
            <div
              className="grad-accent h-full rounded-full"
              style={{
                width: `${p.totalLessons > 0 ? Math.round((p.remainingLessons / p.totalLessons) * 100) : 0}%`,
              }}
            />
          </div>
        </section>
      ))}

      <section className="rounded-2xl bg-surface p-4 ring-1 ring-line shadow-sm sm:p-6">
        <div className="flex flex-col divide-y divide-line">
          {students.map((s) => {
            const pkg = s.packageId ? pkgOf.get(s.packageId) : null;
            return (
              <Link
                key={s.id}
                href={`/teacher/students/${s.id}`}
                className="group flex items-center gap-4 py-3.5 first:pt-0 last:pb-0"
              >
                <Avatar name={s.name} src={s.avatarUrl} className="h-11 w-11 text-sm" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-content group-hover:text-accent">
                    {s.name}
                  </p>
                  <p className="text-xs text-faint">
                    {s.login}
                    {s.level ? ` · ${s.level}` : ""}
                  </p>
                </div>
                <div className="hidden w-40 items-center gap-2 sm:flex">
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-2">
                    <div
                      className="grad-accent h-full rounded-full"
                      style={{ width: `${s.progress}%` }}
                    />
                  </div>
                  <span className="w-9 shrink-0 text-right text-xs font-semibold text-muted">
                    {s.progress}%
                  </span>
                </div>
                <span
                  className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${s.balance > 3 ? "tint-green" : s.balance > 0 ? "tint-amber" : "tint-rose"}`}
                >
                  {fmt(t.studentsPage.balanceLabel, { n: pkg ? pkg.remainingLessons : s.balance })}
                </span>
                <IconChevronRight className="h-4 w-4 shrink-0 text-faint group-hover:text-accent" />
              </Link>
            );
          })}
        </div>
      </section>

      <section className="rounded-2xl bg-surface p-5 ring-1 ring-line shadow-sm sm:p-6">
        <h2 className="font-semibold text-content">{t.studentsPage.addTitle}</h2>
        <p className="mt-1 text-sm text-muted">{t.studentsPage.addSubtitle}</p>
        <form action={createStudentAction} className="mt-4 grid gap-3 sm:grid-cols-3">
          <input name="name" placeholder={t.studentsPage.name} required className={inputCls} />
          <input name="login" placeholder={t.studentsPage.login} required className={inputCls} />
          <input
            name="password"
            placeholder={t.studentsPage.password}
            type="text"
            required
            className={inputCls}
          />
          <button
            type="submit"
            className="h-10 rounded-xl bg-accent px-5 text-sm font-semibold text-white transition hover:opacity-90 sm:col-span-3 sm:w-fit"
          >
            {t.studentsPage.create}
          </button>
        </form>
      </section>
    </div>
  );
}
