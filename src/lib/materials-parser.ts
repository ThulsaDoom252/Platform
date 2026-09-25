/**
 * Парсер учебного текста из Google Docs в структуру фраз.
 *
 * Формат документа неоднозначен: и термин, и пример разделены одним и тем же
 * тире. Поэтому строки различаются эвристиками (маркер списка, транскрипция,
 * конечная пунктуация). Результат обязательно показывается на предпросмотре.
 */
import { suggestVocabularyIcon } from "./icon-suggest";

export type ParsedExample = { en: string; tr: string };

export type ParsedPhrase = {
  icon: string | null;
  section: string | null;
  kind: "PHRASE" | "NOTE";
  phrase: string;
  transcription: string | null;
  translation: string;
  examples: ParsedExample[];
};

export type ParseResult = {
  title: string | null;
  description: string | null;
  phrases: ParsedPhrase[];
  warnings: string[];
  /** Внутренний тип словарной разметки, выбранный автоматически. */
  vocabularyFormat?: VocabularyParserFormat;
};

export type ParserMode = "vocabulary" | "mistake";
export type VocabularyParserFormat = "standard" | "word-examples-table";

/** Тире, которыми в документе разделены термин и перевод. */
const DASH = /\s+[—–]\s+|\s+-{1,2}\s+/;

/** Маркеры списка в начале строки. */
const BULLET = /^\s*[•●▪‣·*\-–]\s+/;

/** Значки, которыми в документах помечают пояснения и предупреждения. */
const NOTE_ICONS = ["💡", "⚠️", "⚠", "📌", "📍", "❗"];
const NOTE_LEAD = /^\s*(?:💡|⚠️?|📌|📍|❗)\s*/u;

/** Стрелка «значит / получается»: отделяет пояснение от примера. */
const TO = /\s*[→⟶➜➔]\s*/;

/** Ведущие эмодзи и значок динамика, которые копируются вместе с текстом. */
const LEADING_ICONS =
  /^\s*(?:[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{200D}\u{20E3}]+\s*)+/u;

/**
 * Транскрипция в слешах. Пробел сразу после открывающего слеша или перед
 * закрывающим означает, что это не транскрипция, а разделитель вариантов:
 * «fortunately / unfortunately /ˈfɔː.tʃənətli/» — тут нужен только последний.
 */
const IPA = /\/(?:[^/\s]|[^/\s][^/]{0,58}[^/\s])\//;

/** Значок озвучки в начале строки и подпись рядом с ним. */
const SPEAKER = /^\s*[\u{1F50A}\u{1F508}\u{1F509}\u{1F3A7}\u{25B6}\u{23F5}]️?\s*/u;
const SPEAKER_LABEL =
  /^(?:слухати|прослухати|слушать|прослушать|послушать|listen|play|audio)\b[\s:–—-]*/iu;

/** Галочка / крестик перед словом или заголовком смысловой группы. */
const VERDICT_ICON = /^\s*[✗✘❌✓✔✅]\uFE0F?\s*/u;

/**
 * Убирает значок озвучки и подпись к нему: «🔊 слухати  accidentally …».
 * Подпись бывает разной, поэтому после известных слов отбрасываем и любые
 * кириллические слова перед латинским термином.
 */
