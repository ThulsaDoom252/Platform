"use client";

import { useState, useTransition } from "react";
import { setAssignmentsAction } from "@/lib/actions/materials";
import { IconCheck } from "@/components/icons";
import { cn } from "@/lib/utils";

export type SharedSection = {
  id: string;
  name: string;
  icon: string | null;
  nested: boolean;
};

/**
 * Какие разделы общей базы открыты ученику.
 * Раздел открывается целиком — внутри него выборочности нет.
 */
export function SharedAccess({
  studentId,
  sections,
  granted,
}: {
  studentId: string;
  sections: SharedSection[];
  granted: string[];
}) {
  const [picked, setPicked] = useState<Set<string>>(() => new Set(granted));
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, startSave] = useTransition();

  const dirty =
    picked.size !== granted.length || granted.some((id) => !picked.has(id));

  function toggle(id: string) {
    setSaved(false);
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function save() {
    setError(null);
    startSave(async () => {
      const res = await setAssignmentsAction(studentId, [...picked]);
      if (res.error) setError(res.error);
      else setSaved(true);
    });
  }

  return (
    <section className="rounded-2xl bg-surface p-4 ring-1 ring-line shadow-sm sm:p-5">
      <h2 className="text-sm font-bold text-content">Доступ к общей базе</h2>
      <p className="mt-1 text-[12px] text-muted">
        Отмеченные разделы ученик видит у себя в материалах, рядом со своими.
        Правки в общей базе его личное дерево не затрагивают.
      </p>

      {sections.length === 0 ? (
        <p className="py-6 text-center text-sm text-faint">
          В общей базе пока нет разделов.
        </p>
      ) : (
        <div className="mt-3 flex flex-wrap gap-2">
          {sections.map((s) => {
            const on = picked.has(s.id);
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => toggle(s.id)}
                className={cn(
                  "flex h-10 items-center gap-2 rounded-xl px-3.5 text-sm font-semibold transition",
                  on
                    ? "bg-accent-soft text-accent ring-2 ring-accent"
                    : "bg-surface-2 text-muted ring-1 ring-line hover:text-content",
                )}
              >
                <span className="text-base leading-none">{s.icon ?? "📁"}</span>
                <span>
                  {s.name}
                  {s.nested && (
                    <span className="ml-1 text-[11px] font-medium opacity-70">
                      · перемещён внутрь папки
                    </span>
                  )}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {error && <p className="mt-2 text-sm text-rose-500">{error}</p>}

      {(dirty || saved) && (
        <div className="mt-3 flex items-center gap-3">
          <button
            type="button"
            onClick={save}
            disabled={saving || !dirty}
            className="flex h-10 items-center gap-2 rounded-xl bg-accent px-4 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
          >
            {saving ? "Сохраняю…" : "Сохранить доступ"}
          </button>
          {saved && !dirty && (
            <span className="flex items-center gap-1.5 text-sm font-semibold text-[color:var(--lesson-green)]">
              <IconCheck className="h-4 w-4" /> Сохранено
            </span>
          )}
        </div>
      )}
    </section>
  );
}
