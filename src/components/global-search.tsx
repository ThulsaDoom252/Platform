"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { globalSearchAction } from "@/lib/actions/global-search";
import {
  SEARCH_CATEGORIES,
  type GlobalSearchItem,
  type SearchCategory,
} from "@/lib/global-search-types";
import { useT } from "@/components/i18n-provider";
import { IconChevronRight, IconSearch, IconX } from "@/components/icons";
import { cn } from "@/lib/utils";

const teacherCategories = [...SEARCH_CATEGORIES];

export function GlobalSearch({ role }: { role: "TEACHER" | "STUDENT" }) {
  const { t } = useT();
  const available = role === "TEACHER" ? teacherCategories : (["MATERIALS"] as const);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Set<SearchCategory>>(
    () => new Set(available),
  );
  const [items, setItems] = useState<GlobalSearchItem[]>([]);
  const [completedKey, setCompletedKey] = useState("");
  const [failed, setFailed] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const selectedKey = useMemo(() => [...selected].sort().join(","), [selected]);

  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  useEffect(() => {
    let current = true;
    const clean = query.trim();
    if (!open || clean.length < 2 || selected.size === 0) return;

    const requestKey = `${clean}\n${selectedKey}`;
    const timer = window.setTimeout(async () => {
      try {
        const response = await globalSearchAction({
          query: clean,
          categories: [...selected],
        });
        if (!current) return;
        setItems(response.items);
        setFailed(Boolean(response.error));
      } catch {
        if (current) setFailed(true);
      } finally {
        if (current) setCompletedKey(requestKey);
      }
    }, 220);

    return () => {
      current = false;
      window.clearTimeout(timer);
    };
    // selectedKey is the stable value representation of the Set.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, query, selectedKey]);

  function toggleCategory(category: SearchCategory) {
    setSelected((before) => {
      const next = new Set(before);
      if (next.has(category)) next.delete(category);
      else next.add(category);
      return next;
    });
    setItems([]);
    setCompletedKey("");
    setFailed(false);
  }

  const cleanQuery = query.trim();
  const showResults = cleanQuery.length >= 2 && selected.size > 0;
  const loading = showResults && completedKey !== `${cleanQuery}\n${selectedKey}`;

  return (
    <div className="relative z-50">
      <button
        type="button"
        onClick={() => setOpen(true)}
        title={t.globalSearch.open}
        aria-label={t.globalSearch.open}
        aria-expanded={open}
        className="flex h-9 items-center gap-2 rounded-xl border border-line bg-surface px-2.5 text-sm font-semibold text-muted transition hover:border-accent hover:text-accent sm:min-w-36 sm:px-3"
      >
        <IconSearch className="h-4 w-4" />
        <span className="hidden sm:inline">{t.globalSearch.open}</span>
      </button>

      {open && (
        <>
          <button
            type="button"
            aria-label={t.globalSearch.close}
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-40 cursor-default bg-page/45 backdrop-blur-[2px]"
          />

          <section
            role="search"
            className="fixed left-3 right-3 top-16 z-50 mx-auto flex max-h-[min(76dvh,680px)] max-w-2xl flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-2xl sm:left-auto sm:right-8 sm:mx-0 sm:w-[min(42rem,calc(100vw-4rem))]"
          >
            <div className="flex items-center gap-2 border-b border-line p-3 sm:p-4">
              <IconSearch className="h-5 w-5 shrink-0 text-accent" />
              <input
                ref={inputRef}
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setItems([]);
                  setCompletedKey("");
                  setFailed(false);
                }}
                placeholder={
                  role === "TEACHER"
                    ? t.globalSearch.teacherPlaceholder
                    : t.globalSearch.studentPlaceholder
                }
                aria-label={t.globalSearch.inputLabel}
                className="min-w-0 flex-1 bg-transparent text-base font-semibold text-content outline-none placeholder:text-faint"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => {
                    setQuery("");
                    setItems([]);
                    setCompletedKey("");
                    setFailed(false);
                    inputRef.current?.focus();
                  }}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-faint transition hover:bg-surface-2 hover:text-content"
                  aria-label={t.globalSearch.clear}
                >
                  <IconX className="h-4 w-4" />
                </button>
              )}
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-faint transition hover:bg-surface-2 hover:text-content"
                aria-label={t.globalSearch.close}
              >
                <IconX className="h-4 w-4" />
              </button>
            </div>

            {role === "TEACHER" && (
              <div className="flex flex-wrap gap-2 border-b border-line px-3 py-3 sm:px-4">
                {available.map((category) => {
                  const active = selected.has(category);
                  return (
                    <button
                      key={category}
                      type="button"
                      role="checkbox"
                      aria-checked={active}
                      onClick={() => toggleCategory(category)}
                      className={cn(
                        "rounded-lg px-2.5 py-1.5 text-xs font-bold ring-1 transition",
                        active
                          ? "bg-accent-soft text-accent ring-accent/30"
                          : "bg-surface-2 text-faint ring-line hover:text-content",
                      )}
                    >
                      <span aria-hidden className="mr-1">{active ? "✓" : ""}</span>
                      {t.globalSearch.categories[category]}
                    </button>
                  );
                })}
              </div>
            )}

            <div className="min-h-40 overflow-y-auto p-2 sm:p-3">
              {!showResults ? (
                <p className="px-3 py-10 text-center text-sm text-faint">
                  {selected.size === 0
                    ? t.globalSearch.pickCategory
                    : t.globalSearch.hint}
                </p>
              ) : loading ? (
                <div className="flex items-center justify-center gap-2 px-3 py-10 text-sm font-medium text-muted">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-accent border-r-transparent" />
                  {t.globalSearch.loading}
                </div>
              ) : failed ? (
                <p className="px-3 py-10 text-center text-sm text-danger">
                  {t.globalSearch.error}
                </p>
              ) : items.length === 0 ? (
                <p className="px-3 py-10 text-center text-sm text-faint">
                  {t.globalSearch.empty}
                </p>
              ) : (
                <div className="flex flex-col gap-1">
                  {items.map((item) => (
                    <Link
                      key={`${item.category}:${item.id}`}
                      href={item.href}
                      onClick={() => setOpen(false)}
                      className="group flex items-center gap-3 rounded-xl px-3 py-2.5 transition hover:bg-surface-2"
                    >
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-xl text-accent">
                        {item.icon || <IconSearch className="h-4 w-4" />}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-[10px] font-black uppercase tracking-wider text-accent">
                          {t.globalSearch.categories[item.category]}
                        </span>
                        <span className="block truncate text-sm font-bold text-content">
                          {item.title}
                        </span>
                        {item.subtitle && (
                          <span className="block truncate text-xs text-faint">
                            {item.subtitle}
                          </span>
                        )}
                      </span>
                      <IconChevronRight className="h-4 w-4 shrink-0 text-faint transition group-hover:translate-x-0.5 group-hover:text-accent" />
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
