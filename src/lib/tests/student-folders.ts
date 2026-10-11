import type { TestHomeworkCard } from "./types";

/** Only assignments visible to the current teacher are passed in; names aren't keys. */
export function studentTestFolders(items: TestHomeworkCard[], locale = "en") {
  const groups = new Map<string, { id: string; name: string; items: TestHomeworkCard[]; awaiting: number; passed: number; results: { id: string; title: string; percent: number | null }[] }>();
  for (const item of items) {
    let group = groups.get(item.studentId);
    if (!group) { group = { id: item.studentId, name: item.studentName, items: [], awaiting: 0, passed: 0, results: [] }; groups.set(item.studentId, group); }
    group.items.push(item);
    if (item.submittedAt) { group.passed += 1; group.results.push({ id: item.id, title: item.title, percent: item.latestPercent }); }
    else group.awaiting += 1;
  }
  return [...groups.values()].sort((a, b) => a.name.localeCompare(b.name, locale, { sensitivity: "base" }) || a.id.localeCompare(b.id));
}
