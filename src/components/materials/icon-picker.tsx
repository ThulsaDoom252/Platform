"use client";

import { useMemo, useState } from "react";
import {
  CURATED_PICKER_GROUPS,
  PICKER_ICON_COUNT,
  UNICODE_GROUPS,
  UNICODE_ICON_COUNT,
  searchIcons,
} from "@/lib/icons-data";
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
  const [catalog, setCatalog] = useState<"curated" | "unicode">("curated");
  const [unicodeGroup, setUnicodeGroup] = useState(0);

  const groups = useMemo(() => {
    const q = query.trim();
    if (!q) {
      return catalog === "curated"
        ? CURATED_PICKER_GROUPS
        : UNICODE_GROUPS[unicodeGroup]
          ? [UNICODE_GROUPS[unicodeGroup]]
          : [];
    }
    const found = searchIcons(q);
    return found.length ? [{ label: `Найдено: ${found.length}`, icons: found }] : [];
  }, [catalog, query, unicodeGroup]);

  return (
    <div className="flex flex-col gap-3">
      <label className="relative flex items-center">
        <IconSearch className="absolute left-3 h-4 w-4 text-faint" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Поиск по всей базе: жесты, армия, планеты…"
          className="h-10 w-full rounded-xl border border-line bg-surface-2 pl-9 pr-3 text-sm text-content outline-none transition placeholder:text-faint focus:border-accent"
        />
      </label>

      {!query.trim() && (
        <div className="flex flex-col gap-2">
          <div className="grid grid-cols-2 rounded-xl bg-surface-2 p-1">
            <button
              type="button"
              onClick={() => setCatalog("curated")}
              className={cn(
                "rounded-lg px-3 py-2 text-xs font-semibold transition",
                catalog === "curated"
                  ? "bg-surface text-content shadow-sm"
                  : "text-muted hover:text-content",
              )}
            >
              Быстрые подборки
            </button>
            <button
              type="button"
              onClick={() => setCatalog("unicode")}
              className={cn(
                "rounded-lg px-3 py-2 text-xs font-semibold transition",
                catalog === "unicode"
                  ? "bg-surface text-content shadow-sm"
                  : "text-muted hover:text-content",
              )}
            >
              Вся база · {UNICODE_ICON_COUNT}
            </button>
          </div>

          {catalog === "unicode" && (
            <div className="flex gap-1.5 overflow-x-auto pb-1">
              {UNICODE_GROUPS.map((group, index) => (
                <button
                  key={group.label}
                  type="button"
                  onClick={() => setUnicodeGroup(index)}
                  className={cn(
                    "shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition",
                    unicodeGroup === index
                      ? "border-accent bg-accent-soft text-content"
                      : "border-line bg-surface text-muted hover:border-accent/50 hover:text-content",
                  )}
                >
                  {group.label}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

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
              {g.icons.map(([icon, keywords]) => (
                <button
                  key={icon}
                  type="button"
                  onClick={() => onChange(icon)}
                  title={keywords.split(" ").slice(0, 6).join(" ")}
                  aria-label={`Выбрать иконку ${keywords.split(" ").slice(0, 4).join(" ")}`}
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

      <p className="text-center text-[11px] text-faint">
        {PICKER_ICON_COUNT.toLocaleString("ru-RU")} уникальных иконок · Unicode Emoji 17
      </p>
    </div>
  );
}
