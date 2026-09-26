"use client";

/**
 * Заполнение страницы неправильных глаголов.
 *
 * Два режима. «Категории» — столько блоков, сколько групп нужно: у
 * каждого своё имя и своё место для вставки. Имена по умолчанию
 * порядковые (1st, 2nd, 3rd), но переименовываются как угодно, и
 * переименование подхватывает уже заведённые глаголы этой группы.
 * «Без категории» — одно поле, такие глаголы идут первой группой.
 */
import { useState, useTransition } from "react";
import { importVerbsAction, type VerbsGroup } from "@/lib/actions/materials";
import { parseIrregularVerbs } from "@/lib/verbs-parser";
import { IconX, IconPlus, IconTrash } from "@/components/icons";
import { cn } from "@/lib/utils";

export type VerbsTarget = { id: string; name: string; categories: string[] };

/** Имя группы по умолчанию: 1st, 2nd, 3rd, 4th… */
export function ordinal(n: number): string {
  const tail = n % 100;
  if (tail >= 11 && tail <= 13) return `${n}th`;
  return `${n}${["th", "st", "nd", "rd"][n % 10] ?? "th"}`;
}

type Block = { key: string; original: string | null; name: string; text: string };

const area =
  "w-full resize-y rounded-xl border border-line bg-surface-2 p-3 text-sm text-content outline-none transition placeholder:text-faint focus:border-accent";

const PLACEHOLDER = "🔊 buy /baɪ/    bought /bɔːt/    bought /bɔːt/    купувати";

export function VerbsFiller({
  target,
  onClose,
  onDone,
}: {
  target: VerbsTarget | null;
  onClose: () => void;
  onDone: (message: string) => void;
}) {
  const [mode, setMode] = useState<"categories" | "plain">("categories");
  const [blocks, setBlocks] = useState<Block[]>(() => {
    const existing = target?.categories ?? [];
    if (existing.length > 0) {
      return existing.map((name, i) => ({
        key: `c${i}`,
        original: name,
        name,
        text: "",
      }));
    }
    // По умолчанию одна группа — остальные добавляются кнопкой.
    return [{ key: "c0", original: null, name: ordinal(1), text: "" }];
  });
  const [plain, setPlain] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, startBusy] = useTransition();

  if (!target) return null;

  const patch = (key: string, part: Partial<Block>) =>
    setBlocks((prev) => prev.map((b) => (b.key === key ? { ...b, ...part } : b)));

  const found = (text: string) =>
    text.trim() ? parseIrregularVerbs(text).verbs.length : 0;

  const total =
    mode === "plain"
      ? found(plain)
      : blocks.reduce((sum, b) => sum + found(b.text), 0);

  const renames =
    mode === "categories"
      ? blocks.filter((b) => b.original !== null && b.name.trim() !== b.original).length
      : 0;

  function save() {
    setError(null);
    const groups: VerbsGroup[] =
      mode === "plain"
        ? [{ original: null, name: null, text: plain }]
        : blocks.map((b) => ({
            original: b.original,
            name: b.name.trim() || null,
            text: b.text,
          }));

    startBusy(async () => {
      const res = await importVerbsAction(target!.id, groups);
      if (res.error) {
        setError(res.error);
        return;
      }
      const parts = [];
      if (res.added > 0) parts.push(`добавлено ${res.added}`);
      if (res.renamed > 0) parts.push(`переименовано ${res.renamed}`);
      onDone(`Глаголы: ${parts.join(", ")}`);
      onClose();
    });
  }

  const tab = (value: "categories" | "plain", label: string) => (
    <button
      type="button"
      onClick={() => setMode(value)}
      className={cn(
        "h-9 rounded-xl px-3.5 text-sm font-semibold transition",
        mode === value ? "bg-accent text-white" : "bg-surface-2 text-muted hover:text-content",
      )}
    >
      {label}
    </button>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 sm:p-8">
      <div className="w-full max-w-3xl rounded-2xl bg-surface p-5 shadow-xl ring-1 ring-line sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="font-semibold text-content">
              Неправильные глаголы: «{target.name}»
            </h2>
            <p className="mt-1 text-sm text-muted">
              Вставляй таблицы из Google Docs в любом виде. Уже добавленные
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

        <div className="mt-4 flex flex-wrap gap-1.5">
          {tab("categories", "Категории")}
          {tab("plain", "Без категории")}
        </div>

        {mode === "categories" ? (
          <div className="mt-4 flex flex-col gap-3">
            {blocks.map((b, i) => {
              const count = found(b.text);
              return (
                <div key={b.key} className="rounded-xl bg-surface-2 p-3">
                  <div className="flex items-center gap-2">
                    <input
                      value={b.name}
                      onChange={(e) => patch(b.key, { name: e.target.value })}
                      placeholder={ordinal(i + 1)}
                      title="Название категории — его видно над списком"
                      className="h-9 min-w-0 flex-1 rounded-lg border border-line bg-surface px-2.5 text-sm font-semibold text-content outline-none transition focus:border-accent"
                    />
                    {count > 0 && (
                      <span className="shrink-0 text-[11px] text-faint">найдено {count}</span>
                    )}
                    {blocks.length > 1 && (
                      <button
                        type="button"
                        onClick={() => setBlocks((prev) => prev.filter((x) => x.key !== b.key))}
                        title={
                          b.original
                            ? "Убрать блок из этого окна. Заведённые глаголы останутся."
                            : "Убрать блок"
                        }
                        className="flex h-9 w-8 shrink-0 items-center justify-center rounded-lg text-faint transition hover:text-rose-500"
                      >
                        <IconTrash className="h-4 w-4" />
                      </button>
                    )}
                  </div>

                  <textarea
                    value={b.text}
                    onChange={(e) => patch(b.key, { text: e.target.value })}
                    rows={5}
                    placeholder={PLACEHOLDER}
                    className={cn(area, "mt-2")}
                  />
                </div>
              );
            })}

            <button
              type="button"
              onClick={() =>
                setBlocks((prev) => [
                  ...prev,
                  {
                    key: `c${Date.now()}`,
                    original: null,
                    name: ordinal(prev.length + 1),
                    text: "",
                  },
                ])
              }
              className="flex h-10 items-center justify-center gap-2 rounded-xl border border-dashed border-line text-sm font-semibold text-muted transition hover:border-accent hover:text-accent"
            >
              <IconPlus className="h-4 w-4" /> Категория
            </button>
          </div>
        ) : (
          <div className="mt-4">
            <p className="mb-2 text-[12px] text-faint">
              Эти глаголы попадут в «Без категории» — такая группа показывается
              первой.
            </p>
            <textarea
              value={plain}
              onChange={(e) => setPlain(e.target.value)}
              rows={12}
              placeholder={PLACEHOLDER}
              className={area}
            />
          </div>
        )}

        {error && (
          <p className="mt-3 rounded-xl bg-rose-500/10 px-3 py-2 text-sm text-rose-500">
            {error}
          </p>
        )}

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={save}
            disabled={busy || (total === 0 && renames === 0)}
            className="h-10 rounded-xl bg-accent px-5 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-40"
          >
            {busy ? "Сохраняю…" : total > 0 ? `Сохранить (${total})` : "Сохранить"}
          </button>
          {renames > 0 && (
            <span className="text-[12px] text-faint">
              переименований: {renames}
            </span>
          )}
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
