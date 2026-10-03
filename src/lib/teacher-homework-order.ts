export type TeacherHomeworkOverviewState =
  | "reviewed"
  | "submitted"
  | "inProgress"
  | "notStarted";

export type TeacherHomeworkSortKey = "name" | "lesson" | "status" | "assigned";

export type TeacherHomeworkOrderable = {
  id: string;
  studentName: string;
  nextLessonAt: string | null;
  assignedAt: string;
  submittedAt: string | null;
  reviewedAt: string | null;
  started: boolean;
};

const STATUS_ORDER: Record<TeacherHomeworkOverviewState, number> = {
  reviewed: 0,
  submitted: 1,
  inProgress: 2,
  notStarted: 3,
};

export function teacherHomeworkOverviewState(
  item: Pick<TeacherHomeworkOrderable, "submittedAt" | "reviewedAt" | "started">,
): TeacherHomeworkOverviewState {
  if (item.reviewedAt) return "reviewed";
  if (item.submittedAt) return "submitted";
  if (item.started) return "inProgress";
  return "notStarted";
}

/** Sort a flat homework list without changing the server result. */
export function sortTeacherHomeworks<T extends TeacherHomeworkOrderable>(
  items: T[],
  key: TeacherHomeworkSortKey,
  desc: boolean,
  locale?: string,
): T[] {
  const collator = new Intl.Collator(locale, { sensitivity: "base" });

  const compare = (a: T, b: T) => {
    if (key === "lesson") {
      if (!a.nextLessonAt && !b.nextLessonAt) return 0;
      if (!a.nextLessonAt) return 1;
      if (!b.nextLessonAt) return -1;
      return new Date(a.nextLessonAt).getTime() - new Date(b.nextLessonAt).getTime();
    }
    if (key === "status") {
      return STATUS_ORDER[teacherHomeworkOverviewState(a)] -
        STATUS_ORDER[teacherHomeworkOverviewState(b)];
    }
    if (key === "assigned") {
      return new Date(a.assignedAt).getTime() - new Date(b.assignedAt).getTime();
    }
    return collator.compare(a.studentName, b.studentName);
  };

  return items.slice().sort((a, b) => {
    const by = compare(a, b);
    // A student without a future lesson always stays at the end.
    const directed = key === "lesson" && (!a.nextLessonAt || !b.nextLessonAt)
      ? by
      : desc
        ? -by
        : by;
    return directed || collator.compare(a.studentName, b.studentName) ||
      new Date(b.assignedAt).getTime() - new Date(a.assignedAt).getTime() ||
      a.id.localeCompare(b.id);
  });
}
