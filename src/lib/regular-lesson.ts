import { cleanScriptHtml } from "@/lib/script-html";
import type { TranslationLang } from "@/lib/translation-lang";

export const REGULAR_SECTION_PREFIX = "regular:";
export const REGULAR_RESPONSE_PREFIX = "regular-answer:";
const REGULAR_ATTEMPTS_PREFIX = "regular-attempts:";
const REGULAR_STATUS_PREFIX = "regular-status:";
const REGULAR_NOTE_PREFIX = "regular-note:";
const REGULAR_NOTE_VISIBLE_PREFIX = "regular-note-visible:";
const REGULAR_EXERCISE_OVERRIDE_PREFIX = "regular-exercise-override:";
const REGULAR_EXERCISE_DELETED_PREFIX = "regular-exercise-deleted:";
const REGULAR_VOICE_PREFIX = "regular-voice:";

export type RegularAnswerStatus = "correct" | "locked" | null;

export type RegularExerciseOverride = {
  title: string;
  instruction: string;
  kind: "fill" | "true-false" | "open";
  /** Present only for lists that translate sentences into English. */
  translationLanguage?: TranslationLang;
  items: { prompt: string; answers: string[] }[];
};

export type RegularAnswerSpec = {
  answer: string;
  accepted: string[];
  kind: "fill" | "true-false";
};

export type RegularLessonTone =
  | "warm"
  | "vocab"
  | "exercise"
  | "grammar"
  | "reading"
  | "dialogue"
  | "teacher";

export type RegularVoiceExercise = {
  instruction: string;
  prompts: string[];
  maxSeconds: number;
};

export type RegularVoiceRecording = {
  url: string;
  durationSeconds: number;
  mimeType: string;
  publishedAt: string;
};

export type RegularLessonSection = {
  id: string;
  title: string;
  tone: RegularLessonTone;
  studentHtml: string;
  teacherHtml: string;
  defaultOpen: boolean;
  teacherOnly?: boolean;
  voiceExercise?: RegularVoiceExercise;
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

export const regularAttemptsKey = (responseKey: string) =>
  `${REGULAR_ATTEMPTS_PREFIX}${responseKey}`;

export const regularStatusKey = (responseKey: string) =>
  `${REGULAR_STATUS_PREFIX}${responseKey}`;

export const regularNoteKey = (sectionId: string, itemId: string) =>
  `${REGULAR_NOTE_PREFIX}${sectionId}:${itemId}`;

export const regularNoteVisibleKey = (sectionId: string, itemId: string) =>
  `${REGULAR_NOTE_VISIBLE_PREFIX}${sectionId}:${itemId}`;

export const regularExerciseOverrideKey = (sectionId: string, listIndex: number) =>
  `${REGULAR_EXERCISE_OVERRIDE_PREFIX}${sectionId}:${listIndex}`;

export const regularExerciseDeletedKey = (sectionId: string, listIndex: number) =>
  `${REGULAR_EXERCISE_DELETED_PREFIX}${sectionId}:${listIndex}`;

export const regularExerciseDeleted = (
  state: Record<string, string>,
  sectionId: string,
  listIndex: number,
) => state[regularExerciseDeletedKey(sectionId, listIndex)] === "1";

const regularExerciseSafeId = (value: string) =>
  value.toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 52);

/** Stable id shared by a regular lesson exercise and its homework copy. */
export const regularHomeworkExerciseId = (sectionId: string, listIndex: number) =>
  `regular-${regularExerciseSafeId(sectionId)}-${listIndex}`;

export const regularVoiceRecordingKey = (sectionId: string) =>
  `${REGULAR_VOICE_PREFIX}${sectionId}`;

