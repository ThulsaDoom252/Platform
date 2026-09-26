"use client";

/**
 * Правка списка неправильных глаголов.
 *
 * Строка на глагол: значок, три формы с транскрипциями, перевод и
 * категория. Категория подсказывается из уже заведённых, но её можно
 * вписать любую — так и добавляются новые.
 */
import { useState, useTransition } from "react";
import { saveVerbsAction, type VerbEdit } from "@/lib/actions/materials";
import type { MaterialVerb } from "@/lib/materials";
import { IconX, IconPlus, IconTrash } from "@/components/icons";
import { cn } from "@/lib/utils";

const cell =
  "h-9 w-full rounded-lg border border-line bg-surface px-2 text-[13px] text-content outline-none transition focus:border-accent";

export function VerbsEditor({
  node,
  onClose,
  onDone,
}: {
  node: { id: string; name: string; verbs: MaterialVerb[] } | null;
  onClose: () => void;
  onDone: (message: string) => void;
}) {
  const [rows, setRows] = useState<VerbEdit[]>(() =>
    (node?.verbs ?? []).map((v) => ({
      id: v.id,
      category: v.category,
      icon: v.icon,
      base: v.base,
      baseIpa: v.baseIpa,
      past: v.past,
      pastIpa: v.pastIpa,
      participle: v.participle,
      participleIpa: v.participleIpa,
      translation: v.translation,
    })),
  );
  const [error, setError] = useState<string | null>(null);
  const [busy, startBusy] = useTransition();

  if (!node) return null;

  const categories = [
    ...new Set(rows.map((r) => r.category?.trim()).filter(Boolean)),
  ] as string[];

  const patch = (index: number, part: Partial<VerbEdit>) =>
    setRows((prev) => prev.map((r, i) => (i === index ? { ...r, ...part } : r)));

  function save() {
    setError(null);
    startBusy(async () => {
      const res = await saveVerbsAction(node!.id, rows);
      if (res.error) {
        setError(res.error);
        return;
      }
      onDone(res.message ?? "Сохранено");
      onClose();
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 sm:p-8">
      <div className="w-full max-w-5xl rounded-2xl bg-surface p-5 shadow-xl ring-1 ring-line sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="font-semibold text-content">Правка глаголов: «{node.name}»</h2>
            <p className="mt-1 text-sm text-muted">
              Пустая категория значит «без категории» — такие идут первыми.
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

        <div className="mt-4 max-h-[60vh] overflow-y-auto rounded-xl bg-surface-2 p-2">
          {rows.map((r, i) => (
            <div key={r.id || `new-${i}`} className="mb-1.5 flex flex-wrap items-center gap-1.5">
              <input
                value={r.icon ?? ""}
                onChange={(e) => patch(i, { icon: [...e.target.value][0] ?? null })}
                placeholder="—"
                title="Значок"
                className={cn(cell, "w-10 shrink-0 text-center")}
              />
              <input
                value={r.base}
                onChange={(e) => patch(i, { base: e.target.value })}
                placeholder="base"
                className={cn(cell, "w-28 shrink-0")}
              />
              <input
                value={r.baseIpa ?? ""}
                onChange={(e) => patch(i, { baseIpa: e.target.value || null })}
                placeholder="/…/"
                className={cn(cell, "w-24 shrink-0 text-faint")}
              />
              <input
                value={r.past}
                onChange={(e) => patch(i, { past: e.target.value })}
                placeholder="past"
                className={cn(cell, "w-28 shrink-0")}
              />
              <input
                value={r.pastIpa ?? ""}
                onChange={(e) => patch(i, { pastIpa: e.target.value || null })}
                placeholder="/…/"
                className={cn(cell, "w-24 shrink-0 text-faint")}
              />
              <input
                value={r.participle}
                onChange={(e) => patch(i, { participle: e.target.value })}
                placeholder="participle"
                className={cn(cell, "w-28 shrink-0")}
              />
              <input
                value={r.participleIpa ?? ""}
                onChange={(e) => patch(i, { participleIpa: e.target.value || null })}
                placeholder="/…/"
                className={cn(cell, "w-24 shrink-0 text-faint")}
              />
              <input
                value={r.translation ?? ""}
                onChange={(e) => patch(i, { translation: e.target.value || null })}
                placeholder="перевод"
                className={cn(cell, "min-w-[8rem] flex-1")}
              />
              <input
                value={r.category ?? ""}
                onChange={(e) => patch(i, { category: e.target.value || null })}
                list="verbs-editor-categories"
                placeholder="категория"
                className={cn(cell, "w-36 shrink-0")}
              />
              <button
                type="button"
                onClick={() => setRows((prev) => prev.filter((_, k) => k !== i))}
                title="Убрать глагол"
                className="flex h-9 w-8 shrink-0 items-center justify-center rounded-lg text-faint transition hover:text-rose-500"
              >
                <IconTrash className="h-4 w-4" />
              </button>
            </div>
          ))}

          <datalist id="verbs-editor-categories">
            {categories.map((name) => (
              <option key={name} value={name} />
            ))}
          </datalist>

          <button
            type="button"
            onClick={() =>
              setRows((prev) => [
                ...prev,
                {
                  id: "",
                  category: prev[prev.length - 1]?.category ?? null,
                  icon: null,
                  base: "",
                  baseIpa: null,
                  past: "",
                  pastIpa: null,
                  participle: "",
                  participleIpa: null,
                  translation: null,
                },
              ])
            }
            className="mt-1 flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-[13px] font-semibold text-muted transition hover:text-accent"
          >
            <IconPlus className="h-4 w-4" /> Добавить глагол
          </button>
        </div>

        {error && (
          <p className="mt-3 rounded-xl bg-rose-500/10 px-3 py-2 text-sm text-rose-500">
            {error}
          </p>
        )}

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={save}
            disabled={busy}
            className="h-10 rounded-xl bg-accent px-5 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-60"
          >
            {busy ? "Сохраняю…" : `Сохранить (${rows.length})`}
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
