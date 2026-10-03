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

/** Explicit override for the vocabulary section, which is open by default. */
export const HIDDEN_VOCAB_OPTION = "lesson:hidden:vocab";

/**
 * Shorts are deliberately compact: vocabulary and lexis lead into one
 * video/transcript flow, followed by discussion questions and homework.
 */
export const SHORTS_SECTIONS = [
  "vocab",
  "lexis",
  "video",
  "transcript",
  "questions",
  "homework",
] as const satisfies readonly LessonSection[];

export function lessonSectionsForKind(kind: string): LessonSection[] {
  return kind === "SHORTS" ? [...SHORTS_SECTIONS] : [...LESSON_SECTIONS];
}

/**
 * Словник открыт по умолчанию.
 *
 * С него урок начинается: пока ученик не разобрал слова, видео и
 * расшифровка для него — шум. Учитель может скрыть и его, а остальное
 * открывает по ходу.
 */
export const ALWAYS_OPEN: LessonSection = "vocab";

/** Служебная настройка выдачи: показывать ученику британский вариант. */
export const BRITISH_OPTION = "option:british";

const VOCAB_REVEAL_PREFIX = "option:vocab-reveal:";
const VOCAB_ALL_TRANSLATIONS = `${VOCAB_REVEAL_PREFIX}translations:all`;
const VOCAB_ALL_DESCRIPTIONS = `${VOCAB_REVEAL_PREFIX}descriptions:all`;
const VOCAB_ALL_EXAMPLES = `${VOCAB_REVEAL_PREFIX}examples:all`;
const VOCAB_ALL_NOTES = `${VOCAB_REVEAL_PREFIX}notes:all`;

export type LessonVocabularyReveal = {
  allTranslations: boolean;
  allDescriptions: boolean;
  allExamples: boolean;
  allNotes: boolean;
  /** При общем показе это исключения; без него — открытые записи. */
  translations: string[];
  descriptions: string[];
  examples: string[];
  notes: string[];
};

export const emptyLessonVocabularyReveal = (): LessonVocabularyReveal => ({
  allTranslations: false,
  allDescriptions: false,
  allExamples: false,
  allNotes: false,
  translations: [],
  descriptions: [],
  examples: [],
  notes: [],
});

export function isLessonVocabularyRevealOption(value: string): boolean {
  return String(value ?? "").startsWith(VOCAB_REVEAL_PREFIX);
}

export function lessonVocabularyReveal(
  stored: string[] | null | undefined,
): LessonVocabularyReveal {
  const state = emptyLessonVocabularyReveal();
  for (const option of stored ?? []) {
    if (option === VOCAB_ALL_TRANSLATIONS) state.allTranslations = true;
    else if (option === VOCAB_ALL_DESCRIPTIONS) state.allDescriptions = true;
    else if (option === VOCAB_ALL_EXAMPLES) state.allExamples = true;
    else if (option === VOCAB_ALL_NOTES) state.allNotes = true;
    else if (option.startsWith(`${VOCAB_REVEAL_PREFIX}translation:`)) {
      const id = option.slice(`${VOCAB_REVEAL_PREFIX}translation:`.length);
      if (id && !state.translations.includes(id)) state.translations.push(id);
    } else if (option.startsWith(`${VOCAB_REVEAL_PREFIX}description:`)) {
      const id = option.slice(`${VOCAB_REVEAL_PREFIX}description:`.length);
      if (id && !state.descriptions.includes(id)) state.descriptions.push(id);
    } else if (option.startsWith(`${VOCAB_REVEAL_PREFIX}example:`)) {
      const id = option.slice(`${VOCAB_REVEAL_PREFIX}example:`.length);
      if (id && !state.examples.includes(id)) state.examples.push(id);
    } else if (option.startsWith(`${VOCAB_REVEAL_PREFIX}note:`)) {
      const id = option.slice(`${VOCAB_REVEAL_PREFIX}note:`.length);
      if (id && !state.notes.includes(id)) state.notes.push(id);
    }
  }
  return state;
}

