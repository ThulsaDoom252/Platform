"use client";

/**
 * Порядок дерева материалов: режим и сохранённые расстановки.
 *
 * Режим — это взгляд, он ничего не записывает: ручной порядок разделов
 * остаётся в базе, и к нему можно вернуться одним щелчком. Расстановку
 * можно сохранить и вернуть позже — их держим не больше пяти, иначе
 * список сам становится свалкой.
 */
import { useState } from "react";
import {
  MAX_PRESETS,
  SORT_LABEL,
  type SortMode,
  type TreePreset,
} from "@/lib/tree-sort";
import { IconChevronDown, IconCheck, IconTrash, IconX } from "@/components/icons";
import { cn } from "@/lib/utils";

const MODES: SortMode[] = [
  "name-asc",
  "name-desc",
  "added-asc",
  "added-desc",
  "manual",
];

export function TreeSorter({
  mode,
  presetId,
  presets,
  onMode,
  onLoadPreset,
  onSavePreset,
  onDeletePreset,
}: {
  mode: SortMode;
  presetId: string | null;
  presets: TreePreset[];
  onMode: (mode: SortMode) => void;
  onLoadPreset: (id: string) => void;
  onSavePreset: (name: string) => void;
  onDeletePreset: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState("");

  const active = presetId
    ? (presets.find((p) => p.id === presetId)?.name ?? "Расстановка")
    : SORT_LABEL[mode];

  function save() {
    const clean = name.trim().slice(0, 40);
    if (!clean) return;
    onSavePreset(clean);
    setName("");
    setNaming(false);
    setOpen(false);
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        title="Порядок разделов"
        className={cn(
          "flex h-7 items-center gap-1 rounded-lg px-2 text-[11px] font-semibold transition",
          open ? "bg-accent text-white" : "text-faint hover:bg-surface-2 hover:text-content",
        )}
      >
        <span aria-hidden>⇅</span>
        <span className="max-w-[92px] truncate">{active}</span>
        <IconChevronDown className="h-3 w-3" />
      </button>

      {open && (
        <>
          {/* Клик мимо закрывает список. */}
          <button
            type="button"
            aria-label="Закрыть"
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-20 cursor-default"
          />

          <div className="absolute right-0 top-8 z-30 w-60 rounded-xl bg-surface p-1.5 shadow-xl ring-1 ring-line">
            <p className="px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-faint">
              Папки всегда сверху
            </p>

            {MODES.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => {
                  onMode(item);
                  setOpen(false);
                }}
                className={cn(
                  "flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[13px] transition hover:bg-surface-2",
                  !presetId && mode === item ? "text-accent" : "text-content",
                )}
              >
                <span className="w-4">
                  {!presetId && mode === item && <IconCheck className="h-3.5 w-3.5" />}
                </span>
                {SORT_LABEL[item]}
              </button>
            ))}

            <div className="my-1 border-t border-line" />

            <p className="flex items-center gap-1 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-faint">
              Расстановки
              <span className="text-faint/70">
                {presets.length}/{MAX_PRESETS}
              </span>
            </p>

            {presets.length === 0 && (
              <p className="px-2 pb-1 text-[12px] text-faint">
                Пока ни одной. Разложи дерево как надо и сохрани.
              </p>
            )}

            {presets.map((preset) => (
              <div
                key={preset.id}
                className={cn(
                  "flex items-center gap-1 rounded-lg px-2 py-1 transition hover:bg-surface-2",
                  presetId === preset.id && "text-accent",
                )}
              >
                <button
                  type="button"
                  onClick={() => {
                    onLoadPreset(preset.id);
                    setOpen(false);
                  }}
                  className="min-w-0 flex-1 truncate text-left text-[13px]"
                  title={`Сохранена ${new Date(preset.savedAt).toLocaleDateString("ru")}`}
                >
                  {preset.name}
                </button>
                <button
                  type="button"
                  onClick={() => onDeletePreset(preset.id)}
                  title="Удалить расстановку"
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-faint transition hover:text-rose-500"
                >
                  <IconTrash className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}

            <div className="my-1 border-t border-line" />

            {naming ? (
              <div className="flex items-center gap-1 px-1 pb-1">
                <input
                  value={name}
                  autoFocus
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") save();
                    if (e.key === "Escape") setNaming(false);
                  }}
                  placeholder="Название"
                  className="h-8 min-w-0 flex-1 rounded-lg border border-line bg-surface-2 px-2 text-[13px] text-content outline-none focus:border-accent"
                />
                <button
                  type="button"
                  onClick={save}
                  disabled={!name.trim()}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent text-white disabled:opacity-40"
                >
                  <IconCheck className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setNaming(false)}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-faint hover:text-content"
                >
                  <IconX className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setNaming(true)}
                disabled={presets.length >= MAX_PRESETS}
                title={
                  presets.length >= MAX_PRESETS
                    ? "Больше пяти не держим — удали ненужную"
                    : "Запомнить нынешний порядок"
                }
                className="w-full rounded-lg px-2 py-1.5 text-left text-[13px] font-semibold text-accent transition hover:bg-surface-2 disabled:opacity-40"
              >
                + Сохранить нынешний порядок
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
