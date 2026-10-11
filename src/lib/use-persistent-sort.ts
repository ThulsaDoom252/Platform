"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { useUiPreference } from "@/components/ui-preferences-provider";
import { isSortPreference, resolveSortPreference, type SortPreference } from "@/lib/ui-preferences";

export function usePersistentSort<K extends string>(setting: string, initial: SortPreference<K>,
  keys: readonly K[], descendingKeys: readonly K[] = []) {
  const params = useSearchParams();
  const [saved, setSaved] = useUiPreference(setting, initial, (value) => isSortPreference(value, keys));
  const state = resolveSortPreference(saved, params?.get("sort") ?? null, params?.get("dir") ?? null, keys, descendingKeys);
  const { key, desc } = state;
  // A deliberately opened sort URL also becomes the preference for later visits.
  useEffect(() => {
    if (key !== saved.key || desc !== saved.desc) setSaved({ key, desc });
  }, [key, desc, saved.key, saved.desc, setSaved]);

  const change = (next: SortPreference<K>) => {
    setSaved(next);
    const url = new URL(window.location.href);
    url.searchParams.set("sort", next.key);
    url.searchParams.set("dir", next.desc ? "desc" : "asc");
    window.history.replaceState(null, "", `${url.pathname}?${url.searchParams.toString()}${url.hash}`);
  };
  return { state, change };
}
