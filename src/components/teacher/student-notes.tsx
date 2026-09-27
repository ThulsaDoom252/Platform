"use client";

/**
 * Заметки учителя об ученике.
 *
 * Ученик этого блока не видит нигде: здесь то, что помогает вести
 * занятия, а не то, что показывают. Сверху — что ученик выбрал в
 * платформе: язык, тему, ночной режим. Это не настройки, а справка:
 * когда он говорит «у меня всё по-английски», понятно почему.
 */
import { useActionState } from "react";
import { useT } from "@/components/i18n-provider";
import {
  saveStudentNotesAction,
  type StudentNotesState,
} from "@/lib/actions/teacher";

const inputCls =
  "h-10 w-full rounded-xl border border-line bg-surface-2 px-3.5 text-sm text-content outline-none transition placeholder:text-faint focus:border-accent";

export function StudentNotes({
  studentId,
  seen,
  initial,
}: {
  studentId: string;
  /** Что ученик выбрал сам — только для чтения. */
  seen: {
    locale: string;
    theme: string;
    accent: string | null;
    level: string | null;
    goal: string | null;
  };
  initial: {
    levelAtStart: string | null;
    frequentMistakes: string | null;
    teacherNote: string | null;
    showPastLessons: boolean;
  };
}) {
  const { t } = useT();
  const [state, formAction, pending] = useActionState<StudentNotesState, FormData>(
    saveStudentNotesAction,
    {},
  );

  const LOCALES: Record<string, string> = {
    en: "English",
    ru: "Русский",
    uk: "Українська",
  };

  const row = (label: string, value: string) => (
    <div className="flex items-baseline justify-between gap-3 border-b border-line py-1.5 last:border-0">
      <span className="text-[12px] text-faint">{label}</span>
      <span className="text-right text-[13px] font-semibold text-content">{value}</span>
    </div>
  );

  return (
    <section className="rounded-2xl bg-surface p-5 ring-1 ring-line shadow-sm sm:p-6">
      <p className="font-semibold text-content">{t.profile.forTeacher}</p>
      <p className="mt-0.5 text-[12px] text-faint">{t.profile.forTeacherHint}</p>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        {/* Что ученик выбрал сам */}
        <div className="rounded-xl bg-surface-2 px-3.5 py-2">
          {row(t.profile.interfaceLang, LOCALES[seen.locale] ?? seen.locale)}
          {row(t.profile.themeName, seen.accent ?? "—")}
          {row(
            t.profile.nightMode,
            seen.theme === "DARK" ? t.profile.nightOn : t.profile.nightOff,
          )}
          {row(t.profile.levelNow, seen.level ?? "—")}
          {row(t.profile.goal, seen.goal ?? "—")}
        </div>

        {/* Что пишет сам учитель */}
        <form action={formAction} className="flex flex-col gap-3">
          <input type="hidden" name="studentId" value={studentId} />

          <label className="block">
            <span className="text-sm font-medium text-content">
              {t.profile.levelAtStart}
            </span>
            <input
              name="levelAtStart"
              defaultValue={initial.levelAtStart ?? ""}
              placeholder="A2"
              className={`${inputCls} mt-1.5`}
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium text-content">
              {t.profile.frequentMistakes}
            </span>
            <textarea
              name="frequentMistakes"
              defaultValue={initial.frequentMistakes ?? ""}
              rows={3}
              className="mt-1.5 w-full resize-y rounded-xl border border-line bg-surface-2 px-3.5 py-2.5 text-sm text-content outline-none transition focus:border-accent"
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium text-content">
              {t.profile.teacherNote}
            </span>
            <textarea
              name="teacherNote"
              defaultValue={initial.teacherNote ?? ""}
              rows={3}
              className="mt-1.5 w-full resize-y rounded-xl border border-line bg-surface-2 px-3.5 py-2.5 text-sm text-content outline-none transition focus:border-accent"
            />
          </label>

          <label className="flex items-start gap-2.5 rounded-xl bg-surface-2 px-3.5 py-2.5">
            <input
              type="checkbox"
              name="showPastLessons"
              defaultChecked={initial.showPastLessons}
              className="mt-0.5 h-4 w-4 accent-[var(--accent)]"
            />
            <span>
              <span className="block text-sm font-medium text-content">
                {t.profile.pastLessons}
              </span>
              <span className="block text-[12px] text-faint">
                {t.profile.pastLessonsHint}
              </span>
            </span>
          </label>

          {state.error && <p className="text-sm text-rose-500">{state.error}</p>}
          {state.ok && <p className="text-sm text-accent">{state.message}</p>}

          <button
            type="submit"
            disabled={pending}
            className="h-10 self-start rounded-xl bg-accent px-5 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
          >
            {t.profile.saveChanges}
          </button>
        </form>
      </div>
    </section>
  );
}
