import { cleanScriptHtml } from "@/lib/script-html";

export const REGULAR_SECTION_PREFIX = "regular:";

export type RegularLessonTone =
  | "warm"
  | "vocab"
  | "exercise"
  | "grammar"
  | "reading"
  | "dialogue"
  | "teacher";

export type RegularLessonSection = {
  id: string;
  title: string;
  tone: RegularLessonTone;
  studentHtml: string;
  teacherHtml: string;
  defaultOpen: boolean;
  teacherOnly?: boolean;
};

const TONES = new Set<RegularLessonTone>([
  "warm",
  "vocab",
  "exercise",
  "grammar",
  "reading",
  "dialogue",
  "teacher",
]);

export function regularSectionKey(id: string): string {
  return `${REGULAR_SECTION_PREFIX}${id}`;
}

export function normalizeRegularLessonSections(value: unknown): RegularLessonSection[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const sections: RegularLessonSection[] = [];

  for (const raw of value.slice(0, 60)) {
    if (!raw || typeof raw !== "object") continue;
    const item = raw as Record<string, unknown>;
    const id = String(item.id ?? "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 64);
    const title = String(item.title ?? "").trim().slice(0, 180);
    if (!id || !title || seen.has(id)) continue;
    seen.add(id);
    const tone = TONES.has(item.tone as RegularLessonTone)
      ? (item.tone as RegularLessonTone)
      : "exercise";
    sections.push({
      id,
      title,
      tone,
      studentHtml: cleanScriptHtml(String(item.studentHtml ?? "")),
      teacherHtml: cleanScriptHtml(String(item.teacherHtml ?? item.studentHtml ?? "")),
      defaultOpen: item.defaultOpen === true,
      ...(item.teacherOnly === true ? { teacherOnly: true } : {}),
    });
  }

  return sections;
}

export function publicRegularLessonSections(
  value: unknown,
): RegularLessonSection[] {
  return normalizeRegularLessonSections(value)
    .filter((section) => !section.teacherOnly)
    .map((section) => ({ ...section, teacherHtml: "" }));
}

export function defaultRegularOpenSections(value: unknown): string[] {
  return normalizeRegularLessonSections(value)
    .filter((section) => section.defaultOpen && !section.teacherOnly)
    .map((section) => regularSectionKey(section.id));
}

export function regularLessonSection(
  key: unknown,
  value: unknown,
): RegularLessonSection | null {
  if (typeof key !== "string" || !key.startsWith(REGULAR_SECTION_PREFIX)) return null;
  const id = key.slice(REGULAR_SECTION_PREFIX.length);
  return normalizeRegularLessonSections(value).find((section) => section.id === id) ?? null;
}