function stripSpeaker(line: string): string {
  const m = line.match(SPEAKER);
  if (!m) return line;

  let rest = line.slice(m[0].length).replace(SPEAKER_LABEL, "");
  if (/^[\p{Script=Cyrillic}]/u.test(rest) && /[A-Za-z]/.test(rest)) {
    rest = rest.replace(/^(?:[\p{Script=Cyrillic}’'-]+[ \t]+)+/u, "");
  }
  return rest;
}

function stripBullet(line: string) {
  return line.replace(BULLET, "");
}

/** Отделяет ведущий эмодзи от текста строки. */
function takeLeadingIcon(line: string): { icon: string | null; rest: string } {
  const m = line.match(LEADING_ICONS);
  if (!m) return { icon: null, rest: line };
  // Берём только первый «смысловой» символ, отбрасывая 🔊 и подобные служебные.
  const chars = Array.from(m[0].trim());
  const icon = chars.filter((c) => c !== "🔊" && c !== "🔈" && c !== "🔉")[0] ?? null;
  return { icon: icon ?? null, rest: line.slice(m[0].length) };
}

function splitByDash(text: string): [string, string] | null {
  const idx = text.search(DASH);
  if (idx === -1) return null;
  const match = text.match(DASH)!;
  const left = text.slice(0, idx).trim();
  const right = text.slice(idx + match[0].length).trim();
  if (!left || !right) return null;
  return [left, right];
}

/**
 * В диалоговых примерах встречаются четыре части:
 * «Do you like it? — Absolutely! — Тобі подобається? — Абсолютно!».
 * Границу перевода надёжнее искать по первому кириллическому фрагменту,
 * сохраняя вопрос и ответ вместе по обе стороны.
 */
function splitExampleByLanguage(text: string): [string, string] | null {
  const parts = text
    .split(/\s+(?:—|–|-{1,2})\s+/)
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length < 2) return null;

  const translationAt = parts.findIndex((part) => /\p{Script=Cyrillic}/u.test(part));
  if (translationAt > 0) {
    return [
      parts.slice(0, translationAt).join(" — "),
      parts.slice(translationAt).join(" — "),
    ];
  }

  return [parts[0], parts.slice(1).join(" — ")];
}

/** Похоже ли, что левая часть строки — пример, а не термин. */
function looksLikeExample(left: string, hadBullet: boolean): boolean {
  if (hadBullet) return true;
  if (IPA.test(left)) return false;
  const words = left.split(/\s+/).length;
  const endsAsSentence = /[.!?]$/.test(left);
  if (endsAsSentence && words >= 4) return true;
  return false;
}

/** Заголовок секции: строка без тире, не слишком длинная. */
function looksLikeSection(line: string): boolean {
  if (splitByDash(line)) return false;
  const words = line.split(/\s+/).length;
  return words <= 12 && !/[.!?]$/.test(line);
}

function startsUpper(s: string): boolean {
  const first = Array.from(s.trim())[0];
  return !!first && /\p{Lu}/u.test(first);
}

/**
 * Заголовок секции с тире: «Adjectives — Language & Attitudes».
 * Отличается от записи тем, что обе части начинаются с заглавной —
 * у записи перевод всегда со строчной («avid — завзятий»).
 */
function isSectionHeading(left: string, right: string): boolean {
  if (IPA.test(left)) return false;
  if (/[.!?]$/.test(left) || /[.!?]$/.test(right)) return false;
  if (left.split(/\s+/).length > 8) return false;
  return startsUpper(left) && startsUpper(right);
}

const ICON_CYCLE = ["💬", "📘", "🔤", "🧩", "✨", "📗", "🗣️", "📙"];

/**
 * Словник часто оформлен таблицей: колонки «Word / Phrase», «IPA»,
 * «Translation» плюс колонка со значком динамика. При копировании ячейки
 * разделяются табуляцией, поэтому такие строки разбираем отдельно.
 */
const COLUMN = {
  word: /\b(word|phrase|term)\b|слов|фраз|вираз|выражен/i,
  ipa: /\bipa\b|transcri|транскрип|вимов|произнош/i,
  translation: /translat|перевод|переклад|значенн/i,
  examples: /\bexamples?\b|приклад|пример/i,
};

type ColumnMap = { word: number; ipa: number | null; translation: number };
type WordExamplesColumnMap = { word: number; examples: number };

/** Шапка таблицы: по ней запоминаем, в какой колонке что лежит. */
function detectHeader(cells: string[]): ColumnMap | null {
  let word = -1;
  let ipa = -1;
  let translation = -1;

  cells.forEach((cell, i) => {
    const t = cell.trim();
    if (!t || t.length > 30) return;
    if (word < 0 && COLUMN.word.test(t)) word = i;
    else if (ipa < 0 && COLUMN.ipa.test(t)) ipa = i;
    else if (translation < 0 && COLUMN.translation.test(t)) translation = i;
  });

  if (word < 0 || translation < 0) return null;
  return { word, ipa: ipa < 0 ? null : ipa, translation };
}

/**
 * Отдельный тип словарной таблицы: слева слово, IPA и перевод, справа пары
 * «пример / перевод примера». В интерфейсе это всё ещё один парсер «Словник» —
 * нужный вариант выбирается по шапке Word / Phrase | Examples.
 */
function detectWordExamplesHeader(cells: string[]): WordExamplesColumnMap | null {
  let word = -1;
  let examples = -1;

  cells.forEach((cell, i) => {
    const text = cell.trim();
    if (!text || text.length > 30) return;
    if (word < 0 && COLUMN.word.test(text)) word = i;
    if (examples < 0 && COLUMN.examples.test(text)) examples = i;
  });

  if (word < 0 || examples < 0 || word === examples) return null;
  return { word, examples };
}

/** Левая ячейка: «🚫 obsolete /ˌɒb.səˈliːt/ застарілий / застарілий». */
function parseWordExamplesEntry(cell: string): {
  icon: string | null;
  phrase: string;
  transcription: string | null;
  translation: string;
} | null {
  const withoutSpeaker = stripSpeaker(cell).trim();
  const { icon, rest } = takeLeadingIcon(withoutSpeaker);
  const text = rest.trim();
  const ipaMatch = text.match(IPA);

  if (ipaMatch?.index !== undefined) {
    const phrase = text.slice(0, ipaMatch.index).trim();
    const translation = text
      .slice(ipaMatch.index + ipaMatch[0].length)
      .replace(/^\s*[—–-]\s*/, "")
      .trim();
    if (phrase && translation) {
      return { icon, phrase, transcription: ipaMatch[0], translation };
    }
  }

  // Запасной вариант для строк без IPA: граница проходит перед кириллицей.
  const translationAt = text.search(/\p{Script=Cyrillic}/u);
  if (translationAt <= 0) return null;
  const phrase = text.slice(0, translationAt).replace(/\s*[—–-]\s*$/, "").trim();
  const translation = text.slice(translationAt).trim();
  return phrase && translation
    ? { icon, phrase, transcription: null, translation }
    : null;
}

/**
 * Правая ячейка после копирования из Google Docs приходит одной строкой:
 * «• English sentence. Український переклад. • Next sentence. Переклад.».
 */
function parsePairedExamples(cell: string): ParsedExample[] {
  const chunks = cell
    .split(/\s*[•●▪‣]\s*/u)
    .map((part) => part.trim())
    .filter(Boolean);

  return chunks.flatMap((chunk) => {
    const translationAt = chunk.search(/\p{Script=Cyrillic}/u);
    if (translationAt > 0) {
      const en = chunk.slice(0, translationAt).trim();
      const tr = chunk.slice(translationAt).trim();
      return en && tr ? [{ en, tr }] : [];
    }

    const split = splitExampleByLanguage(chunk);
    return split ? [{ en: split[0], tr: split[1] }] : [];
  });
}

/**
 * Шапки нет — раскладываем по содержимому: транскрипция узнаётся по слешам,
 * слово стоит до неё, перевод — после.
 */
function guessColumns(cells: string[]): { word: string; ipa: string; translation: string } {
  const at = cells.findIndex((c) => IPA.test(c));
  if (at > 0) {
    return {
      word: cells.slice(0, at).join(" ").trim(),
      ipa: cells[at],
      translation: cells.slice(at + 1).join(" ").trim(),
    };
  }
  return { word: cells[0] ?? "", ipa: "", translation: cells.slice(1).join(" ").trim() };
}

/**
 * Шапка документа набрана капсом («SPORTS & COMPETITION — СПОРТ І ЗМАГАННЯ»).
 * По этому признаку отличаем её от обычных записей, в которых тоже есть тире.
 */
function isMostlyUpper(s: string): boolean {
  const letters = Array.from(s).filter((c) => /\p{L}/u.test(c));
  if (letters.length < 5) return false;
  const upper = letters.filter(
    (c) => c === c.toUpperCase() && c !== c.toLowerCase(),
  ).length;
  return upper / letters.length > 0.7;
}

function parseVocabulary(raw: string): ParseResult {
  const warnings: string[] = [];
  // У строк таблицы табуляция значима: пустая первая ячейка (колонка с
  // динамиком) держит нумерацию колонок. Поэтому у них срезаем только пробелы.
  const lines = raw
    .split(/\r?\n/)
    .map((l) => (l.includes("\t") ? l.replace(/^ +| +$/g, "") : l.trim()))
    .filter((l) => l.trim());

  let title: string | null = null;
  let description: string | null = null;
  const phrases: ParsedPhrase[] = [];

  let currentSection: string | null = null;
  /** Эмодзи раздела («📖 Nouns») достаётся всем записям этого раздела. */
  let sectionIcon: string | null = null;
  let current: ParsedPhrase | null = null;
  /** Последняя словарная запись: к ней относятся примеры после строки 💡. */
  let lastPhrase: ParsedPhrase | null = null;
  let iconIndex = 0;
  let columns: ColumnMap | null = null;
  let wordExamplesColumns: WordExamplesColumnMap | null = null;
  let vocabularyFormat: VocabularyParserFormat = "standard";

  const flush = () => {
    if (current) {
      phrases.push(current);
      lastPhrase = current;
    }
    current = null;
  };

  // Шапка документа: одна-две строки капсом в самом начале.
  // Эмодзи перед названием в заголовок не тащим.
  let start = 0;
  const head = (i: number) => takeLeadingIcon(lines[i] ?? "").rest.trim();
  if (lines[0] && isMostlyUpper(head(0))) {
    title = head(0);
    start = 1;
    if (lines[1] && isMostlyUpper(head(1))) {
      description = head(1);
      start = 2;
    }
  }

  for (let i = start; i < lines.length; i++) {
    let original = lines[i];

    // ---- строка таблицы ----
    if (original.includes("\t")) {
      const raw = original.split("\t").map((c) => c.trim());
      // В ячейках записи ведущий значок динамика не нужен, а в заголовке
      // раздела эмодзи как раз пригодится — поэтому храним оба варианта.
      const cells = raw.map((c) => takeLeadingIcon(c).rest.trim());
      const filled = cells.filter(Boolean);

      const wordExamplesHeader = detectWordExamplesHeader(cells);
      if (wordExamplesHeader) {
        wordExamplesColumns = wordExamplesHeader;
        columns = null;
        vocabularyFormat = "word-examples-table";
        flush();
        continue;
      }

      const header = detectHeader(cells);
      if (header) {
        columns = header;
        wordExamplesColumns = null;
        flush();
        continue;
      }

      if (wordExamplesColumns && filled.length >= 2) {
        const entry = parseWordExamplesEntry(raw[wordExamplesColumns.word] ?? "");
        if (!entry) {
          warnings.push(
            `Строка ${i + 1}: не удалось разделить слово, транскрипцию и перевод — «${original.slice(0, 60)}»`,
          );
          continue;
        }

        const examples = parsePairedExamples(raw[wordExamplesColumns.examples] ?? "");
        flush();
        const phrase: ParsedPhrase = {
          icon:
            entry.icon ??
            suggestVocabularyIcon(
              entry.phrase,
              entry.translation,
              currentSection,
              examples,
            ) ??
            sectionIcon ??
            ICON_CYCLE[iconIndex++ % ICON_CYCLE.length],
          section: currentSection,
          kind: "PHRASE",
          phrase: entry.phrase,
          transcription: entry.transcription,
          translation: entry.translation,
          examples,
        };
        phrases.push(phrase);
        lastPhrase = phrase;
        if (examples.length === 0) {
          warnings.push(`Строка ${i + 1}: у «${entry.phrase}» не удалось разобрать примеры`);
        }
        continue;
      }

      if (filled.length >= 2) {
        const cell = columns
          ? {
              word: cells[columns.word] ?? "",
              ipa: columns.ipa === null ? "" : cells[columns.ipa] ?? "",
              translation: cells[columns.translation] ?? "",
            }
          : guessColumns(filled);

        if (!cell.word || !cell.translation) {
          warnings.push(`Строка ${i + 1}: пустое слово или перевод — «${original.slice(0, 60)}»`);
          continue;
        }

        flush();
        const phrase: ParsedPhrase = {
          icon:
            suggestVocabularyIcon(cell.word, cell.translation, currentSection) ??
            sectionIcon ??
            ICON_CYCLE[iconIndex++ % ICON_CYCLE.length],
          section: currentSection,
          kind: "PHRASE",
          phrase: cell.word,
          transcription: cell.ipa && IPA.test(cell.ipa) ? cell.ipa : null,
          translation: cell.translation,
          examples: [],
        };
        phrases.push(phrase);
        lastPhrase = phrase;
        continue;
      }

      // Объединённая ячейка — это заголовок раздела, разбираем как обычную строку.
      original = raw.find((c) => takeLeadingIcon(c).rest.trim()) ?? "";
      if (!original) continue;
    }

    const hadBullet = BULLET.test(original);
    const withoutBullet = stripSpeaker(stripBullet(original));
    // В новых словниках статус стоит перед динамиком: «✅ 🔊 Exactly! — Саме так!».
    // Обычный stripSpeaker его не видит, поэтому запоминаем комбинацию до снятия emoji.
    const hasEntrySpeaker = SPEAKER.test(withoutBullet.replace(VERDICT_ICON, ""));
    const { icon, rest } = takeLeadingIcon(withoutBullet);
    const line = rest.trim();
    if (!line) continue;

    const dashParts = splitByDash(line);
    // Значок заметки бывает и украшением заголовка раздела
    // («💡 Adverbs — Прислівники») — заголовок важнее.
    const isDecoratedHeading = !!dashParts && isSectionHeading(dashParts[0], dashParts[1]);

    // Подпись к значку озвучки в шапке документа: только пояснение, не запись.
    if (SPEAKER.test(original) && !/[A-Za-z]/.test(line) && !dashParts) continue;

    // Строки со сравнением «✗ так нельзя / ✓ так можно» — часть пояснения.
    // Проверяем до снятия иконки: галочка сама попадает в её диапазон.
    if (VERDICT_ICON.test(withoutBullet) && !isDecoratedHeading && !hasEntrySpeaker) {
      flush();
      phrases.push({
        icon: "💡",
        section: currentSection,
        kind: "NOTE",
        phrase: withoutBullet.trim(),
        transcription: null,
        translation: "",
        examples: [],
      });
      continue;
    }

    // Заметка: 💡 подсказка, ⚠️ предупреждение, 📌 важное замечание
    if (!isDecoratedHeading && (NOTE_ICONS.includes(icon ?? "") || NOTE_LEAD.test(withoutBullet))) {
      flush();
      const body = line.replace(NOTE_LEAD, "").trim();
      // Первое предложение — заголовок заметки, остальное — пояснение.
      const dot = body.indexOf(".");
      const split = dot > 0 && dot < 60;
      phrases.push({
        icon: icon && NOTE_ICONS.includes(icon) ? icon : "💡",
        section: currentSection,
        kind: "NOTE",
        phrase: (split ? body.slice(0, dot) : body).trim(),
        transcription: null,
        translation: split ? body.slice(dot + 1).trim() : "",
        examples: [],
      });
      continue;
    }

    const parts = dashParts;

    if (!parts) {
      if (looksLikeSection(line)) {
        flush();
        currentSection = line;
        sectionIcon = icon;
        lastPhrase = null;
      } else {
        warnings.push(`Строка ${i + 1}: не удалось разобрать — «${line.slice(0, 60)}»`);
      }
      continue;
    }

    const [left, right] = parts;
    // В примере тире может быть частью самой английской фразы:
    // «We have pizza, pasta — you name it. — У нас є піца…».
    // Поэтому для классификации берём всю английскую половину до первого
    // кириллического фрагмента, а не только текст до первого тире.
    const languagePair = splitExampleByLanguage(line);
    const englishSide = languagePair?.[0] ?? left;

    if (looksLikeExample(englishSide, hadBullet)) {
      const owner = current ?? lastPhrase;
      if (!owner) {
        warnings.push(`Строка ${i + 1}: пример без записи — «${englishSide.slice(0, 50)}»`);
        continue;
      }
      const example = languagePair ?? parts;
      owner.examples.push({ en: example[0], tr: example[1] });
      continue;
    }

    // Заголовок секции, в котором тоже есть тире
    if (!hasEntrySpeaker && isSectionHeading(left, right)) {
      flush();
      currentSection = line;
      sectionIcon = icon;
      lastPhrase = null;
      continue;
    }

    // Новая запись
    flush();
    const ipaMatch = left.match(IPA);
    const transcription = ipaMatch ? ipaMatch[0] : null;
    const phrase = (transcription ? left.replace(transcription, "") : left)
      .replace(/\s{2,}/g, " ")
      .trim();

    // «надягати (дія) → She PUT ON her coat.» — после стрелки идёт пример.
    const arrow = right.search(TO);
    const translation = arrow === -1 ? right : right.slice(0, arrow).trim();
    const inlineExample =
      arrow === -1
        ? null
        : right.slice(arrow + right.match(TO)![0].length).trim();

    const examples = inlineExample ? [{ en: inlineExample, tr: "" }] : [];
    current = {
      icon:
        icon ??
        suggestVocabularyIcon(phrase, translation, currentSection, examples) ??
        sectionIcon ??
        ICON_CYCLE[iconIndex++ % ICON_CYCLE.length],
      section: currentSection,
      kind: "PHRASE",
      phrase,
      transcription,
      translation,
      examples,
    };
    lastPhrase = current;
  }

  flush();

  if (phrases.length === 0) {
    warnings.push(
      "Не найдено ни одной записи. Подойдут строки вида «слово — перевод» " +
        "или таблица с колонками Word / IPA / Translation.",
    );
  }

  return { title, description, phrases, warnings, vocabularyFormat };
}

/** Стрелка как разделитель «было → стало». */
const ARROW = /\s*(?:→|⟶|=>|->)\s*/;

/**
 * Ошибки ученика: «как сказал — как правильно», маркеры под записью — пояснение.
 * Точные правила ещё уточняются, поэтому разбор намеренно простой.
 */
function parseMistakes(raw: string): ParseResult {
  const warnings: string[] = [];
  const lines = raw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  const phrases: ParsedPhrase[] = [];
  let currentSection: string | null = null;
  let current: ParsedPhrase | null = null;

  const flush = () => {
    if (current) phrases.push(current);
    current = null;
  };

  for (let i = 0; i < lines.length; i++) {
    const original = lines[i];
    const hadBullet = BULLET.test(original);
    const { icon, rest } = takeLeadingIcon(stripBullet(original));
    const line = rest.trim();
    if (!line) continue;

    // Стрелка имеет приоритет: она однозначно означает исправление.
    const arrowIdx = line.search(ARROW);
    const parts =
      arrowIdx !== -1
        ? ([
            line.slice(0, arrowIdx).trim(),
            line.slice(arrowIdx + line.match(ARROW)![0].length).trim(),
          ] as [string, string])
        : splitByDash(line);

    if (!parts || !parts[0] || !parts[1]) {
      if (hadBullet && current) {
        current.examples.push({ en: line, tr: "" });
      } else if (looksLikeSection(line)) {
        flush();
        currentSection = line;
      } else {
        warnings.push(`Строка ${i + 1}: не удалось разобрать — «${line.slice(0, 60)}»`);
      }
      continue;
    }

    const [wrong, right] = parts;

    // Маркер списка под записью — это пояснение, а не новая ошибка.
    if (hadBullet && current) {
      current.examples.push({ en: wrong, tr: right });
      continue;
    }

    flush();
    current = {
      icon: icon ?? "❌",
      section: currentSection,
      kind: "PHRASE",
      phrase: wrong,
      transcription: null,
      translation: right,
      examples: [],
    };
  }

  flush();

  if (phrases.length === 0) {
    warnings.push(
      "Не найдено ни одной ошибки. Формат строки: «как сказал → как правильно».",
    );
  }

  return { title: null, description: null, phrases, warnings };
}

/**
 * Разворачивает таблицы из HTML буфера обмена в текст с табуляцией.
 * Обычный текст из таблицы приходит по-разному: где-то колонки разделены
 * табуляцией, где-то просто переносом строки. Из разметки видно наверняка.
 * Работает только в браузере — сервер разбирает уже готовый текст.
 */
export function flattenClipboardHtml(html: string): string | null {
  if (typeof DOMParser === "undefined") return null;

  const doc = new DOMParser().parseFromString(html, "text/html");
  if (!doc.querySelector("table")) return null;

  const clean = (el: Element) => {
    const copy = el.cloneNode(true) as Element;

    // Маркер списка в Google Docs обычно нарисован браузером и не входит в
    // textContent. Добавляем его явно, иначе два примера сольются в один.
    for (const item of Array.from(copy.querySelectorAll("li"))) {
      const text = (item.textContent ?? "").trim();
      if (!/^[•●▪‣·*]/u.test(text)) {
        item.insertBefore(copy.ownerDocument.createTextNode(" • "), item.firstChild);
      }
      item.appendChild(copy.ownerDocument.createTextNode(" "));
    }

    // Соседние абзацы Google Docs могут не иметь пробела между textContent.
    for (const block of Array.from(copy.querySelectorAll("p,div"))) {
      block.appendChild(copy.ownerDocument.createTextNode(" "));
    }
    for (const br of Array.from(copy.querySelectorAll("br"))) {
      br.replaceWith(copy.ownerDocument.createTextNode(" "));
    }

    return (copy.textContent ?? "").replace(/\s+/g, " ").trim();
  };
  const out: string[] = [];

  const walk = (node: Element) => {
    for (const el of Array.from(node.children)) {
      if (el.tagName.toLowerCase() === "table") {
        for (const tr of Array.from(el.querySelectorAll("tr"))) {
          const cells = Array.from(tr.querySelectorAll("th,td")).map(clean);
          if (cells.some(Boolean)) out.push(cells.join("\t"));
        }
        continue;
      }
      if (el.querySelector("table")) {
        walk(el);
        continue;
      }
      const text = clean(el);
      if (text) out.push(text);
    }
  };

  walk(doc.body);
  return out.length ? out.join("\n") : null;
}

export function parseMaterial(raw: string, mode: ParserMode): ParseResult {
  if (!raw.trim()) {
    return { title: null, description: null, phrases: [], warnings: ["Пустой текст."] };
  }
  if (mode === "mistake") return parseMistakes(raw);
  return parseVocabulary(raw);
}
