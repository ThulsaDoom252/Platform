"use client";

/**
 * Карточка ученика: сначала то, что он рассказал о себе, следом — то, что
 * о нём ведёт учитель. Одна панель, а не две: читают её сверху вниз, и
 * разрывать анкету на два блока с разными кнопками сохранения незачем.
 *
 * Анкета вверху только для чтения — её заполняет сам ученик у себя в
 * профиле. Уровень и цель правит учитель, но их ученик тоже видит,
 * поэтому они вынесены отдельно и подписаны.
 */
import { useActionState } from "react";
import { useT } from "@/components/i18n-provider";
import {
  saveStudentNotesAction,
  type StudentNotesState,
} from "@/lib/actions/teacher";

const inputCls =
  "h-10 w-full rounded-xl border border-line bg-surface-2 px-3.5 text-sm text-content outline-none transition placeholder:text-faint focus:border-accent";

const areaCls =
  "w-full resize-y rounded-xl border border-line bg-surface-2 px-3.5 py-2.5 text-sm text-content outline-none transition placeholder:text-faint focus:border-accent";

export type StudentCard = {
  /** Анкета — её ведёт сам ученик. */
  email: string | null;
  phone: string | null;
  telegram: string | null;
  viber: string | null;
  contactNote: string | null;
  hobby: string | null;
  homeland: string | null;
  country: string | null;
  city: string | null;
  /** Что ученик выбрал в платформе. */
  locale: string;
  theme: string;
  accent: string | null;
  /** Учёба — это правит учитель, но видит и ученик. */
  level: string | null;
  goal: string | null;
  /** Только для учителя. */
  levelAtStart: string | null;
  frequentMistakes: string | null;
  teacherNote: string | null;
  showPastLessons: boolean;
};

export function StudentNotes({
  studentId,
  card,
}: {
  studentId: string;
  card: StudentCard;
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

  const ACCENTS: Record<string, string> = {
    indigo: t.settings.themeIndigo,
    emerald: t.settings.themeEmerald,
    rose: t.settings.themeRose,
    violet: t.settings.themeViolet,
  };

  /** Строка анкеты. Пустое поле показываем прочерком, а не пропускаем:
      видно, что именно ученик ещё не заполнил. */
  const row = (label: string, value: string | null) => (
    <div className="flex items-baseline justify-between gap-3 border-b border-line py-1.5 last:border-0">
      <span className="shrink-0 text-[12px] text-faint">{label}</span>
      <span
        className={
          value
            ? "min-w-0 break-words text-right text-[13px] font-semibold text-content"
            : "text-right text-[12px] text-faint"
        }
      >
        {value || "—"}
      </span>
    </div>
  );

  const field = (
    label: string,
    name: string,
    value: string | null,
    placeholder?: string,
  ) => (
    <label className="block">
      <span className="text-sm font-medium text-content">{label}</span>
      <input
        name={name}
        defaultValue={value ?? ""}
        placeholder={placeholder}
        className={`${inputCls} mt-1.5`}
      />
    </label>
  );

  const area = (label: string, name: string, value: string | null) => (
    <label className="block">
      <span className="text-sm font-medium text-content">{label}</span>
      <textarea name={name} defaultValue={value ?? ""} rows={3} className={`${areaCls} mt-1.5`} />
    </label>
  );

  return (
    <section className="rounded-2xl bg-surface p-5 ring-1 ring-line shadow-sm sm:p-6">
      {/* 1. Анкета ученика */}
      <p className="font-semibold text-content">{t.profile.studentFilled}</p>
      <p className="mt-0.5 text-[12px] text-faint">{t.profile.studentFilledHint}</p>

      <div className="mt-3 grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl bg-surface-2 px-3.5 py-2">
          {row(t.profile.email, card.email)}
          {row(t.profile.phone, card.phone)}
          {row(t.profile.telegram, card.telegram)}
          {row(t.profile.viber, card.viber)}
          {row(t.profile.contactNote, card.contactNote)}
        </div>
        <div className="rounded-xl bg-surface-2 px-3.5 py-2">
          {row(t.profile.hobby, card.hobby)}
          {row(t.profile.homeland, card.homeland)}
          {row(t.profile.country, card.country)}
          {row(t.profile.city, card.city)}
        </div>
      </div>

      {/* 2. Информация для учителя */}
      <div className="mt-6 border-t border-line pt-5">
        <p className="font-semibold text-content">{t.profile.forTeacher}</p>
        <p className="mt-0.5 text-[12px] text-faint">{t.profile.forTeacherHint}</p>

        {/* Что ученик выбрал в платформе — справка, а не настройки:
            когда он говорит «у меня всё по-английски», понятно почему. */}
        <div className="mt-3 rounded-xl bg-surface-2 px-3.5 py-2">
          <p className="border-b border-line pb-1.5 text-[11px] font-bold uppercase tracking-wide text-faint">
            {t.profile.platform}
          </p>
          {row(t.profile.interfaceLang, LOCALES[card.locale] ?? card.locale)}
          {row(
            t.profile.themeName,
            card.accent ? (ACCENTS[card.accent] ?? card.accent) : null,
          )}
          {row(
            t.profile.nightMode,
            card.theme === "DARK" ? t.profile.nightOn : t.profile.nightOff,
          )}
        </div>

        <form action={formAction} className="mt-4 flex flex-col gap-3">
          <input type="hidden" name="studentId" value={studentId} />

          <div className="rounded-xl border border-line p-3.5">
            <p className="text-[11px] text-faint">{t.profile.sharedWithStudent}</p>
            <div className="mt-2 grid gap-3 sm:grid-cols-2">
              {field(t.profile.levelNow, "level", card.level, "B1")}
              {field(t.profile.goal, "goal", card.goal)}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {field(t.profile.levelAtStart, "levelAtStart", card.levelAtStart, "A2")}
          </div>

          {area(t.profile.frequentMistakes, "frequentMistakes", card.frequentMistakes)}
          {area(t.profile.teacherNote, "teacherNote", card.teacherNote)}

          <label className="flex items-start gap-2.5 rounded-xl bg-surface-2 px-3.5 py-2.5">
            <input
              type="checkbox"
              name="showPastLessons"
              defaultChecked={card.showPastLessons}
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
          {state.ok && <p className="text-sm text-accent">{t.common.saved}</p>}

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
