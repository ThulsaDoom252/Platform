"use client";

/**
 * Заполнение страницы неправильных глаголов.
 *
 * Два поля: название категории и сама вставка. Категорию можно оставить
 * пустой — тогда глаголы попадут в «Без категории» и встанут первыми.
 * Кнопка одна на всё: уже заведённые глаголы остаются, новые дописываются,
 * повторы пропускаются.
 */
import { useState, useTransition } from "react";
import { fillVerbsAction } from "@/lib/actions/materials";
import { parseIrregularVerbs } from "@/lib/verbs-parser";
import { IconX } from "@/components/icons";

export type VerbsTarget = { id: string; name: string; categories: string[] };

export function VerbsFiller({
  target,
  onClose,
  onDone,
}: {
  target: VerbsTarget | null;
  onClose: () => void;
  onDone: (message: string) => void;
}) {
  const [category, setCategory] = useState("");
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, startBusy] = useTransition();

  if (!target) return null;

  // Разбираем на лету: видно, сколько глаголов найдётся, ещё до сохранения.
  const preview = text.trim() ? parseIrregularVerbs(text) : null;

  function fill() {
    setError(null);
    startBusy(async () => {
      const res = await fillVerbsAction(target!.id, category, text);
      if (res.error) {
        setError(res.error);
        return;
      }
      onDone(`Добавлено глаголов: ${res.added}`);
      onClose();
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 sm:p-8">
      <div className="w-full max-w-2xl rounded-2xl bg-surface p-5 shadow-xl ring-1 ring-line sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="font-semibold text-content">
              Неправильные глаголы: «{target.name}»
            </h2>
            <p className="mt-1 text-sm text-muted">
              Вставь таблицу из Google Docs в любом виде. Уже добавленные
              глаголы останутся, повторы пропустятся.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-faint transition hover:text-content"
          >
            <IconX className="h-4 w-4" />
          </button>
        </div>

        <label className="mt-4 block">
          <span className="text-[12px] font-semibold text-muted">
            Категория — можно оставить пустой
          </span>
          <input
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            list="verb-categories"
            placeholder="Например: bought / thought / brought"
            className="mt-1.5 h-10 w-full rounded-xl border border-line bg-surface-2 px-3.5 text-sm text-content outline-none transition placeholder:text-faint focus:border-accent"
          />
          <datalist id="verb-categories">
            {target.categories.map((name) => (
              <option key={name} value={name} />
            ))}
          </datalist>
        </label>

        <label className="mt-3 block">
          <span className="text-[12px] font-semibold text-muted">Таблица глаголов</span>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={10}
            placeholder="🔊 buy /baɪ/    bought /bɔːt/    bought /bɔːt/    купувати"
            className="mt-1.5 w-full resize-y rounded-xl border border-line bg-surface-2 p-3 text-sm text-content outline-none transition placeholder:text-faint focus:border-accent"
          />
        </label>

        {preview && (
          <p className="mt-2 text-[12px] text-faint">
            Найдено глаголов: {preview.verbs.length}
            {preview.title ? ` · заголовок «${preview.title}»` : ""}
            {preview.warnings.length > 0 ? ` · ${preview.warnings.join("; ")}` : ""}
          </p>
        )}

        {error && (
          <p className="mt-3 rounded-xl bg-rose-500/10 px-3 py-2 text-sm text-rose-500">
            {error}
          </p>
        )}

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={fill}
            disabled={busy || !preview || preview.verbs.length === 0}
            className="h-10 rounded-xl bg-accent px-5 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-40"
          >
            {busy
              ? "Добавляю…"
              : preview && preview.verbs.length > 0
                ? `Заполнить (${preview.verbs.length})`
                : "Заполнить"}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="text-sm text-faint transition hover:text-content"
          >
            Отмена
          </button>
        </div>
      </div>
    </div>
  );
}
