import Link from "next/link";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { getSession } from "@/lib/session";
import { getStudentFeed } from "@/lib/notifications";
import { getDict } from "@/lib/i18n/server";
import { fmt } from "@/lib/i18n";
import { I18nProvider } from "@/components/i18n-provider";
import { logoutAction, returnToTeacherAction } from "@/lib/actions/auth";
import { StudentSidebarNav } from "@/components/student/sidebar-nav";
import { StudentMobileNav } from "@/components/student/mobile-nav";
import { NotificationBell } from "@/components/teacher/notification-bell";
import { Avatar } from "@/components/avatar";
import {
  IconCap,
  IconSearch,
  IconLogout,
  IconChevronLeft,
  IconChevronDown,
} from "@/components/icons";

export default async function StudentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session || session.role !== "STUDENT") redirect("/login");

  const [me] = await db
    .select({ name: users.name, avatarUrl: users.avatarUrl, level: users.level })
    .from(users)
    .where(eq(users.id, session.userId))
    .limit(1);
  if (!me) redirect("/login");

  const { t, locale } = await getDict();
  const { items, unreadCount } = await getStudentFeed(session.userId, locale);

  const roleLine = me.level
    ? fmt(t.studentDash.roleLine, { level: me.level })
    : t.topbar.roleStudent;

  return (
    <I18nProvider locale={locale}>
      <div className="min-h-screen bg-page">
        <div className="mx-auto flex w-full max-w-[1440px]">
          {/* Sidebar */}
          <aside className="sticky top-0 hidden h-screen w-[264px] shrink-0 flex-col gap-6 border-r border-line bg-surface px-5 py-6 lg:flex">
            <Link href="/student" className="flex items-center gap-3 px-1">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-accent text-white shadow-md">
                <IconCap className="h-6 w-6" />
              </div>
              <div>
                <p className="text-lg font-bold leading-none text-content">Lingora</p>
                <p className="mt-1 text-[11px] font-medium tracking-wide text-faint">
                  {t.brand.tagline}
                </p>
              </div>
            </Link>

            <StudentSidebarNav />

            <div className="mt-auto flex flex-col gap-4">
              <div className="rounded-2xl bg-accent-soft p-4">
                <p className="text-sm font-semibold text-content">{t.brand.smallSteps}</p>
              </div>
              <p className="px-1 text-[11px] italic leading-relaxed text-faint">
                {t.brand.quote}
                <br />— Lingora
              </p>
            </div>
          </aside>

          {/* Main column */}
          <div className="flex min-w-0 flex-1 flex-col">
            <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-line bg-surface/80 px-4 py-3 backdrop-blur-md sm:gap-4 sm:px-8 sm:py-3.5">
              <Link href="/student" className="flex items-center gap-2 lg:hidden">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-accent text-white">
                  <IconCap className="h-5 w-5" />
                </div>
                <span className="font-bold text-content">Lingora</span>
              </Link>

              <label className="relative hidden max-w-md flex-1 items-center sm:flex">
                <IconSearch className="absolute left-3.5 h-4.5 w-4.5 text-faint" />
                <input
                  type="text"
                  placeholder={t.topbar.searchPlaceholder}
                  className="h-10 w-full rounded-xl border border-line bg-surface-2 pl-10 pr-4 text-sm text-content outline-none transition placeholder:text-faint focus:border-accent"
                />
              </label>

              <div className="ml-auto flex items-center gap-2 sm:gap-3">
                {session.impersonatedBy && (
                  <form action={returnToTeacherAction}>
                    <button
                      type="submit"
                      className="flex h-9 items-center gap-1.5 rounded-xl bg-accent px-2.5 text-xs font-bold text-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md sm:px-3"
                      title={`Вернуться в аккаунт учителя ${session.impersonatedBy.teacherName}`}
                    >
                      <IconChevronLeft className="h-4 w-4" />
                      <span className="hidden sm:inline">К учителю</span>
                    </button>
                  </form>
                )}

                <NotificationBell items={items} unreadCount={unreadCount} />

                <Link
                  href="/student/profile"
                  title={t.topbar.profile}
                  className="flex items-center gap-2.5 rounded-xl px-1.5 py-1 transition hover:bg-surface-2"
                >
                  <Avatar
                    name={me.name}
                    src={me.avatarUrl}
                    className="h-9 w-9 text-sm"
                  />
                  <span className="hidden text-right sm:block">
                    <span className="block text-sm font-semibold leading-none text-content">
                      {me.name}
                    </span>
                    <span className="mt-0.5 block text-[11px] text-faint">{roleLine}</span>
                  </span>
                  <IconChevronDown className="hidden h-4 w-4 text-faint sm:block" />
                </Link>

                <form action={logoutAction}>
                  <button
                    type="submit"
                    className="flex items-center gap-2 rounded-xl border border-line px-2.5 py-2 text-sm font-medium text-muted transition hover:bg-surface-2 hover:text-content sm:px-3"
                  >
                    <IconLogout className="h-4 w-4" />
                    <span className="hidden sm:inline">{t.topbar.logout}</span>
                  </button>
                </form>
              </div>
            </header>

            <main className="flex-1 px-4 py-6 pb-24 sm:px-8 lg:pb-6">{children}</main>
          </div>
        </div>

        <StudentMobileNav />
      </div>
    </I18nProvider>
  );
}
