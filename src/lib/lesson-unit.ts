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
  "lexis",
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

/** Служебная настройка выдачи: показывать ученику британский вариант. */
export const BRITISH_OPTION = "option:british";

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

export function lexisBlockKey(groupId: string, block: number): string {
  return `lexis:${groupId}:${block}`;
}

export function sectionKey(section: LessonSection): string {
  return `section:${section}`;
}

/** Разобрать ключ обратно — разметке нужно знать, куда он показывает. */
export function parseKey(
  key: string,
):
  | { kind: "word"; phraseId: string }
  | { kind: "lexisBlock"; groupId: string; block: number }
  | { kind: "line"; index: number }
  | { kind: "lineWord"; index: number; at: number }
  | { kind: "section"; section: LessonSection }
  | null {
  const parts = String(key ?? "").split(":");

  if (parts[0] === "word" && parts[1]) return { kind: "word", phraseId: parts[1] };
  if (parts[0] === "lexis" && parts[1] && parts[2] !== undefined) {
    const block = Number(parts[2]);
    if (Number.isInteger(block) && block >= 0) {
      return { kind: "lexisBlock", groupId: parts[1], block };
    }
  }
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

/** Фокус хранится отдельно, чтобы то же слово могло остаться жёлтым. */
export const FOCUS_SLOT = "__focus";
export const LEXIS_GROUP_SLOT = "__lexisGroup";
export const YELLOW_HIGHLIGHT = "yellow";

/** Фокусировать можно слово, часть лексики или отдельное слово расшифровки. */
export function isWordFocusKey(key: string): boolean {
  const parsed = parseKey(key);
  return (
    parsed?.kind === "word" ||
    parsed?.kind === "lexisBlock" ||
    parsed?.kind === "lineWord"
  );
}

/** В режиме выделения отмечаем слово расшифровки или реплику целиком. */
export function isDialogueHighlightKey(key: string): boolean {
  const parsed = parseKey(key);
  return parsed?.kind === "line" || parsed?.kind === "lineWord";
}

/**
 * Привести сохранённое состояние к нынешнему формату.
 *
 * Старые записи хранили цвет прямо у слова. Первую такую запись
 * превращаем в единственный фокус, а новые жёлтые выделения сохраняем
 * все без исключения.
 */
export function normalizeLessonHighlights(
  current: Record<string, string> | null | undefined,
): Record<string, string> {
  const source = current ?? {};
  const next: Record<string, string> = {};

  const selectedGroup = source[LEXIS_GROUP_SLOT];
  if (selectedGroup && selectedGroup.length <= 128 && !selectedGroup.includes(":")) {
    next[LEXIS_GROUP_SLOT] = selectedGroup;
  }

  for (const [key, value] of Object.entries(source)) {
    if (value === YELLOW_HIGHLIGHT && isDialogueHighlightKey(key)) {
      next[key] = YELLOW_HIGHLIGHT;
    }
  }

  const storedFocus = source[FOCUS_SLOT];
  if (storedFocus && isWordFocusKey(storedFocus)) {
    next[FOCUS_SLOT] = storedFocus;
    return next;
  }

  const legacy = Object.entries(source).find(
    ([key, value]) => key !== FOCUS_SLOT && value !== YELLOW_HIGHLIGHT && isWordFocusKey(key),
  );
  if (legacy) next[FOCUS_SLOT] = legacy[0];
  return next;
}

export function lessonFocus(
  current: Record<string, string> | null | undefined,
): string | null {
  return normalizeLessonHighlights(current)[FOCUS_SLOT] ?? null;
}

export function selectedLexisGroup(
  current: Record<string, string> | null | undefined,
): string | null {
  return normalizeLessonHighlights(current)[LEXIS_GROUP_SLOT] ?? null;
}

/** Переключение группы — команда ученику, а не переключатель вкл/выкл. */
export function selectLexisGroup(
  current: Record<string, string> | null | undefined,
  groupId: string,
): Record<string, string> {
  const next = normalizeLessonHighlights(current);
  const id = String(groupId ?? "");
  if (id && id.length <= 128 && !id.includes(":")) next[LEXIS_GROUP_SLOT] = id;
  return next;
}

export function yellowHighlights(
  current: Record<string, string> | null | undefined,
): Record<string, string> {
  return Object.fromEntries(
    Object.entries(normalizeLessonHighlights(current)).filter(
      ([key, value]) => key !== FOCUS_SLOT && value === YELLOW_HIGHLIGHT,
    ),
  );
}

/** Нажатие на другое слово переносит фокус, повторное — снимает. */
export function toggleWordFocus(
  current: Record<string, string> | null | undefined,
  key: string,
): Record<string, string> {
  const next = normalizeLessonHighlights(current);
  if (!isWordFocusKey(key)) return next;
  if (next[FOCUS_SLOT] === key) delete next[FOCUS_SLOT];
  else next[FOCUS_SLOT] = key;
  return next;
}

/** Включить или снять независимое жёлтое выделение в диалоге. */
export function toggleDialogueHighlight(
  current: Record<string, string> | null | undefined,
  key: string,
): Record<string, string> {
  const next = normalizeLessonHighlights(current);
  if (!isDialogueHighlightKey(key)) return next;
  if (next[key] === YELLOW_HIGHLIGHT) delete next[key];
  else next[key] = YELLOW_HIGHLIGHT;
  return next;
}

/** Разбить реплику на слова так, чтобы по ним можно было попадать. */
export function lineWords(text: string): string[] {
  return String(text ?? "").split(/(\s+)/).filter((part) => part.length > 0);
}

/* ------------------------------------------------------------------ */
/* Словник урока                                                       */
/* ------------------------------------------------------------------ */

export type LessonWord = {
  id: string;
  category: string;
  icon: string | null;
  word: string;
  ipaUs: string | null;
  ipaUk: string | null;
  translation: string | null;
  description: string | null;
  imageUrl: string | null;
};

/**
 * По чему слово встаёт в алфавит.
 *
 * Служебные to и артикли отбрасываются: иначе половина словника
 * собирается на буквах «t» и «a», и найти глазами нужное слово нельзя.
 * То же правило уже решает, показывать ли транскрипцию, — пусть будет
 * одно на обоих.
 */
export function alphaKey(word: string): string {
  const clean = String(word ?? "")
    .toLowerCase()
    .replace(/^[^\p{L}]+/u, "")
    .replace(/^(to|a|an|the)\s+/u, "");
  return clean || String(word ?? "").toLowerCase();
}

/** Слова категории по алфавиту. */
export function sortWords<T extends { word: string }>(words: T[]): T[] {
  return [...words].sort((a, b) =>
    alphaKey(a.word).localeCompare(alphaKey(b.word), "en"),
  );
}

/**
 * Категории в порядке, привычном словарю.
 *
 * Знакомые идут первыми и всегда одинаково — глазу не приходится
 * заново искать, где в этом уроке существительные. Всё незнакомое
 * становится в конец по алфавиту.
 */
export const CATEGORY_ORDER = [
  "nouns",
  "verbs",
  "adjectives",
  "adverbs",
  "prepositions",
  "phrases",
  "idioms",
  "slang",
];

/** Для сортировки и для чипсов: «🏃 Verbs» и «Verbs» — одна категория. */
export function categoryKey(category: string): string {
  return String(category ?? "")
    .toLowerCase()
    .replace(/[^\p{L}\s&]/gu, "")
    .trim();
}

export function sortCategories(categories: string[]): string[] {
  const at = (c: string) => {
    const key = categoryKey(c);
    const found = CATEGORY_ORDER.findIndex((k) => key.startsWith(k));
    return found < 0 ? CATEGORY_ORDER.length : found;
  };
  return [...categories].sort(
    (a, b) => at(a) - at(b) || categoryKey(a).localeCompare(categoryKey(b), "en"),
  );
}

/** Словник, разложенный по категориям и алфавиту. */
export function groupWords<T extends { word: string; category: string }>(
  words: T[],
): { category: string; words: T[] }[] {
  const map = new Map<string, T[]>();
  for (const w of words) {
    const key = w.category ?? "";
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(w);
  }

  return sortCategories([...map.keys()]).map((category) => ({
    category,
    words: sortWords(map.get(category)!),
  }));
}

/**
 * Поиск по словнику.
 *
 * Ищем и по слову, и по переводу, и по описанию: ученик помнит то
 * «как-то про еду», а не точное написание.
 */
export function findWords<T extends LessonWord>(words: T[], query: string): T[] {
  const q = String(query ?? "").trim().toLowerCase();
  if (!q) return words;

  return words.filter((w) =>
    [w.word, w.translation, w.description, w.category]
      .some((field) => (field ?? "").toLowerCase().includes(q)),
  );
}
