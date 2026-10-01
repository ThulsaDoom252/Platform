import Link from "next/link";
import { createStudentAction } from "@/lib/actions/teacher";
import { getDict } from "@/lib/i18n/server";
import { IconChevronLeft, IconPlus, IconUser } from "@/components/icons";

const inputCls =
  "h-10 rounded-xl border border-line bg-surface-2 px-3.5 text-sm text-content outline-none transition placeholder:text-faint focus:border-accent";

export default async function NewStudentPage() {
  const { t } = await getDict();

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-5">
      <div>
        <Link
          href="/teacher/students"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted transition hover:text-accent"
        >
          <IconChevronLeft className="h-4 w-4" />
          {t.studentsPage.backToStudents}
        </Link>
        <div className="mt-4 flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-accent-soft text-accent">
            <IconUser className="h-5 w-5" />
          </span>
          <div>
            <h1 className="text-2xl font-bold text-content">{t.studentsPage.addTitle}</h1>
            <p className="mt-1 text-sm text-muted">{t.studentsPage.addSubtitle}</p>
          </div>
        </div>
      </div>

      <section className="rounded-2xl bg-surface p-5 ring-1 ring-line shadow-sm sm:p-6">
        <form action={createStudentAction} className="grid gap-3 sm:grid-cols-3">
          <input name="name" placeholder={t.studentsPage.name} required className={inputCls} />
          <input name="login" placeholder={t.studentsPage.login} required className={inputCls} />
          <input
            name="password"
            placeholder={t.studentsPage.password}
            type="text"
            required
            className={inputCls}
          />

          <details className="group sm:col-span-3">
            <summary className="cursor-pointer list-none text-sm font-semibold text-muted transition hover:text-accent">
              <span className="inline-block transition group-open:rotate-90">›</span>{" "}
              {t.studentsPage.extraToggle}
            </summary>

            <p className="mt-2 text-xs text-faint">{t.studentsPage.extraHint}</p>

            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-medium text-muted">{t.studentsPage.fBalance}</span>
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
                <span className="text-xs font-medium text-muted">{t.studentsPage.fStartedAt}</span>
                <input name="startedAt" type="date" className={inputCls} />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-medium text-muted">{t.studentsPage.fLessonsBefore}</span>
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
            className="flex h-10 items-center justify-center gap-2 rounded-xl bg-accent px-5 text-sm font-semibold text-white transition hover:brightness-95 sm:col-span-3 sm:w-fit"
          >
            <IconPlus className="h-4 w-4" />
            {t.studentsPage.create}
          </button>
        </form>
      </section>
    </div>
  );
}
