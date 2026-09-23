/**
 * Парсер учебного текста из Google Docs в структуру фраз.
 *
 * Формат документа неоднозначен: и термин, и пример разделены одним и тем же
 * тире. Поэтому строки различаются эвристиками (маркер списка, транскрипция,
 * конечная пунктуация). Результат обязательно показывается на предпросмотре.
 */

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
};

export type ParserMode = "vocabulary" | "rule" | "mistake";

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
};

type ColumnMap = { word: number; ipa: number | null; translation: number };

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
  let iconIndex = 0;
  let columns: ColumnMap | null = null;

  const flush = () => {
    if (current) phrases.push(current);
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

      const header = detectHeader(cells);
      if (header) {
        columns = header;
        flush();
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
        phrases.push({
          icon: sectionIcon ?? ICON_CYCLE[iconIndex++ % ICON_CYCLE.length],
          section: currentSection,
          kind: "PHRASE",
          phrase: cell.word,
          transcription: cell.ipa && IPA.test(cell.ipa) ? cell.ipa : null,
          translation: cell.translation,
          examples: [],
        });
        continue;
      }

      // Объединённая ячейка — это заголовок раздела, разбираем как обычную строку.
      original = raw.find((c) => takeLeadingIcon(c).rest.trim()) ?? "";
      if (!original) continue;
    }

    const hadBullet = BULLET.test(original);
    const withoutBullet = stripSpeaker(stripBullet(original));
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
    if (/^\s*[✗✘❌✓✔✅]/u.test(withoutBullet)) {
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
      } else {
        warnings.push(`Строка ${i + 1}: не удалось разобрать — «${line.slice(0, 60)}»`);
      }
      continue;
    }

    const [left, right] = parts;

    if (looksLikeExample(left, hadBullet)) {
      if (!current) {
        warnings.push(`Строка ${i + 1}: пример без записи — «${left.slice(0, 50)}»`);
        continue;
      }
      current.examples.push({ en: left, tr: right });
      continue;
    }

    // Заголовок секции, в котором тоже есть тире
    if (isSectionHeading(left, right)) {
      flush();
      currentSection = line;
      sectionIcon = icon;
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

    current = {
      icon: icon ?? sectionIcon ?? ICON_CYCLE[iconIndex++ % ICON_CYCLE.length],
      section: currentSection,
      kind: "PHRASE",
      phrase,
      transcription,
      translation,
      examples: inlineExample ? [{ en: inlineExample, tr: "" }] : [],
    };
  }

  flush();

  if (phrases.length === 0) {
    warnings.push(
      "Не найдено ни одной записи. Подойдут строки вида «слово — перевод» " +
        "или таблица с колонками Word / IPA / Translation.",
    );
  }

  return { title, description, phrases, warnings };
}

/**
 * Правило: блоки, разделённые пустой строкой.
 * Первая строка блока — название, дальше пояснение, строки-маркеры — примеры.
 */
function parseRule(raw: string): ParseResult {
  const warnings: string[] = [];
  const blocks = raw
    .split(/\r?\n\s*\r?\n/)
    .map((b) => b.trim())
    .filter(Boolean);

  let title: string | null = null;
  let description: string | null = null;
  const phrases: ParsedPhrase[] = [];
  let iconIndex = 0;

  blocks.forEach((block, bi) => {
    const lines = block
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    if (lines.length === 0) return;

    // Первый блок без маркеров и из 1–2 строк считаем шапкой страницы.
    if (bi === 0 && lines.length <= 2 && !lines.some((l) => BULLET.test(l))) {
      title = lines[0];
      description = lines[1] ?? null;
      return;
    }

    const head = takeLeadingIcon(stripBullet(lines[0]));
    const name = head.rest.trim();
    const explanation: string[] = [];
    const examples: ParsedExample[] = [];

    for (const line of lines.slice(1)) {
      const isBullet = BULLET.test(line);
      const text = takeLeadingIcon(stripBullet(line)).rest.trim();
      if (!text) continue;
      const parts = splitByDash(text);
      if (isBullet && parts) examples.push({ en: parts[0], tr: parts[1] });
      else if (isBullet) examples.push({ en: text, tr: "" });
      else explanation.push(text);
    }

    if (!name) {
      warnings.push(`Блок ${bi + 1}: не найдено название правила.`);
      return;
    }

    phrases.push({
      icon: head.icon ?? ICON_CYCLE[iconIndex++ % ICON_CYCLE.length],
      section: null,
      kind: "PHRASE",
      phrase: name,
      transcription: null,
      translation: explanation.join(" ") || "",
      examples,
    });
  });

  if (phrases.length === 0) {
    warnings.push("Не найдено ни одного правила. Раздели блоки пустой строкой.");
  }

  return { title, description, phrases, warnings };
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

  const clean = (el: Element) => (el.textContent ?? "").replace(/\s+/g, " ").trim();
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
  if (mode === "rule") return parseRule(raw);
  if (mode === "mistake") return parseMistakes(raw);
  return parseVocabulary(raw);
}
