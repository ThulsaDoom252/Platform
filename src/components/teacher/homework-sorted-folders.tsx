"use client";

import { useMemo, type ReactNode } from "react";
import { sortTeacherHomeworkStudentGroups, type TeacherHomeworkOrderable, type TeacherHomeworkSortState, type TeacherHomeworkStudentGroup } from "@/lib/teacher-homework-order";
import { HomeworkSortControls, useHomeworkSort, type HomeworkSortLabels } from "./homework-sort-controls";

export function HomeworkSortedFolders({ folders, initialSort, labels, locale }: {
  folders: (TeacherHomeworkStudentGroup<TeacherHomeworkOrderable> & { card: ReactNode })[];
  initialSort: TeacherHomeworkSortState;
  labels: HomeworkSortLabels;
  locale: string;
}) {
  const { state, change } = useHomeworkSort(initialSort, "name");
  const sorted = useMemo(() => sortTeacherHomeworkStudentGroups(folders, state.key, state.desc, locale), [folders, state.key, state.desc, locale]);
  const cards = useMemo(() => new Map(folders.map((folder) => [folder.studentId, folder.card])), [folders]);
  return <>
    <section className="rounded-2xl bg-surface p-3 shadow-sm ring-1 ring-line sm:px-4">
      <HomeworkSortControls state={state} labels={labels} onChange={change} />
    </section>
    <div className="grid gap-5 pt-2 lg:grid-cols-2">
      {sorted.map((folder) => <div key={folder.studentId} className="min-w-0">{cards.get(folder.studentId)}</div>)}
    </div>
  </>;
}
