import type { ExportPage, Report, ReportEntry } from "./export-material";

export type ReportMaterialNode = {
  id: string;
  name: string;
  description: string | null;
  translationLang: "RU" | "UK";
  sourceText: string | null;
  phrases: ExportPage["phrases"];
  blocks: ExportPage["blocks"];
  verbs: NonNullable<ExportPage["verbs"]>;
  children: ReportMaterialNode[];
};

/** Iterative traversal preserves page order and cannot loop on a corrupt tree. */
export function studentReportEntries(groups: Array<{ title: string; nodes: ReportMaterialNode[] }>): ReportEntry[] {
  const entries: ReportEntry[] = [];
  const visited = new Set<string>();
  for (const group of groups) {
    const pending = group.nodes.slice().reverse().map((node) => ({ node, path: [group.title] }));
    while (pending.length) {
      const { node, path } = pending.pop()!;
      if (visited.has(node.id)) continue;
      visited.add(node.id);
      const here = [...path, node.name];
      if (node.phrases.length || node.blocks.length || node.verbs.length || node.sourceText?.trim()) {
        entries.push({ path: here, page: {
          title: node.name, description: node.description, phrases: node.phrases,
          blocks: node.blocks, verbs: node.verbs, sourceText: node.sourceText, lang: node.translationLang,
        } });
      }
      for (const child of node.children.slice().reverse()) pending.push({ node: child, path: here });
    }
  }
  return entries;
}

function reportDate(value: Date | string | null): string | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isFinite(date.getTime()) ? date.toLocaleDateString("ru-RU") : null;
}

/** SQL aggregates may return strings; never call Date methods on raw values. */
export function studentReportMeta(student: { level: string | null; lessonsBefore: number; startedAt: Date | string | null; approximate: boolean }, stats: { done: number; firstAt: Date | string | null }, now = new Date()): Report["meta"] {
  const since = reportDate(student.startedAt) ?? reportDate(stats.firstAt);
  return [
    student.level ? `Уровень: ${student.level}` : null,
    `Проведено уроков: ${student.approximate ? "≈ " : ""}${Math.max(0, stats.done + student.lessonsBefore)}`,
    since ? `Занимаемся с: ${since}` : null,
    `Отчёт составлен: ${reportDate(now)}`,
  ].filter((line): line is string => Boolean(line));
}
