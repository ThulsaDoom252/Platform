"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { globalSearchAction } from "@/lib/actions/global-search";
import {
  SEARCH_CATEGORIES,
  type GlobalSearchItem,
  type SearchCategory,
} from "@/lib/global-search-types";
import { useT } from "@/components/i18n-provider";
import { IconChevronRight, IconSearch } from "@/components/icons";
import { cn } from "@/lib/utils";
import { centeredSearchPosition, globalSearchPosition, type GlobalSearchPosition } from "@/lib/global-search-position";
import { useAppView } from "./app-view-provider";
import { useModalLayer } from "@/lib/use-modal-layer";
import { useUiPreference } from "./ui-preferences-provider";

const teacherCategories = [...SEARCH_CATEGORIES];

export function GlobalSearch({ role }: { role: "TEACHER" | "STUDENT" }) {
  const { t } = useT();
  const { view } = useAppView();
  const centered = view === "UPDATED";
  const available = role === "TEACHER" ? teacherCategories : (["MATERIALS"] as const);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Set<SearchCategory>>(
    () => new Set(available),
  );
  const [includeVocabularyEntries, setIncludeVocabularyEntries] = useUiPreference<boolean>(
    "search:include-vocabulary-entries", false, (value) => typeof value === "boolean",
  );
  const [items, setItems] = useState<GlobalSearchItem[]>([]);
  const [completedKey, setCompletedKey] = useState("");
  const [failed, setFailed] = useState(false);
  const [position, setPosition] = useState<GlobalSearchPosition | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const selectedKey = useMemo(() => [...selected].sort().join(","), [selected]);

  const updatePosition = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const button = trigger.getBoundingClientRect();
    const header = trigger.closest("header")?.getBoundingClientRect();
    const viewport = { width: document.documentElement.clientWidth, height: window.visualViewport?.height ?? window.innerHeight };
    setPosition(centered ? centeredSearchPosition(viewport) : globalSearchPosition({ right: button.right, bottom: header?.bottom ?? button.bottom }, {
      width: document.documentElement.clientWidth,
      height: window.innerHeight,
    }));
  }, [centered]);

  const closeSearch = useCallback(() => {
    setOpen(false);
    setQuery("");
    setItems([]);
    setCompletedKey("");
    setFailed(false);
    triggerRef.current?.focus();
  }, []);

  useModalLayer(open && centered, panelRef, closeSearch, 3);

  useEffect(() => {
    if (!open) return;
    updatePosition();
    inputRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (!centered && event.key === "Escape") closeSearch();
    };
    document.addEventListener("keydown", onKey);
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    window.visualViewport?.addEventListener("resize", updatePosition);
    return () => {
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
      window.visualViewport?.removeEventListener("resize", updatePosition);
    };
  }, [open, centered, closeSearch, updatePosition]);

  useEffect(() => {
    let current = true;
    const clean = query.trim();
    if (!open || clean.length < 2 || selected.size === 0) return;

    const requestKey = `${clean}\n${selectedKey}\n${includeVocabularyEntries}`;
    const timer = window.setTimeout(async () => {
      try {
        const response = await globalSearchAction({
          query: clean,
          categories: [...selected],
          includeVocabularyEntries,
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
  }, [open, query, selectedKey, includeVocabularyEntries]);

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
  const loading = showResults && completedKey !== `${cleanQuery}\n${selectedKey}\n${includeVocabularyEntries}`;

  return (
    <div className="relative z-50">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => { updatePosition(); setOpen(true); }}
        title={t.globalSearch.open}
        aria-label={t.globalSearch.open}
        aria-expanded={open}
        className="flex h-9 items-center gap-2 rounded-xl border border-line bg-surface px-2.5 text-sm font-semibold text-muted transition hover:border-accent hover:text-accent sm:min-w-36 sm:px-3"
      >
        <IconSearch className="h-4 w-4" />
        <span className="hidden sm:inline">{t.globalSearch.open}</span>
      </button>

      {open && createPortal(
        <>
          <button
            type="button"
            aria-label={t.globalSearch.close}
            onClick={closeSearch}
            className="fixed inset-0 z-[60] cursor-default bg-page/45 backdrop-blur-[2px]"
            style={centered ? { zIndex: 99 } : undefined}
          />
          <div ref={panelRef} role={centered ? "dialog" : undefined} aria-modal={centered || undefined} aria-label={centered ? t.globalSearch.open : undefined} data-centered-search={centered || undefined} data-modal-layer={centered ? "3" : undefined}>
          <section
            role="search"
            className="fixed left-3 right-3 top-16 z-[61] mx-auto flex max-h-[min(76dvh,680px)] max-w-2xl flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-2xl sm:left-auto sm:right-8 sm:mx-0 sm:w-[min(42rem,calc(100vw-4rem))]"
            style={position ? { ...position, right: "auto", maxWidth: "none", margin: 0, ...(centered ? { transform: "translate(-50%, -50%)", zIndex: 100 } : {}) } : undefined}
          >
            <div className="flex items-center gap-2 border-b border-line p-3 sm:p-4 shrink-0">
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
            </div>

            {role === "TEACHER" && (
              <div className="flex shrink-0 flex-wrap gap-2 border-b border-line px-3 py-3 sm:px-4">
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

            <label className={cn("flex shrink-0 cursor-pointer items-start gap-2.5 border-b border-line px-3 py-3 text-sm font-semibold text-muted sm:px-4", !selected.has("MATERIALS") && "cursor-default opacity-50")}>
              <input
                type="checkbox"
                checked={includeVocabularyEntries}
                disabled={!selected.has("MATERIALS")}
                onChange={(event) => {
                  setIncludeVocabularyEntries(event.target.checked);
                  setItems([]);
                  setCompletedKey("");
                  setFailed(false);
                }}
                className="mt-0.5 h-4 w-4 shrink-0 accent-accent"
              />
              <span>{t.globalSearch.includeVocabularyEntries}</span>
            </label>

            <div className="min-h-0 flex-1 overflow-y-auto p-2 sm:p-3">
              {!showResults ? (
                <p className="min-h-40 px-3 py-10 text-center text-sm text-faint">
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
                      onClick={closeSearch}
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
          </div>
        </>,
        document.body,
      )}
    </div>
  );
}