export function regularVoiceRecording(
  state: Record<string, string>,
  sectionId: string,
): RegularVoiceRecording | null {
  try {
    const value = JSON.parse(state[regularVoiceRecordingKey(sectionId)] ?? "null") as
      | Partial<RegularVoiceRecording>
      | null;
    if (!value || typeof value !== "object") return null;
    const url = String(value.url ?? "").trim();
    const mimeType = String(value.mimeType ?? "audio/webm").trim().slice(0, 80);
    const publishedAt = String(value.publishedAt ?? "").trim();
    const durationSeconds = Math.max(0, Math.min(3_600, Number(value.durationSeconds) || 0));
    if (!url || (!url.startsWith("/uploads/") && !/^https:\/\//i.test(url))) return null;
    return { url, durationSeconds, mimeType, publishedAt };
  } catch {
    return null;
  }
}

export function regularAttempts(state: Record<string, string>, responseKey: string) {
  try {
    const value = JSON.parse(state[regularAttemptsKey(responseKey)] ?? "[]");
    return Array.isArray(value) ? value.map(String).slice(0, 3) : [];
  } catch {
    return [];
  }
}

export function regularStatus(
  state: Record<string, string>,
  responseKey: string,
): RegularAnswerStatus {
  const value = state[regularStatusKey(responseKey)];
  return value === "correct" || value === "locked" ? value : null;
}

export function regularExerciseOverride(
  state: Record<string, string>,
  sectionId: string,
  listIndex: number,
): RegularExerciseOverride | null {
  try {
    const value = JSON.parse(state[regularExerciseOverrideKey(sectionId, listIndex)] ?? "null");
    if (!value || typeof value !== "object" || !Array.isArray(value.items)) return null;
    const raw = value as Record<string, unknown>;
    const kind = raw.kind === "true-false" || raw.kind === "open" ? raw.kind : "fill";
    const items = value.items.slice(0, 100).flatMap((entry: unknown) => {
      if (!entry || typeof entry !== "object") return [];
      const item = entry as Record<string, unknown>;
      const prompt = String(item.prompt ?? "").trim().slice(0, 1_500);
      const answers = Array.isArray(item.answers)
        ? item.answers.map(String).map((answer) => answer.trim().slice(0, 300)).filter(Boolean).slice(0, 5)
        : [];
      return prompt ? [{ prompt, answers }] : [];
    });
    if (items.length === 0) return null;
    return {
      title: String(raw.title ?? "").trim().slice(0, 240),
      instruction: String(raw.instruction ?? "").trim().slice(0, 1_500),
      kind,
      ...((raw.translationLanguage === "RU" || raw.translationLanguage === "UK")
        ? { translationLanguage: raw.translationLanguage }
        : {}),
      items,
    };
  } catch {
    return null;
  }
}

const textOfHtml = (value: string) =>
  value
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();

const mainOrderedLists = (html: string) => {
  const withoutKeys = html.replace(
    /<div\b[^>]*class=["'][^"']*(?:key|key-wrap|teacher-note)[^"']*["'][^>]*>[\s\S]*?<\/div>/gi,
    "",
  );
  return [...withoutKeys.matchAll(/<ol\b[^>]*>([\s\S]*?)<\/ol>/gi)].map((match) => match[1]);
};

/** Whether this numbered list is explicitly marked as a translation task. */
export function isRegularTranslationExercise(
  section: RegularLessonSection,
  listIndex: number,
): boolean {
  const withoutKeys = section.studentHtml.replace(
    /<div\b[^>]*class=["'][^"']*(?:key|key-wrap|teacher-note)[^"']*["'][^>]*>[\s\S]*?<\/div>/gi,
    "",
  );
  const lists = [...withoutKeys.matchAll(/<ol\b([^>]*)>[\s\S]*?<\/ol>/gi)];
  const attrs = lists[listIndex - 1]?.[1] ?? "";
  const className = attrs.match(/class\s*=\s*["']([^"']*)["']/i)?.[1] ?? "";
  return /(?:^|\s)translation-check(?:\s|$)/i.test(className);
}

const listItems = (html: string) =>
  [...html.matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/gi)].map((match) => match[1]);

const splitAccepted = (raw: string) => {
  const compact = textOfHtml(raw).replace(/\s*\([^)]*\)\s*$/, "").trim();
  const variants = compact.split(/\s+\/\s+/).map((value) => value.trim()).filter(Boolean);
  return variants.length > 0 ? variants : [compact];
};

/** Correct answers stay on the server; public lesson payloads never include teacherHtml. */
export function regularAnswerMap(
  section: RegularLessonSection,
  state: Record<string, string> = {},
): Map<string, RegularAnswerSpec> {
  const result = new Map<string, RegularAnswerSpec>();
  const studentLists = mainOrderedLists(section.studentHtml);
  const teacherLists = mainOrderedLists(section.teacherHtml);

  studentLists.forEach((studentList, listIndex) => {
    if (regularExerciseDeleted(state, section.id, listIndex + 1)) return;
    const studentItems = listItems(studentList);
    const teacherItems = listItems(teacherLists[listIndex] ?? "");
    const override = regularExerciseOverride(state, section.id, listIndex + 1);

    studentItems.forEach((studentItem, itemIndex) => {
      const overrideItem = override?.items[itemIndex];
      const isTrueFalse = override
        ? override.kind === "true-false"
        : /class=["'][^"']*\btfbox\b/i.test(studentItem);
      const controlCount = override
        ? override.kind === "open"
          ? 0
          : override.kind === "true-false"
            ? 1
            : (overrideItem?.prompt.match(/___/g) ?? []).length
        : isTrueFalse
          ? (studentItem.match(/class=["'][^"']*\btfbox\b/gi) ?? []).length
          : (studentItem.match(/class=["'][^"']*\bblank\b/gi) ?? []).length;
      if (controlCount === 0) return;
      const answerHtml = [
        ...(teacherItems[itemIndex] ?? "").matchAll(
          /<span\b[^>]*class=["'][^"']*\bans\b[^"']*["'][^>]*>([\s\S]*?)<\/span>/gi,
        ),
      ].map((match) => match[1]);
      const overrideAnswers = overrideItem?.answers ?? [];

      for (let controlIndex = 0; controlIndex < controlCount; controlIndex += 1) {
        const source = overrideAnswers[controlIndex] || answerHtml[controlIndex] || "";
        const accepted = splitAccepted(source);
        const answer = accepted[0] ?? "";
        if (!answer) continue;
        const responseId = `list-${listIndex + 1}-item-${itemIndex + 1}-${
          isTrueFalse ? "tf" : "blank"
        }-${controlIndex + 1}`;
        result.set(responseId, {
          answer,
          accepted,
          kind: isTrueFalse ? "true-false" : "fill",
        });
      }
    });
  });
  return result;
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
    const rawVoice = item.voiceExercise;
    const voiceExercise = rawVoice && typeof rawVoice === "object"
      ? (() => {
          const voice = rawVoice as Record<string, unknown>;
          const prompts = Array.isArray(voice.prompts)
            ? voice.prompts
                .map(String)
                .map((prompt) => prompt.trim().slice(0, 500))
                .filter(Boolean)
                .slice(0, 20)
            : [];
          if (prompts.length === 0) return undefined;
          return {
            instruction: String(voice.instruction ?? "")
              .trim()
              .slice(0, 1_000),
            prompts,
            maxSeconds: Math.max(30, Math.min(1_200, Number(voice.maxSeconds) || 600)),
          } satisfies RegularVoiceExercise;
        })()
      : undefined;
    sections.push({
      id,
      title,
      tone,
      studentHtml: cleanScriptHtml(String(item.studentHtml ?? "")),
      teacherHtml: cleanScriptHtml(String(item.teacherHtml ?? item.studentHtml ?? "")),
      defaultOpen: item.defaultOpen === true,
      ...(item.teacherOnly === true ? { teacherOnly: true } : {}),
      ...(voiceExercise ? { voiceExercise } : {}),
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
