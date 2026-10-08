export type TeacherHomeworkOverviewState =
  | "reviewed"
  | "submitted"
  | "inProgress"
  | "notStarted";

export const TEACHER_HOMEWORK_SORT_KEYS = ["name", "waiting", "notStarted", "inProgress", "lesson", "assigned", "status"] as const;
export type TeacherHomeworkSortKey = typeof TEACHER_HOMEWORK_SORT_KEYS[number];
export type TeacherHomeworkSortState = { key: TeacherHomeworkSortKey; desc: boolean };

export function readTeacherHomeworkSort(key: unknown, dir: unknown, defaultKey: TeacherHomeworkSortKey = "assigned"): TeacherHomeworkSortState {
  const chosen = TEACHER_HOMEWORK_SORT_KEYS.includes(key as TeacherHomeworkSortKey) ? key as TeacherHomeworkSortKey : defaultKey;
  return { key: chosen, desc: dir === "desc" ? true : dir === "asc" ? false : chosen === "assigned" };
}

export type TeacherHomeworkOrderable = {
  id: string;
  studentName: string;
  title?: string;
  nextLessonAt: string | null;
  assignedAt: string;
  submittedAt: string | null;
  reviewedAt: string | null;
  started: boolean;
};

export type TeacherHomeworkStudentGroup<T> = {
  studentId: string;
  studentName: string;
  studentAvatarUrl: string | null;
  items: T[];
  counts: Record<TeacherHomeworkOverviewState, number> & { total: number };
};

const STATUS_ORDER: Record<TeacherHomeworkOverviewState, number> = {
  reviewed: 0,
  submitted: 1,
  inProgress: 2,
  notStarted: 3,
};

export function teacherHomeworkSortPriority(key: TeacherHomeworkSortKey): TeacherHomeworkOverviewState | null {
  return key === "waiting" ? "submitted" : key === "notStarted" ? "notStarted" : key === "inProgress" ? "inProgress" : null;
}

function statusRank(state: TeacherHomeworkOverviewState, key: TeacherHomeworkSortKey) {
  const priority = teacherHomeworkSortPriority(key);
  return priority ? (state === priority ? -1 : STATUS_ORDER[state]) : STATUS_ORDER[state];
}

/** Status blocks preserve global priority even when date/type grouping is enabled. */
export function groupTeacherHomeworkPriorities<T extends TeacherHomeworkOrderable>(items: T[], key: TeacherHomeworkSortKey, desc: boolean) {
  if (!teacherHomeworkSortPriority(key) && key !== "status") return [{ state: null, items }];
  const states = Object.keys(STATUS_ORDER) as TeacherHomeworkOverviewState[];
  states.sort((a, b) => (statusRank(a, key) - statusRank(b, key)) * (desc ? -1 : 1));
  return states.flatMap((state) => {
    const matching = items.filter((item) => teacherHomeworkOverviewState(item) === state);
    return matching.length ? [{ state, items: matching }] : [];
  });
}

function validDate(value: string | null): number | null {
  const ms = value ? new Date(value).getTime() : NaN;
  return Number.isFinite(ms) ? ms : null;
}

function compareOptionalDate(a: number | null, b: number | null, desc: boolean) {
  if (a === null) return b === null ? 0 : 1;
  if (b === null) return -1;
  return (a - b) * (desc ? -1 : 1);
}

