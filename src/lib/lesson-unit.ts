/**
 * Урок-активность: секции, расшифровка, подсветки.
 *
 * Здесь всё, что можно проверить без браузера и базы: как разбирается
 * вставленный диалог, что ученику видно, что именно подсвечено. Разметка
 * поверх этого остаётся тонкой.
 */

/** Секции урока-активности в том порядке, в каком их проходят. */
export const LESSON_SECTIONS = [
  "vocab",
  "video",
  "transcript",
  "questions",
  "homework",
] as const;

export type LessonSection = (typeof LESSON_SECTIONS)[number];

/**
 * Словник открыт всегда.
 *
 * С него урок начинается: пока ученик не разобрал слова, видео и
 * расшифровка для него — шум. Остальное учитель открывает по ходу.
 */
export const ALWAYS_OPEN: LessonSection = "vocab";

export function isSection(value: unknown): value is LessonSection {
  return LESSON_SECTIONS.includes(value as LessonSection);
}

/** Что ученику сейчас видно. */
export function openSections(stored: string[] | null | undefined): LessonSection[] {
  const set = new Set<LessonSection>([ALWAYS_OPEN]);
  for (const key of stored ?? []) if (isSection(key)) set.add(key);
  return LESSON_SECTIONS.filter((s) => set.has(s));
}

export function canSee(
  stored: string[] | null | undefined,
  section: LessonSection,
): boolean {
  return section === ALWAYS_OPEN || (stored ?? []).includes(section);
}

/* ------------------------------------------------------------------ */
/* Расшифровка                                                         */
/* ------------------------------------------------------------------ */

export type TranscriptLine = { speaker: string; text: string };

/**
 * Разобрать вставленный диалог.
 *
 * Формат — тот, в каком расшифровки и пишут: «Имя: реплика». Строка без
 * имени продолжает предыдущую реплику, а не заводит безымянную: в
 * расшифровках перенос строки посреди фразы — обычное дело.
 *
 * Пустые строки разделяют реплики и в текст не попадают.
 */
export function parseTranscript(raw: string): TranscriptLine[] {
  const out: TranscriptLine[] = [];

  for (const line of String(raw ?? "").split(/\r?\n/)) {
    const text = line.trim();
    if (!text) continue;

    // Имя — до первого двоеточия, и только если оно короткое: в реплике
    // двоеточий сколько угодно, а имя в две строки не бывает.
    const at = text.indexOf(":");
    const speaker = at > 0 ? text.slice(0, at).trim() : "";

    if (speaker && speaker.length <= 24 && !speaker.includes(" :")) {
      out.push({ speaker, text: text.slice(at + 1).trim() });
      continue;
    }

    if (out.length === 0) out.push({ speaker: "", text });
    else out[out.length - 1].text += " " + text;
  }

  return out.filter((l) => l.text);
}

/** Кто говорит — в порядке первого появления. */
export function speakersOf(lines: TranscriptLine[]): string[] {
  const seen: string[] = [];
  for (const line of lines) {
    if (line.speaker && !seen.includes(line.speaker)) seen.push(line.speaker);
  }
  return seen;
}

/**
 * Цвета реплик.
 *
 * Привязаны к порядку появления, а не к имени: так первый говорящий
 * всегда одного цвета, и глазу не приходится заново привыкать в каждой
 * расшифровке.
 */
export const SPEAKER_TINTS = [
  "tint-accent",
  "tint-violet",
  "tint-amber",
  "tint-sky",
  "tint-green",
  "tint-orange",
] as const;

export function speakerTint(speakers: string[], speaker: string): string {
  const at = speakers.indexOf(speaker);
  return at < 0 ? "tint-sky" : SPEAKER_TINTS[at % SPEAKER_TINTS.length];
}

/* ------------------------------------------------------------------ */
/* Подсветки                                                           */
/* ------------------------------------------------------------------ */

/** Чем можно подсветить. Первые три — те, что под рукой. */
export const HIGHLIGHTS = ["red", "amber", "green", "sky", "violet"] as const;
export type HighlightColor = (typeof HIGHLIGHTS)[number];

export function isHighlight(value: unknown): value is HighlightColor {
  return HIGHLIGHTS.includes(value as HighlightColor);
}

/**
 * Куда показывает подсветка или фокус.
 *
 * Один ключ на всё: слово словника, реплика целиком, слово в реплике.
 * Иначе пришлось бы держать три одинаковых хранилища и три способа
 * сказать «вот сюда смотри».
 */
export function wordKey(phraseId: string): string {
  return `word:${phraseId}`;
}

export function lineKey(index: number): string {
  return `line:${index}`;
}

export function lineWordKey(index: number, at: number): string {
  return `line:${index}:${at}`;
}

export function sectionKey(section: LessonSection): string {
  return `section:${section}`;
}

/** Разобрать ключ обратно — разметке нужно знать, куда он показывает. */
export function parseKey(
  key: string,
):
  | { kind: "word"; phraseId: string }
  | { kind: "line"; index: number }
  | { kind: "lineWord"; index: number; at: number }
  | { kind: "section"; section: LessonSection }
  | null {
  const parts = String(key ?? "").split(":");

  if (parts[0] === "word" && parts[1]) return { kind: "word", phraseId: parts[1] };
  if (parts[0] === "section" && isSection(parts[1])) {
    return { kind: "section", section: parts[1] };
  }
  if (parts[0] === "line" && parts[1] !== undefined) {
    const index = Number(parts[1]);
    if (!Number.isInteger(index) || index < 0) return null;
    if (parts[2] === undefined) return { kind: "line", index };
    const at = Number(parts[2]);
    if (!Number.isInteger(at) || at < 0) return null;
    return { kind: "lineWord", index, at };
  }

  return null;
}

/**
 * Поставить или снять подсветку.
 *
 * Тот же цвет на том же месте снимает её: отдельная кнопка «убрать»
 * заставляла бы целиться дважды.
 */
export function toggleHighlight(
  current: Record<string, string>,
  key: string,
  color: HighlightColor,
): Record<string, string> {
  const next = { ...current };
  if (next[key] === color) delete next[key];
  else next[key] = color;
  return next;
}

/** Разбить реплику на слова так, чтобы по ним можно было попадать. */
export function lineWords(text: string): string[] {
  return String(text ?? "").split(/(\s+)/).filter((part) => part.length > 0);
}