export function normalizeLessonVocabularyReveal(
  value: Partial<LessonVocabularyReveal> | null | undefined,
  allowedIds?: ReadonlySet<string>,
): LessonVocabularyReveal {
  const ids = (list: unknown) => [
    ...new Set(
      (Array.isArray(list) ? list : [])
        .map(String)
        .filter((id) => id && id.length <= 64 && !id.includes(":"))
        .filter((id) => !allowedIds || allowedIds.has(id)),
    ),
  ].slice(0, 2_000);
  return {
    allTranslations: value?.allTranslations === true,
    allDescriptions: value?.allDescriptions === true,
    allExamples: value?.allExamples === true,
    allNotes: value?.allNotes === true,
    translations: ids(value?.translations),
    descriptions: ids(value?.descriptions),
    examples: ids(value?.examples),
    notes: ids(value?.notes),
  };
}

export function lessonVocabularyRevealOptions(
  raw: Partial<LessonVocabularyReveal> | null | undefined,
): string[] {
  const value = normalizeLessonVocabularyReveal(raw);
  return [
    ...(value.allTranslations ? [VOCAB_ALL_TRANSLATIONS] : []),
    ...(value.allDescriptions ? [VOCAB_ALL_DESCRIPTIONS] : []),
    ...(value.allExamples ? [VOCAB_ALL_EXAMPLES] : []),
    ...(value.allNotes ? [VOCAB_ALL_NOTES] : []),
    ...value.translations.map((id) => `${VOCAB_REVEAL_PREFIX}translation:${id}`),
    ...value.descriptions.map((id) => `${VOCAB_REVEAL_PREFIX}description:${id}`),
    ...value.examples.map((id) => `${VOCAB_REVEAL_PREFIX}example:${id}`),
    ...value.notes.map((id) => `${VOCAB_REVEAL_PREFIX}note:${id}`),
  ];
}

export function toggleLessonVocabularyReveal(
  raw: LessonVocabularyReveal,
  kind: "translation" | "description" | "example" | "note",
  wordId?: string,
): LessonVocabularyReveal {
  const next = normalizeLessonVocabularyReveal(raw);
  const list = kind === "translation"
    ? "translations"
    : kind === "description"
      ? "descriptions"
      : kind === "example"
        ? "examples"
        : "notes";
  const all = kind === "translation"
    ? "allTranslations"
    : kind === "description"
      ? "allDescriptions"
      : kind === "example"
        ? "allExamples"
        : "allNotes";
  if (!wordId) return { ...next, [all]: !next[all], [list]: [] };
  const values = next[list];
  return {
    ...next,
    [list]: values.includes(wordId)
      ? values.filter((id) => id !== wordId)
      : [...values, wordId],
  };
}

export function isSection(value: unknown): value is LessonSection {
  return LESSON_SECTIONS.includes(value as LessonSection);
}

/** Что ученику сейчас видно. */
export function openSections(stored: string[] | null | undefined): LessonSection[] {
  const values = stored ?? [];
  const set = new Set<LessonSection>(
    values.includes(HIDDEN_VOCAB_OPTION) ? [] : [ALWAYS_OPEN],
  );
  for (const key of values) if (isSection(key)) set.add(key);
  return LESSON_SECTIONS.filter((s) => set.has(s));
}

export function canSee(
  stored: string[] | null | undefined,
  section: LessonSection,
): boolean {
  return section === ALWAYS_OPEN
    ? !(stored ?? []).includes(HIDDEN_VOCAB_OPTION)
    : (stored ?? []).includes(section);
}

/**
 * Навигация по вкладкам живого урока.
 *
 * Принудительный фокус возвращается отдельно: он разрешает один показ,
 * но намеренно не попадает в selectable и не выдаёт постоянный доступ.
 */
