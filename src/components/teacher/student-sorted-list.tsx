"use client";

import { useMemo, type ReactNode } from "react";
import { usePersistentSort } from "@/lib/use-persistent-sort";
import { sortStudentRows, STUDENT_SORT_KEYS, type SortPreference, type StudentSortKey } from "@/lib/ui-preferences";

export function StudentSortedList({ rows, initialSort, locale, labels, extraControls }: {
  rows: { id: string; name: string; lessons: number; card: ReactNode }[];
  initialSort: SortPreference<StudentSortKey>;
  locale: string;
  labels: { sortBy: string; name: string; lessons: string };
  extraControls: ReactNode;
}) {
  const { state, change } = usePersistentSort("students:sort", initialSort, STUDENT_SORT_KEYS);
  const sorted = useMemo(() => sortStudentRows(rows, state, locale), [rows, state, locale]);
  return <>
    <div className="mb-3 flex flex-wrap items-center gap-2 border-b border-line pb-3">
      <span className="mr-1 text-[11px] font-semibold uppercase tracking-wide text-faint">{labels.sortBy}</span>
      {STUDENT_SORT_KEYS.map((key) => <button key={key} type="button" aria-pressed={state.key === key}
        onClick={() => change({ key, desc: state.key === key && !state.desc })}
        className={`flex h-8 items-center gap-1 rounded-lg px-3 text-[12px] font-semibold transition ${state.key === key ? "bg-accent-soft text-accent" : "text-muted hover:bg-surface-2 hover:text-content"}`}>
        {labels[key]}<span aria-hidden className={state.key === key ? "" : "opacity-40"}>{state.key === key && state.desc ? "↓" : "↑"}</span>
      </button>)}
      {extraControls}
    </div>
    <div className="flex flex-col divide-y divide-line">{sorted.map((row) => row.card)}</div>
  </>;
}
