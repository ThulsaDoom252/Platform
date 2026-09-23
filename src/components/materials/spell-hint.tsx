"use client";

import { useEffect, useState } from "react";
import { checkSpellingAction, type Misspelling } from "@/lib/actions/materials";
import { cn } from "@/lib/utils";

const OFF_KEY = "lingora.spellcheck.off";

/**
 * Подчёркивает ошибки в названии и предлагает замену.
 * Проверка идёт на сервере, где лежат словари трёх языков; ответ ждём
 * после паузы в наборе, чтобы не дёргать его на каждую букву.
 */
export function SpellHint({
  text,
  onFix,
}: {
  text: string;
  /** Заменить слово в названии: позиция и новое написание. */
  onFix: (start: number, end: number, word: string) => void;
}) {
  const [errors, setErrors] = useState<Misspelling[]>([]);
  const [open, setOpen] = useState<number | null>(null);
  const [off, setOff] = useState(false);

  // Настройка живёт в браузере: это привычка учителя, а не свойство данных.
  useEffect(() => {
    try {
      setOff(localStorage.getItem(OFF_KEY) === "1");
    } catch {
      /* приватный режим — просто проверяем */
    }
  }, []);

  useEffect(() => {
    if (off || !text.trim()) {
      setErrors([]);
      return;
    }
    let alive = true;
    const t = setTimeout(async () => {
      try {
        const found = await checkSpellingAction(text);
        if (alive) setErrors(found);
      } catch {
        // Проверка — помощник, а не преграда: молча пропускаем.
        if (alive) setErrors([]);
      }
    }, 600);

    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [text, off]);

  function disable() {
    setOff(true);
    setErrors([]);
    try {
      localStorage.setItem(OFF_KEY, "1");
    } catch {
      /* не сохранилось — и ладно */
    }
  }

  if (off || errors.length === 0) return null;

  // Разрезаем название на куски: обычный текст и слова с ошибкой.
  const parts: { text: string; error?: Misspelling }[] = [];
  let at = 0;
  for (const e of errors) {
    if (e.start > at) parts.push({ text: text.slice(at, e.start) });
    parts.push({ text: text.slice(e.start, e.end), error: e });
    at = e.end;
  }
  if (at < text.length) parts.push({ text: text.slice(at) });

  return (
    <div className="mt-1.5 rounded-xl bg-surface-2 px-3 py-2">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-faint">
          Орфография
        </span>

        <p className="text-sm text-content">
          {parts.map((p, i) =>
            p.error ? (
              <button
                key={i}
                type="button"
                onClick={() => setOpen(open === p.error!.start ? null : p.error!.start)}
                className="underline decoration-rose-500 decoration-wavy underline-offset-4 transition hover:text-rose-500"
              >
                {p.text}
              </button>
            ) : (
              <span key={i}>{p.text}</span>
            ),
          )}
        </p>

        <button
          type="button"
          onClick={disable}
          title="Больше не проверять названия"
          className="ml-auto text-[11px] text-faint transition hover:text-content"
        >
          не проверять
        </button>
      </div>

      {errors.map((e) =>
        open === e.start ? (
          <div key={e.start} className="mt-2 flex flex-wrap items-center gap-1.5">
            <span className="text-[12px] text-muted">«{e.word}» →</span>
            {e.suggestions.length === 0 && (
              <span className="text-[12px] text-faint">вариантов нет</span>
            )}
            {e.suggestions.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => {
                  onFix(e.start, e.end, s);
                  setOpen(null);
                }}
                className={cn(
                  "h-7 rounded-lg bg-surface px-2.5 text-[12px] font-semibold text-content",
                  "ring-1 ring-line transition hover:bg-accent-soft hover:text-accent",
                )}
              >
                {s}
              </button>
            ))}
          </div>
        ) : null,
      )}
    </div>
  );
}
