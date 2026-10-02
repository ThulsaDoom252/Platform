import { cleanScriptHtml } from "@/lib/script-html";

export const REGULAR_SECTION_PREFIX = "regular:";
export const REGULAR_RESPONSE_PREFIX = "regular-answer:";

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

/** Ответ внутри обычного HTML-урока хранится в закреплении ученика. */
export function regularResponseKey(sectionId: string, responseId: string): string {
  return `${REGULAR_RESPONSE_PREFIX}${sectionId}:${responseId}`;
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

export function isRegularLessonFocusId(
  id: unknown,
  section: RegularLessonSection,
): id is string {
  if (id === "heading") return true;
  if (typeof id !== "string" || !/^[a-z0-9:-]{1,80}$/i.test(id)) return false;
  const needle = `data-focus-id="${id}"`;
  return section.studentHtml.includes(needle) || section.teacherHtml.includes(needle);
}

/**
 * Помечает смысловые элементы импортированного урока стабильными ID.
 * Учительские блоки ответов пропускаются, поэтому номера совпадают в
 * student/teacher HTML даже там, где у учителя добавлен большой ключ.
 */
export function addRegularLessonFocusIds(raw: string): string {
  const stack: { tag: string; startsBlocked: boolean }[] = [];
  let blockedDepth = 0;
  let index = 0;

  return String(raw ?? "").replace(
    /<\/?([a-zA-Z][a-zA-Z0-9]*)([^>]*)>/g,
    (whole, rawTag: string, attrs: string) => {
      const tag = rawTag.toLowerCase();
      if (whole.startsWith("</")) {
        for (let at = stack.length - 1; at >= 0; at -= 1) {
          const entry = stack[at];
          stack.splice(at, 1);
          if (entry.startsBlocked) blockedDepth = Math.max(0, blockedDepth - 1);
          if (entry.tag === tag) break;
        }
        return whole;
      }

      const className = attrs.match(/class\s*=\s*["']([^"']*)["']/i)?.[1] ?? "";
      const startsBlocked = /(?:^|\s)(?:key|key-wrap|teacher-note)(?:\s|$)/i.test(className);
      const blocked = blockedDepth > 0 || startsBlocked;
      const focusable =
        !blocked &&
        (["h3", "p", "li", "tr"].includes(tag) ||
          (tag === "div" && /(?:^|\s)(?:vcard|support|tip|warn)(?:\s|$)/i.test(className)));
      let next = whole;
      if (focusable && !/\bdata-focus-id\s*=/i.test(attrs)) {
        index += 1;
        next = whole.replace(/>$/, ` data-focus-id="item-${index}">`);
      }

      if (!/\/$/.test(attrs.trim()) && !["br", "hr", "img", "input", "meta", "link"].includes(tag)) {
        stack.push({ tag, startsBlocked });
        if (startsBlocked) blockedDepth += 1;
      }
      return next;
    },
  );
}
