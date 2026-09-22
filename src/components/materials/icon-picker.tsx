"use client";

import { useMemo, useState } from "react";
import { ICON_GROUPS, searchIcons } from "@/lib/icons-data";
import { IconSearch } from "@/components/icons";
import { cn } from "@/lib/utils";

/** Выбор эмодзи-иконки для папки, страницы или записи. */
export function IconPicker({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (icon: string) => void;
}) {
  const [query, setQuery] = useState("");

  const groups = useMemo(() => {
    const q = query.trim();
    if (!q) return ICON_GROUPS;
    const found = searchIcons(q);
    return found.length ? [{ label: `Найдено: ${found.length}`, icons: found }] : [];
  }, [query]);

  return (
    <div className="flex flex-col gap-3">
      <label className="relative flex items-center">
        <IconSearch className="absolute left-3 h-4 w-4 text-faint" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Поиск: спорт, грамматика, книга…"
          className="h-10 w-full rounded-xl border border-line bg-surface-2 pl-9 pr-3 text-sm text-content outline-none transition placeholder:text-faint focus:border-accent"
        />
      </label>

      <div className="max-h-72 overflow-y-auto pr-1">
        {groups.length === 0 && (
          <p className="py-6 text-center text-sm text-faint">Ничего не найдено.</p>
        )}
        {groups.map((g) => (
          <div key={g.label} className="mb-3">
            <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-faint">
              {g.label}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {g.icons.map(([icon]) => (
                <button
                  key={icon}
                  type="button"
                  onClick={() => onChange(icon)}
                  className={cn(
                    "flex h-9 w-9 items-center justify-center rounded-lg text-lg transition",
                    value === icon
                      ? "bg-accent-soft ring-2 ring-accent"
                      : "hover:bg-surface-2",
                  )}
                >
                  {icon}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
