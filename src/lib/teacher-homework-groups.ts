import { SCHOOL_TIME_ZONE } from "@/lib/schedule-time";

export type TeacherHomeworkGroupable = {
  id: string;
  kind: "LESSON" | "ACTIVITY" | "REVISION";
  assignedAt: string;
  activityType?: string;
};

export type TeacherHomeworkActivityGroupType =
  | "WORDS" | "GUESS_DESCRIPTION" | "GUESS_PICTURE" | "SPELLING" | "REVISION" | "OTHER";

export type TeacherHomeworkDateGroup<T> = {
  /** School-local calendar day; null means a flat list or an invalid old date. */
  day: string | null;
  key: string;
  items: T[];
};

export type TeacherHomeworkContentGroup<T> = {
  kind: "LESSON" | "ACTIVITY" | "ALL";
  items: T[];
  activityGroups: { type: TeacherHomeworkActivityGroupType; items: T[] }[];
};

const ACTIVITY_ORDER: TeacherHomeworkActivityGroupType[] = [
  "WORDS", "GUESS_DESCRIPTION", "GUESS_PICTURE", "SPELLING", "REVISION", "OTHER",
];

function activityType(item: TeacherHomeworkGroupable): TeacherHomeworkActivityGroupType {
  if (item.kind === "REVISION") return "REVISION";
  return ACTIVITY_ORDER.includes(item.activityType as TeacherHomeworkActivityGroupType)
    ? item.activityType as TeacherHomeworkActivityGroupType
    : "OTHER";
}

/** Assignment days, not lesson dates or last-edit dates; never mutate the input. */
export function groupTeacherHomeworkDates<T extends TeacherHomeworkGroupable>(
  items: T[],
  enabled = true,
  descending = true,
  timeZone = SCHOOL_TIME_ZONE,
): TeacherHomeworkDateGroup<T>[] {
  if (items.length === 0) return [];
  if (!enabled) return [{ key: "all", day: null, items: items.slice() }];
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone, year: "numeric", month: "2-digit", day: "2-digit",
  });
  const groups = new Map<string, TeacherHomeworkDateGroup<T>>();
  for (const item of items) {
    const date = new Date(item.assignedAt);
    let day: string | null = null;
    if (Number.isFinite(date.getTime())) {
      const parts = formatter.formatToParts(date);
      day = ["year", "month", "day"].map((type) =>
        parts.find((part) => part.type === type)?.value).join("-");
    }
    const key = day ?? "undated";
    let group = groups.get(key);
    if (!group) {
      group = { key, day, items: [] };
      groups.set(key, group);
    }
    group.items.push(item);
  }
  return [...groups.values()].sort((left, right) => {
    if (!left.day) return right.day ? 1 : 0;
    if (!right.day) return -1;
    const order = left.day.localeCompare(right.day);
    return descending ? -order : order;
  });
}

/** Interactive work first, then games grouped by type; keep the selected order within each type. */
export function groupTeacherHomeworkContent<T extends TeacherHomeworkGroupable>(
  items: T[],
  enabled = true,
): TeacherHomeworkContentGroup<T>[] {
  if (items.length === 0) return [];
  if (!enabled) return [{ kind: "ALL", items: items.slice(), activityGroups: [] }];
  const homeworks = items.filter((item) => item.kind === "LESSON");
  const activities = items.filter((item) => item.kind !== "LESSON");
  const result: TeacherHomeworkContentGroup<T>[] = [];
  if (homeworks.length) result.push({ kind: "LESSON", items: homeworks, activityGroups: [] });
  if (activities.length) {
    const byType = new Map<TeacherHomeworkActivityGroupType, T[]>();
    for (const item of activities) {
      const type = activityType(item);
      const group = byType.get(type) ?? [];
      group.push(item);
      byType.set(type, group);
    }
    result.push({
      kind: "ACTIVITY",
      items: activities,
      activityGroups: ACTIVITY_ORDER.flatMap((type) => {
        const group = byType.get(type);
        return group ? [{ type, items: group }] : [];
      }),
    });
  }
  return result;
}
