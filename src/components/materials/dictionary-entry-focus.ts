"use client";

import { useEffect, useRef } from "react";

/** A search target must be a bounded ID belonging to this rendered dictionary. */
export function dictionaryEntryId(
  requested: unknown,
  entries: readonly { id: string }[],
): string | undefined {
  return typeof requested === "string" && requested.length > 0 && requested.length <= 128
    && entries.some((entry) => entry.id === requested)
    ? requested
    : undefined;
}

export function dictionaryEntryAnchor(kind: "phrase" | "verb", id: string) {
  return `dictionary-${kind}-${encodeURIComponent(id)}`;
}

/** Focus the exact record, without opening examples, revealing translations or saving UI choices. */
export function useDictionaryEntryFocus(entryId: string | undefined, layout?: unknown) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!entryId) return;
    const frame = window.requestAnimationFrame(() => {
      const target = ref.current;
      if (!target || target.dataset.dictionaryEntry !== entryId) return;
      target.focus({ preventScroll: true });
      target.scrollIntoView({ behavior: "auto", block: "center" });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [entryId, layout]);
  return ref;
}
