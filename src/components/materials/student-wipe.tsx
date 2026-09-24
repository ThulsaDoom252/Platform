"use client";

/**
 * Полная очистка материалов ученика.
 *
 * Действие необратимое, поэтому: сначала видно, сколько чего уедет,
 * галочки сняты по умолчанию для всего, кроме личного дерева, и внизу
 * надо набрать слово-подтверждение. Общая база не трогается — у ученика
 * забирается только доступ к её разделам.
 */
import { useState, useTransition } from "react";
import { wipeStudentMaterialsAction } from "@/lib/actions/materials";
import { IconX } from "@/components/icons";
import { cn } from "@/lib/utils";

const WORD = "УДАЛИТЬ";

export function StudentWipe({
  studentId,
  studentName,
  counts,
}: {
  studentId: string;
  studentName: string;
  counts: { personal: number; mistakes: number; access: number };
}) {
  const [open, setOpen] = useState(false);
  const [personal, setPersonal] = useState(true);
  const [mistakes, setMistakes] = useState(false);
  const [access, setAccess] = useState(false);
  const [word, setWord] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [busy, startBusy] = useTransition();

  const nothing = counts.personal + counts.mistakes + counts.access === 0;
  const picked =
    (personal ? counts.personal : 0) +
    (mistakes ? counts.mistakes : 0) +
    (access ? counts.access : 0);
  const ready = (personal || mistakes || access) && word.trim().toUpperCase() === WORD;

  function close() {
    setOpen(false);
    setWord("");
    setError(null);
  }

  function wipe() {
    setError(null);
    startBusy(async () => {
      const res = await wipeStudentMaterialsAction(studentId, {
        personal,
        mistakes,
        access,
      });

      if (res.error) {
        setError(res.error);
        return;
      }
      setDone(
        `Удалено: ${res.nodes} ${res.nodes === 1 ? "материал" : "материалов"}` +
          (res.grants > 0 ? `, снято доступов: ${res.grants}` : ""),
      );
      close();
    });
  }

  const check = (
    on: boolean,
    set: (v: boolean) => void,
    title: string,
    hint: string,
    n: number,
  ) => (
    <label
      className={cn(
        "flex cursor-pointer items-start gap-3 rounded-xl px-3 py-2.5 transition",
        n === 0 ? "opacity-50" : "hover:bg-surface-2",
      )}
    >
      <input
        type="checkbox"
        checked={on && n > 0}
        disabled={n === 0}
        onChange={(e) => set(e.target.checked)}
        className="mt-0.5 h-4 w-4 accent-[var(--accent)]"
      />
      <span className="min-w-0 flex-1">
        <span className="flex items-center justify-between gap-2">
          <span className="text-sm font-semibold text-content">{title}</span>
          <span className="shrink-0 text-[12px] text-faint">{n}</span>
        </span>
        <span className="mt-0.5 block text-[12px] text-muted">{hint}</span>
      </span>
    </label>
  );

  return (
    <div className="rounded-2xl bg-surface p-5 ring-1 ring-line shadow-sm sm:p-6">
      <h2 className="text-sm font-bold text-content">Очистить материалы</h2>
      <p className="mt-1 text-[12px] text-muted">
        Снести всё, что накопилось у {studentName}, и начать с чистого листа.
        Общая база не пострадает — у ученика заберётся только доступ к её
        разделам.
      </p>

      {done && (
        <p className="mt-3 rounded-xl bg-emerald-500/10 px-3 py-2 text-sm text-emerald-600">
          {done}
        </p>
      )}

      <button
        type="button"
        onClick={() => {
          setDone(null);
          setOpen(true);
        }}
        disabled={nothing}
        className={cn(
          "mt-3 h-10 rounded-xl border border-line px-4 text-sm font-semibold transition",
          nothing
            ? "text-faint opacity-60"
            : "text-rose-500 hover:border-rose-400 hover:bg-rose-500/10",
        )}
      >
        {nothing ? "Удалять нечего" : "Удалить материалы ученика"}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 sm:p-8">
          <div className="w-full max-w-lg rounded-2xl bg-surface p-5 shadow-xl ring-1 ring-line sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="font-semibold text-content">
                  Удалить материалы: {studentName}
                </h3>
                <p className="mt-1 text-sm text-muted">
                  Это не отменить. Отметь, что именно снести.
                </p>
              </div>
              <button
                type="button"
                onClick={close}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-faint transition hover:text-content"
              >
                <IconX className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4 flex flex-col gap-1 rounded-xl bg-surface-2 p-1.5">
              {check(
                personal,
                setPersonal,
                "Личные материалы",
                "Своё дерево ученика целиком — папки, страницы, слова, правила.",
                counts.personal,
              )}
              {check(
                mistakes,
                setMistakes,
                "Ошибки",
                "Всё, что накопилось в разделе ошибок.",
                counts.mistakes,
              )}
              {check(
                access,
                setAccess,
                "Доступ к общей базе",
                "Выданные разделы закроются. Сами разделы останутся на месте.",
                counts.access,
              )}
            </div>

            <p className="mt-3 text-[12px] text-faint">
              Уедет записей: {picked}. Перед большой чисткой можно снять копию
              базы — <code className="text-muted">npm run db:backup</code>.
            </p>

            <label className="mt-4 block">
              <span className="text-[12px] font-semibold text-muted">
                Набери {WORD}, чтобы подтвердить
              </span>
              <input
                value={word}
                onChange={(e) => setWord(e.target.value)}
                autoFocus
                className="mt-1.5 h-10 w-full rounded-xl border border-line bg-surface-2 px-3.5 text-sm text-content outline-none transition focus:border-accent"
              />
            </label>

            {error && (
              <p className="mt-3 rounded-xl bg-rose-500/10 px-3 py-2 text-sm text-rose-500">
                {error}
              </p>
            )}

            <div className="mt-4 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={wipe}
                disabled={!ready || busy}
                className="h-10 rounded-xl bg-rose-500 px-5 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-40"
              >
                {busy ? "Удаляю…" : "Удалить навсегда"}
              </button>
              <button
                type="button"
                onClick={close}
                className="text-sm text-faint transition hover:text-content"
              >
                Отмена
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
