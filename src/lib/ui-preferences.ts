export function uiPreferenceKey(userId: string, setting: string) {
  return `lingora:ui:${encodeURIComponent(userId)}:${setting}`;
}

export type SortPreference<K extends string> = { key: K; desc: boolean };

export function isSortPreference<K extends string>(value: unknown, keys: readonly K[]): value is SortPreference<K> {
  if (!value || typeof value !== "object") return false;
  const state = value as Partial<SortPreference<K>>;
  return keys.includes(state.key as K) && typeof state.desc === "boolean";
}

/** Explicit links win; ordinary navigation restores the saved preference. */
export function resolveSortPreference<K extends string>(saved: SortPreference<K>, key: string | null,
  dir: string | null, keys: readonly K[], descendingKeys: readonly K[] = []): SortPreference<K> {
  const validKey = keys.includes(key as K);
  const chosen = validKey ? key as K : saved.key;
  const desc = dir === "desc" ? true : dir === "asc" ? false
    : validKey ? descendingKeys.includes(chosen) : saved.desc;
  return chosen === saved.key && desc === saved.desc ? saved : { key: chosen, desc };
}

export const STUDENT_SORT_KEYS = ["name", "lessons"] as const;
export type StudentSortKey = typeof STUDENT_SORT_KEYS[number];

export function sortStudentRows<T extends { id: string; name: string; lessons: number }>(
  rows: readonly T[], state: SortPreference<StudentSortKey>, locale: string,
) {
  const collator = new Intl.Collator(locale);
  return [...rows].sort((a, b) => {
    const by = state.key === "lessons" ? a.lessons - b.lessons : collator.compare(a.name, b.name);
    return (state.desc ? -by : by) || collator.compare(a.name, b.name) || a.id.localeCompare(b.id);
  });
}
