import Link from "next/link";
import { asc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { users, lessonPackages } from "@/lib/db/schema";
import { createStudentAction } from "@/lib/actions/teacher";
import { getDict } from "@/lib/i18n/server";
import { fmt } from "@/lib/i18n";
import { Avatar } from "@/components/avatar";
import {
  IconChevronRight,
  IconLayers,
  IconMaterials,
  IconVideo,
} from "@/components/icons";

const inputCls =
  "h-10 rounded-xl border border-line bg-surface-2 px-3.5 text-sm text-content outline-none transition placeholder:text-faint focus:border-accent";

/** По чему сортируем список. */
type SortKey = "name" | "lessons";

export default async function TeacherStudentsPage({
  searchParams,
}: {
  searchParams: Promise<{ sort?: string; dir?: string }>;
}) {
  const params = await searchParams;
  const sort: SortKey = params.sort === "lessons" ? "lessons" : "name";
  const desc = params.dir === "desc";

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
      balance: users.lessonBalance,
      avatarUrl: users.avatarUrl,
      packageId: users.packageId,
    })
    .from(users)
    .where(eq(users.role, "STUDENT"))
    .orderBy(asc(users.name));

  const packages = await db.select().from(lessonPackages);
  const pkgOf = new Map(packages.map((p) => [p.id, p]));

  // Участники каждого пакета — для подписи «общий пул на: …»
  const membersOf = new Map<string, string[]>();
  for (const s of students) {
    if (!s.packageId) continue;
    membersOf.set(s.packageId, [...(membersOf.get(s.packageId) ?? []), s.name]);
  }
  const sharedPackages = packages.filter(
    (p) => (membersOf.get(p.id) ?? []).length > 1,
  );

  /*
   * «Текущие уроки» — то же число, что в плашке справа: у кого общий пакет,
   * считается остаток пакета, у остальных — личный баланс.
   */
  const rows = students.map((s) => {
    const pkg = s.packageId ? pkgOf.get(s.packageId) : null;
    return { ...s, pkg, lessons: pkg ? pkg.remainingLessons : s.balance };
  });

  const collator = new Intl.Collator(locale === "en" ? "en" : locale);
  rows.sort((a, b) => {
    const by =
      sort === "lessons" ? a.lessons - b.lessons : collator.compare(a.name, b.name);
    // При равном числе уроков порядок всё равно должен быть предсказуемым.
    return (desc ? -by : by) || collator.compare(a.name, b.name);
  });

  /** Ссылка на ту же страницу с другой сортировкой. */
  const sortHref = (key: SortKey) =>
    `/teacher/students?sort=${key}&dir=${sort === key && !desc ? "desc" : "asc"}`;

  const sortBtn = (key: SortKey, label: string) => {
    const active = sort === key;
    return (
      <Link
        href={sortHref(key)}
        className={`flex h-8 items-center gap-1 rounded-lg px-3 text-[12px] font-semibold transition ${
          active
            ? "bg-accent-soft text-accent"
            : "text-muted hover:bg-surface-2 hover:text-content"
        }`}
      >
        {label}
        <span aria-hidden className={active ? "" : "opacity-40"}>
          {active && desc ? "↓" : "↑"}
        </span>
      </Link>
    );
  };

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
            {/* Без нижней границы текст сжимался до одного слова в строке:
                плашка с остатком отбирала всю ширину. Теперь она переносится. */}
            <div className="min-w-[10rem] flex-1">
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
        <div className="mb-3 flex flex-wrap items-center gap-2 border-b border-line pb-3">
          <span className="mr-1 text-[11px] font-semibold uppercase tracking-wide text-faint">
            {t.studentsPage.sortBy}
          </span>
          {sortBtn("name", t.studentsPage.sortName)}
          {sortBtn("lessons", t.studentsPage.sortLessons)}
        </div>

        <div className="flex flex-col divide-y divide-line">
          {rows.map((s) => (
            /* Строка перестала быть одной ссылкой: внутрь встали кнопки,
               а вкладывать кнопку в ссылку нельзя. */
            <div
              key={s.id}
              className="flex flex-wrap items-center gap-3 py-3.5 first:pt-0 last:pb-0"
            >
              {/* На телефоне имя занимает всю строку, а плашка с кнопками
                  переносится вниз — иначе от имени остаётся «A…». */}
              <Link
                href={`/teacher/students/${s.id}`}
                className="group flex w-full min-w-0 items-center gap-4 sm:w-auto sm:flex-1"
              >
                <Avatar name={s.name} src={s.avatarUrl} className="h-11 w-11 text-sm" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-content group-hover:text-accent">
                    {s.name}
                  </span>
                  <span className="block text-xs text-faint">
                    {s.login}
                    {s.level ? ` · ${s.level}` : ""}
                  </span>
                </span>
              </Link>

              <span
                className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${s.lessons > 3 ? "tint-green" : s.lessons > 0 ? "tint-amber" : "tint-rose"}`}
              >
                {fmt(t.studentsPage.balanceLabel, { n: s.lessons })}
              </span>

              {/* На узком экране подписи не помещаются — остаются одни
                  значки, поэтому кнопка там квадратная. */}
              <button
                type="button"
                disabled
                title={t.studentsPage.toClassSoon}
                aria-label={t.studentsPage.toClass}
                className="flex h-9 w-9 shrink-0 cursor-not-allowed items-center justify-center rounded-xl border border-line text-[13px] font-semibold text-faint opacity-60 sm:w-auto sm:px-3.5"
              >
                <IconVideo className="h-4 w-4 sm:hidden" />
                <span className="hidden sm:inline">{t.studentsPage.toClass}</span>
              </button>

              <Link
                href={`/teacher/students/${s.id}/materials`}
                title={t.nav.materials}
                aria-label={t.nav.materials}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-line text-[13px] font-semibold text-content transition hover:border-accent hover:text-accent sm:w-auto sm:px-3.5"
              >
                <IconMaterials className="h-4 w-4 sm:hidden" />
                <span className="hidden sm:inline">{t.nav.materials}</span>
              </Link>

              {/* Стрелка нужна только там, где строка не переносится:
                  на телефоне её роль играет само имя. */}
              <Link
                href={`/teacher/students/${s.id}`}
                aria-label={s.name}
                className="hidden h-9 w-6 shrink-0 items-center justify-center text-faint transition hover:text-accent sm:flex"
              >
                <IconChevronRight className="h-4 w-4" />
              </Link>
            </div>
          ))}
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

          {/* Остальное — по желанию, поэтому свёрнуто: быстрый ввод остаётся в три поля. */}
          <details className="group sm:col-span-3">
            <summary className="cursor-pointer list-none text-sm font-semibold text-muted transition hover:text-accent">
              <span className="inline-block transition group-open:rotate-90">›</span>{" "}
              {t.studentsPage.extraToggle}
            </summary>

            <p className="mt-2 text-xs text-faint">{t.studentsPage.extraHint}</p>

            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-medium text-muted">
                  {t.studentsPage.fBalance}
                </span>
                <input
                  name="balance"
                  type="number"
                  min={0}
                  step={1}
                  defaultValue={0}
                  className={inputCls}
                />
              </label>

              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-medium text-muted">{t.studentsPage.fUsed}</span>
                <input
                  name="used"
                  type="number"
                  min={0}
                  step={1}
                  defaultValue={0}
                  className={inputCls}
                />
              </label>

              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-medium text-muted">
                  {t.studentsPage.fStartedAt}
                </span>
                <input name="startedAt" type="date" className={inputCls} />
              </label>

              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-medium text-muted">
                  {t.studentsPage.fLessonsBefore}
                </span>
                <input
                  name="lessonsBefore"
                  type="number"
                  min={0}
                  step={1}
                  placeholder="—"
                  className={inputCls}
                />
              </label>
            </div>

            <p className="mt-2 text-xs text-faint">{t.studentsPage.fHint}</p>
          </details>

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
