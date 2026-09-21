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

export type ParserMode = "vocabulary" | "rule";

/** Тире, которыми в документе разделены термин и перевод. */
const DASH = /\s+[—–]\s+|\s+-{1,2}\s+/;

/** Маркеры списка в начале строки. */
const BULLET = /^\s*[•●▪‣·*\-–]\s+/;

/** Ведущие эмодзи и значок динамика, которые копируются вместе с текстом. */
const LEADING_ICONS =
  /^\s*(?:[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{200D}\u{20E3}]+\s*)+/u;

const IPA = /\/[^/]{1,60}\//;

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
  const lines = raw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  let title: string | null = null;
  let description: string | null = null;
  const phrases: ParsedPhrase[] = [];

  let currentSection: string | null = null;
  let current: ParsedPhrase | null = null;
  let iconIndex = 0;

  const flush = () => {
    if (current) phrases.push(current);
    current = null;
  };

  // Шапка документа: одна-две строки капсом в самом начале.
  let start = 0;
  if (lines[0] && isMostlyUpper(lines[0])) {
    title = lines[0];
    start = 1;
    if (lines[1] && isMostlyUpper(lines[1])) {
      description = lines[1];
      start = 2;
    }
  }

  for (let i = start; i < lines.length; i++) {
    const original = lines[i];
    const hadBullet = BULLET.test(original);
    const withoutBullet = stripBullet(original);
    const { icon, rest } = takeLeadingIcon(withoutBullet);
    const line = rest.trim();
    if (!line) continue;

    // Заметка 💡
    if (icon === "💡" || /^💡/.test(withoutBullet)) {
      flush();
      const body = line.replace(/^💡\s*/, "");
      const dot = body.indexOf(".");
      const head = dot > 0 && dot < 60 ? body.slice(0, dot) : body.slice(0, 60);
      phrases.push({
        icon: "💡",
        section: currentSection,
        kind: "NOTE",
        phrase: head.trim(),
        transcription: null,
        translation: dot > 0 && dot < 60 ? body.slice(dot + 1).trim() : body,
        examples: [],
      });
      continue;
    }

    const parts = splitByDash(line);

    if (!parts) {
      if (looksLikeSection(line)) {
        flush();
        currentSection = line;
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
      continue;
    }

    // Новая запись
    flush();
    const ipaMatch = left.match(IPA);
    const transcription = ipaMatch ? ipaMatch[0] : null;
    const phrase = (transcription ? left.replace(transcription, "") : left)
      .replace(/\s{2,}/g, " ")
      .trim();

    current = {
      icon: icon ?? ICON_CYCLE[iconIndex++ % ICON_CYCLE.length],
      section: currentSection,
      kind: "PHRASE",
      phrase,
      transcription,
      translation: right,
      examples: [],
    };
  }

  flush();

  if (phrases.length === 0) {
    warnings.push("Не найдено ни одной записи. Проверь, что строки вида «слово — перевод».");
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

export function parseMaterial(raw: string, mode: ParserMode): ParseResult {
  if (!raw.trim()) {
    return { title: null, description: null, phrases: [], warnings: ["Пустой текст."] };
  }
  return mode === "rule" ? parseRule(raw) : parseVocabulary(raw);
}