export function lessonSectionNavigation(
  displayed: readonly LessonSection[],
  closed: readonly LessonSection[] | undefined,
  lockClosed: boolean,
  forced: LessonSection | null | undefined,
): { selectable: LessonSection[]; forced: LessonSection | null } {
  const visible = LESSON_SECTIONS.filter((section) => displayed.includes(section));
  const blocked = new Set(lockClosed ? closed ?? [] : []);
  return {
    selectable: visible.filter((section) => !blocked.has(section)),
    forced: forced && visible.includes(forced) ? forced : null,
  };
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
export const GREEN_HIGHLIGHT = "green";
export const RED_HIGHLIGHT = "red";
export type HighlightColor =
  | typeof YELLOW_HIGHLIGHT
  | typeof GREEN_HIGHLIGHT
  | typeof RED_HIGHLIGHT;

export function isHighlightColor(value: unknown): value is HighlightColor {
  return (
    value === YELLOW_HIGHLIGHT ||
    value === GREEN_HIGHLIGHT ||
    value === RED_HIGHLIGHT
  );
}

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
 * Stable keys produced by the DOM-wide lesson highlighter.
 *
 * The two hashes identify a visible lesson scope and a word in that scope;
 * the final number separates repeated identical snippets. Keeping the format
 * deliberately narrow prevents arbitrary JSON keys from reaching a lesson
 * assignment through the public Server Action.
 */
export function isLessonTextHighlightKey(key: string): boolean {
  return /^text:[a-f0-9]{8}:[a-f0-9]{8}:\d{1,4}$/.test(String(key ?? ""));
}

export function isLessonHighlightKey(key: string): boolean {
  return isDialogueHighlightKey(key) || isLessonTextHighlightKey(key);
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
    if (isHighlightColor(value) && isLessonHighlightKey(key)) {
      next[key] = value;
    }
  }

  const storedFocus = source[FOCUS_SLOT];
  if (storedFocus && isWordFocusKey(storedFocus)) {
    next[FOCUS_SLOT] = storedFocus;
    return next;
  }

  const legacy = Object.entries(source).find(
    ([key, value]) => key !== FOCUS_SLOT && !isHighlightColor(value) && isWordFocusKey(key),
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

/** Все сохранённые цветные пометки урока. */
export function dialogueHighlights(
  current: Record<string, string> | null | undefined,
): Record<string, HighlightColor> {
  return Object.fromEntries(
    Object.entries(normalizeLessonHighlights(current)).filter(
      ([key, value]) => key !== FOCUS_SLOT && isHighlightColor(value),
    ),
  ) as Record<string, HighlightColor>;
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

/** Включить или снять независимое цветное выделение в уроке. */
export function toggleLessonHighlight(
  current: Record<string, string> | null | undefined,
  key: string,
  color: HighlightColor = YELLOW_HIGHLIGHT,
): Record<string, string> {
  const next = normalizeLessonHighlights(current);
  if (!isLessonHighlightKey(key) || !isHighlightColor(color)) return next;
  if (next[key] === color) delete next[key];
  else next[key] = color;
  return next;
}

/** Backwards-compatible name for older transcript-only callers. */
export const toggleDialogueHighlight = toggleLessonHighlight;

/** Разбить реплику на слова так, чтобы по ним можно было попадать. */
export function lineWords(text: string): string[] {
  return String(text ?? "").split(/(\s+)/).filter((part) => part.length > 0);
}

export type RichLineWord = { text: string; bold: boolean };

/**
 * Разбить реплику на кликабельные части и убрать служебные **маркеры**.
 *
 * Индексы обычных реплик остаются прежними, поэтому сохранённые фокусы и
 * жёлтые выделения не съезжают. Незакрытый маркер показываем как обычный
 * текст: опечатка в редакторе не должна съедать половину реплики.
 */
export function richLineWords(text: string): RichLineWord[] {
  const source = String(text ?? "");
  const markers = source.match(/\*\*/g)?.length ?? 0;
  if (markers === 0 || markers % 2 !== 0) {
    return lineWords(source).map((part) => ({ text: part, bold: false }));
  }

  const out: RichLineWord[] = [];
  let bold = false;
  for (const section of source.split("**")) {
    for (const part of lineWords(section)) out.push({ text: part, bold });
    bold = !bold;
  }
  return out;
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
  note: string | null;
  examples: { en: string; tr: string }[];
  sectionColor: string | null;
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
