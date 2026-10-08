"use client";

import { useSearchParams } from "next/navigation";
import { useId } from "react";
import { readTeacherHomeworkSort, TEACHER_HOMEWORK_SORT_KEYS, type TeacherHomeworkSortKey, type TeacherHomeworkSortState } from "@/lib/teacher-homework-order";

export type HomeworkSortLabels = {
  sortBy: string;
  sortName: string;
  sortLesson: string;
  sortStatus: string;
  sortAssigned: string;
  waiting: string;
  notStarted: string;
  inProgress: string;
  reverseSort: string;
};

/** Native history updates only the URL and local ordering, not the server data. */
export function useHomeworkSort(initial: TeacherHomeworkSortState, defaultKey: TeacherHomeworkSortKey) {
  const params = useSearchParams();
  const state = params ? readTeacherHomeworkSort(params.get("sort"), params.get("dir"), defaultKey) : initial;
  const change = (next: TeacherHomeworkSortState) => {
    const url = new URL(window.location.href);
    url.searchParams.set("sort", next.key);
    url.searchParams.set("dir", next.desc ? "desc" : "asc");
    window.history.replaceState(null, "", `${url.pathname}?${url.searchParams.toString()}${url.hash}`);
  };
  return { state, change };
}

export function HomeworkSortControls({ state, labels, onChange }: {
  state: TeacherHomeworkSortState;
  labels: HomeworkSortLabels;
  onChange: (next: TeacherHomeworkSortState) => void;
}) {
  const id = useId();
  const titles: Record<TeacherHomeworkSortKey, string> = {
    name: labels.sortName, lesson: labels.sortLesson, status: labels.sortStatus, assigned: labels.sortAssigned,
    waiting: labels.waiting, notStarted: labels.notStarted, inProgress: labels.inProgress,
  };
  return <div className="flex min-w-0 flex-wrap items-center gap-2">
    <label htmlFor={id} className="text-[11px] font-semibold uppercase tracking-wide text-faint">{labels.sortBy}</label>
    <select id={id} value={state.key} onChange={(event) => onChange(readTeacherHomeworkSort(event.target.value, undefined))}
      className="h-10 min-w-0 max-w-full rounded-xl border border-line bg-surface-2 px-3 text-xs font-bold text-content outline-none transition focus:border-accent sm:min-w-48">
      {TEACHER_HOMEWORK_SORT_KEYS.map((key) => <option key={key} value={key}>{titles[key]}</option>)}
    </select>
    <button type="button" onClick={() => onChange({ ...state, desc: !state.desc })}
      title={labels.reverseSort} aria-label={labels.reverseSort}
      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-lg font-black text-accent ring-1 ring-line transition hover:ring-accent">
      <span aria-hidden>{state.desc ? "↓" : "↑"}</span>
    </button>
  </div>;
}