/** Sort student folders by count of the selected status or their nearest future lesson. */
export function sortTeacherHomeworkStudentGroups<T extends TeacherHomeworkOrderable>(
  groups: TeacherHomeworkStudentGroup<T>[], key: TeacherHomeworkSortKey, desc: boolean, locale?: string,
): TeacherHomeworkStudentGroup<T>[] {
  const collator = new Intl.Collator(locale, { sensitivity: "base", numeric: true });
  const priority = teacherHomeworkSortPriority(key);
  const rank = (group: TeacherHomeworkStudentGroup<T>) => Math.min(...group.items.map((item) => STATUS_ORDER[teacherHomeworkOverviewState(item)]));
  const date = (group: TeacherHomeworkStudentGroup<T>, property: "nextLessonAt" | "assignedAt", earliest: boolean) => {
    const values = group.items.map((item) => validDate(item[property])).filter((value): value is number => value !== null);
    return values.length ? (earliest ? Math.min(...values) : Math.max(...values)) : null;
  };
  const decorated = groups.map((group) => ({ group,
    lesson: date(group, "nextLessonAt", true), assigned: date(group, "assignedAt", false), status: rank(group) }));
  return decorated.sort((a, b) => {
    let by = 0;
    if (priority) by = (b.group.counts[priority] - a.group.counts[priority]) * (desc ? -1 : 1);
    else if (key === "lesson") by = compareOptionalDate(a.lesson, b.lesson, desc);
    else if (key === "assigned") by = compareOptionalDate(a.assigned, b.assigned, desc);
    else if (key === "status") by = (a.status - b.status) * (desc ? -1 : 1);
    else by = collator.compare(a.group.studentName, b.group.studentName) * (desc ? -1 : 1);
    return by || collator.compare(a.group.studentName, b.group.studentName) || a.group.studentId.localeCompare(b.group.studentId);
  }).map(({ group }) => group);
}

export function teacherHomeworkOverviewState(
  item: Pick<TeacherHomeworkOrderable, "submittedAt" | "reviewedAt" | "started">,
): TeacherHomeworkOverviewState {
  if (item.reviewedAt) return "reviewed";
  if (item.submittedAt) return "submitted";
  if (item.started) return "inProgress";
  return "notStarted";
}

/** Build one alphabetized folder per student with live homework counters. */
export function groupTeacherHomeworksByStudent<
  T extends TeacherHomeworkOrderable & {
    studentId: string;
    studentAvatarUrl: string | null;
  },
>(items: T[], locale?: string): TeacherHomeworkStudentGroup<T>[] {
  const groups = new Map<string, TeacherHomeworkStudentGroup<T>>();
  for (const item of items) {
    let group = groups.get(item.studentId);
    if (!group) {
      group = {
        studentId: item.studentId,
        studentName: item.studentName,
        studentAvatarUrl: item.studentAvatarUrl,
        items: [],
        counts: { total: 0, notStarted: 0, inProgress: 0, submitted: 0, reviewed: 0 },
      };
      groups.set(item.studentId, group);
    }
    group.items.push(item);
    group.counts.total += 1;
    group.counts[teacherHomeworkOverviewState(item)] += 1;
  }

  const collator = new Intl.Collator(locale, { sensitivity: "base" });
  return [...groups.values()].sort((left, right) =>
    collator.compare(left.studentName, right.studentName) ||
    left.studentId.localeCompare(right.studentId),
  );
}

/** Sort a flat homework list without changing the server result. */
export function sortTeacherHomeworks<T extends TeacherHomeworkOrderable>(
  items: T[],
  key: TeacherHomeworkSortKey,
  desc: boolean,
  locale?: string,
): T[] {
  const collator = new Intl.Collator(locale, { sensitivity: "base", numeric: true });
  const priority = teacherHomeworkSortPriority(key);
  const compare = (a: T, b: T) => {
    if (key === "lesson") {
      return compareOptionalDate(validDate(a.nextLessonAt), validDate(b.nextLessonAt), desc);
    }
    if (key === "status" || priority) {
      return statusRank(teacherHomeworkOverviewState(a), key) - statusRank(teacherHomeworkOverviewState(b), key);
    }
    if (key === "assigned") {
      return compareOptionalDate(validDate(a.assignedAt), validDate(b.assignedAt), desc);
    }
    return collator.compare(a.title || a.studentName, b.title || b.studentName);
  };

  return items.slice().sort((a, b) => {
    const by = compare(a, b);
    // A student without a future lesson always stays at the end.
    const directed = key === "lesson" || key === "assigned" ? by : desc ? -by : by;
    return directed || collator.compare(a.studentName, b.studentName) ||
      new Date(b.assignedAt).getTime() - new Date(a.assignedAt).getTime() ||
      a.id.localeCompare(b.id);
  });
}
