/**
 * Разбор материалов в ключевом формате.
 *
 * Обычные парсеры угадывают структуру в тексте, скопированном из документа.
 * Здесь текст пишет не человек, а модель по выданной ей спецификации,
 * поэтому формат жёсткий: строка вида «КЛЮЧ: значение», одно поле на
 * строку, английское и перевод через вертикальную черту.
 *
 * Жёсткость — не придирчивость: любое расхождение попадает в warnings,
 * а разбор продолжается. Материал должен открыться даже кривым, иначе
 * учитель останется на уроке ни с чем.
 *
 * Четыре типа:
 *   VOCAB — словник: категории, слова, транскрипции us/uk, примеры, заметки
 *   RULE  — правило: секции, формулы, сравнения, ошибки, бонус
 *   LEXIS — разница между похожими словами
 *   TENSE — время: формулы, маркеры, разобранные примеры
 */
import type { RuleBlock, RuleParseResult } from "./rule-parser";
import type { ParseResult, ParsedPhrase, ParsedExample } from "./materials-parser";

export type KeyedType = "VOCAB" | "RULE" | "LEXIS" | "TENSE";

/** Цвета, которые понимает оформление. Остальное отбрасываем. */
const COLORS = ["green", "amber", "sky", "violet", "rose", "orange", "accent"];

/** Строка формата: ключ заглавными латинскими, двоеточие, значение. */
const FIELD = /^([A-Z][A-Z_]{1,15}):[ \t]*(.*)$/;

type Field = { key: string; value: string; line: number };

/**
 * Первая осмысленная строка должна объявлять тип. Если её нет, текст
 * писали не по спецификации — пусть его разбирают старые парсеры.
 */
export function detectKeyedType(raw: string): KeyedType | null {
  for (const line of String(raw ?? "").split(/\r?\n/)) {
    const text = line.trim();
    if (!text) continue;
    const m = text.match(FIELD);
    if (!m || m[1] !== "TYPE") return null;
    const type = m[2].trim().toUpperCase();
    return type === "VOCAB" || type === "RULE" || type === "LEXIS" || type === "TENSE"
      ? type
      : null;
  }
  return null;
}

/** Разбирает текст на поля и копит замечания о мусоре между ними. */
function readFields(raw: string, warnings: string[]): Field[] {
  const fields: Field[] = [];

  String(raw ?? "")
    .split(/\r?\n/)
    .forEach((line, i) => {
      const text = line.trim();
      if (!text) return;

      const m = text.match(FIELD);
      if (!m) {
        warnings.push(`Строка ${i + 1} вне формата: «${short(text)}»`);
        return;
      }

      const value = m[2].trim();
      if (!value) {
        warnings.push(`Строка ${i + 1}: пустое значение у ${m[1]}`);
        return;
      }

      fields.push({ key: m[1], value, line: i + 1 });
    });

  return fields;
}

function short(text: string, max = 40): string {
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

/** Делит значение по вертикальной черте. */
function parts(value: string): string[] {
  return value.split("|").map((p) => p.trim());
}

/**
 * Значение, разбитое ровно на n частей.
 *
 * Недобор — это потеря смысла, поэтому такую строку не берём: лучше
 * заметка в предупреждениях, чем половина примера без перевода.
 */
function exactly(
  field: Field,
  n: number,
  warnings: string[],
): string[] | null {
  const got = parts(field.value);
  if (got.length !== n || got.some((p) => !p)) {
    warnings.push(
      `Строка ${field.line}: у ${field.key} должно быть ${n} частей через «|», а их ${got.length}`,
    );
    return null;
  }
  return got;
}

function color(value: string, warnings: string[], line: number): string | null {
  const name = value.trim().toLowerCase();
  if (COLORS.includes(name)) return name;
  warnings.push(`Строка ${line}: неизвестный цвет «${short(value, 20)}»`);
  return null;
}

/** Общий разбор шапки: тип, название, цвет. */
type Head = { title: string | null; color: string | null };

export type KeyedVocabResult = ParseResult & { color: string | null };
export type KeyedBlocksResult = RuleParseResult & {
  color: string | null;
  kind: "RULE" | "LEXIS" | "TENSE";
};

export type KeyedResult =
  | ({ type: "VOCAB" } & KeyedVocabResult)
  | ({ type: "RULE" | "LEXIS" | "TENSE" } & KeyedBlocksResult);

/**
 * Разобрать текст в ключевом формате.
 *
 * Возвращает null, если текст этим форматом не объявлен — вызывающий
 * код в этом случае идёт к обычным парсерам.
 */
export function parseKeyed(raw: string): KeyedResult | null {
  const type = detectKeyedType(raw);
  if (!type) return null;

  const warnings: string[] = [];
  const fields = readFields(raw, warnings);

  if (type === "VOCAB") {
    return { type, ...parseVocab(fields, warnings) };
  }
  return { type, ...parseBlocks(type, fields, warnings) };
}

/** Словник в ключевом формате; иначе null — пусть разбирают эвристики. */
export function parseKeyedVocab(raw: string): KeyedVocabResult | null {
  const result = parseKeyed(raw);
  return result?.type === "VOCAB" ? result : null;
}

/** Правило, лексика или время в ключевом формате; иначе null. */
export function parseKeyedBlocks(raw: string): KeyedBlocksResult | null {
  const result = parseKeyed(raw);
  return result && result.type !== "VOCAB" ? result : null;
}

// ---------- VOCAB ----------

function parseVocab(fields: Field[], warnings: string[]): KeyedVocabResult {
  const head: Head = { title: null, color: null };
  const phrases: ParsedPhrase[] = [];

  let section: string | null = null;
  let sectionColor: string | null = null;
  let current: ParsedPhrase | null = null;

  const close = () => {
    if (!current) return;
    if (!current.translation) {
      warnings.push(`«${current.phrase}»: нет перевода (TR)`);
    }
    if (current.examples.length === 0) {
      warnings.push(`«${current.phrase}»: нет ни одного примера (EX)`);
    }
    phrases.push(current);
    current = null;
  };

  for (const field of fields) {
    const { key, value, line } = field;

    switch (key) {
      case "TYPE":
        break;

      case "TITLE":
        head.title = value;
        break;

      case "COLOR":
        // До первой категории цвет относится ко всему словнику.
        if (current) {
          warnings.push(`Строка ${line}: COLOR внутри слова не используется`);
        } else if (section) {
          sectionColor = color(value, warnings, line);
          for (const p of phrases) {
            if (p.section === section) p.sectionColor = sectionColor;
          }
        } else {
          head.color = color(value, warnings, line);
        }
        break;

      case "CATEGORY":
        close();
        section = value;
        sectionColor = null;
        break;

      case "WORD":
        close();
        current = {
          icon: null,
          section,
          sectionColor,
          kind: "PHRASE",
          phrase: value,
          transcription: null,
          transcriptionUs: null,
          transcriptionUk: null,
          translation: "",
          note: null,
          examples: [],
        };
        break;

      case "ICON":
      case "US":
      case "UK":
      case "TR":
      case "EX":
      case "NOTE":
        if (!current) {
          warnings.push(`Строка ${line}: ${key} вне слова — пропущено`);
          break;
        }
        fillWord(current, field, warnings);
        break;

      default:
        warnings.push(`Строка ${line}: ключ ${key} не годится для словника`);
    }
  }
  close();

  if (phrases.length === 0) warnings.push("В словнике не нашлось ни одного слова");

  return {
    title: head.title,
    description: null,
    color: head.color,
    phrases,
    warnings,
  };
}

function fillWord(word: ParsedPhrase, field: Field, warnings: string[]) {
  const { key, value, line } = field;

  if (key === "ICON") {
    word.icon = value.slice(0, 64);
    return;
  }
  if (key === "US") {
    word.transcriptionUs = value;
    word.transcription ??= value;
    return;
  }
  if (key === "UK") {
    word.transcriptionUk = value;
    word.transcription ??= value;
    return;
  }
  if (key === "TR") {
    word.translation = value;
    return;
  }
  if (key === "NOTE") {
    // Заметок бывает две — держим их одной подсказкой.
    word.note = word.note ? `${word.note}\n${value}` : value;
    return;
  }

  const ex = exactly(field, 2, warnings);
  if (!ex) return;
  if (word.examples.length >= 2) {
    warnings.push(`Строка ${line}: у «${word.phrase}» больше двух примеров`);
  }
  word.examples.push({ en: ex[0], tr: ex[1] } satisfies ParsedExample);
}

// ---------- RULE / LEXIS / TENSE ----------

/**
 * Разбор всего, что ложится в блоки.
 *
 * Три формата отличаются набором ключей, но живут в одном хранилище и
 * показываются одной читалкой: у правила есть секции, у времени —
 * маркеры, у лексики — карточки слов, а оформление общее.
 */
function parseBlocks(
  kind: "RULE" | "LEXIS" | "TENSE",
  fields: Field[],
  warnings: string[],
): KeyedBlocksResult {
  const head: Head = { title: null, color: null };
  let subtitle: string | null = null;
  const blocks: RuleBlock[] = [];

  /** Открытая карточка слова в лексике. */
  let item: Extract<RuleBlock, { type: "word" }> | null = null;
  /** Копим подряд идущие сравнения в одну таблицу. */
  let compare: string[][] = [];

  const closeItem = () => {
    if (!item) return;
    if (item.examples.length === 0) {
      warnings.push(`«${item.word}»: нет ни одного примера (EX)`);
    }
    blocks.push(item);
    item = null;
  };

  const closeCompare = () => {
    if (compare.length === 0) return;
    blocks.push({
      type: "table",
      headers: [compare[0][0], compare[0][1]],
      rows: compare.map((row) => [row[2], row[3]]),
      variant: "sheet-table",
    });
    compare = [];
  };

  const flush = () => {
    closeItem();
    closeCompare();
  };

  for (const field of fields) {
    const { key, value, line } = field;

    // Ключи карточки слова разбираем до общего списка: внутри ITEM они
    // значат не то же самое, что снаружи.
    if (item && (key === "ICON" || key === "US" || key === "UK" || key === "TR" ||
                 key === "SENSE" || key === "PATTERN")) {
      if (key === "ICON") item.icon = value.slice(0, 64);
      if (key === "US") item.us = value;
      if (key === "UK") item.uk = value;
      if (key === "TR") item.tr = value;
      if (key === "SENSE") item.sense = value;
      if (key === "PATTERN") item.pattern = value;
      continue;
    }

    switch (key) {
      case "TYPE":
        break;

      case "TITLE":
        head.title = value;
        break;

      case "COLOR":
        head.color = color(value, warnings, line);
        break;

      case "INTRO":
        subtitle = subtitle ? `${subtitle} ${value}` : value;
        break;

      case "SECTION":
        flush();
        blocks.push({ type: "heading", text: value, variant: "sheet-section" });
        break;

      case "TEXT":
      case "WHY":
        closeCompare();
        blocks.push({ type: "text", text: value, variant: "sheet-text" });
        break;

      case "ANALOG":
        closeCompare();
        blocks.push({
          type: "callout",
          tone: "key",
          label: "По-нашему",
          text: value,
          variant: "sheet-lead",
        });
        break;

      case "FORMULA":
        closeCompare();
        blocks.push({ type: "formula", text: value, variant: "sheet-formula" });
        break;

      case "ITEM":
        flush();
        item = {
          type: "word",
          word: value,
          examples: [],
          notes: [],
        };
        break;

      case "EX": {
        closeCompare();
        // У времени третья часть — разбор примера, у остальных её нет.
        const got = parts(field.value);
        if (got.length < 2 || !got[0] || !got[1]) {
          warnings.push(`Строка ${line}: примеру нужен перевод после «|»`);
          break;
        }
        const example = { en: got[0], tr: got[1] };
        if (item) {
          item.examples.push(example);
        } else {
          blocks.push({
            type: "example",
            ...example,
            why: got[2] || undefined,
          });
        }
        break;
      }

      case "NOTE":
        if (item) {
          item.notes.push(value);
          break;
        }
        closeCompare();
        blocks.push({
          type: "callout",
          tone: "tip",
          text: value,
          hint: true,
          variant: "sheet-text",
        });
        break;

      case "TRAP": {
        closeCompare();
        const got = parts(field.value);
        blocks.push({
          type: "callout",
          tone: "warn",
          text: got[0],
          label: got[1] || undefined,
          variant: "sheet-mistake",
        });
        break;
      }

      case "BONUS":
        closeCompare();
        blocks.push({
          type: "callout",
          tone: "info",
          label: "Интересно знать",
          text: value,
          hint: true,
          variant: "sheet-text",
        });
        break;

      case "COMPARE":
      case "CONTRAST": {
        closeItem();
        const got = exactly(field, 4, warnings);
        if (got) compare.push(got);
        break;
      }

      case "FORM": {
        closeCompare();
        const got = exactly(field, 4, warnings);
        if (!got) break;
        const sign = got[0];
        if (sign !== "+" && sign !== "-" && sign !== "?") {
          warnings.push(`Строка ${line}: у FORM знак должен быть +, - или ?`);
          break;
        }
        blocks.push({
          type: "form",
          sign,
          formula: got[1],
          en: got[2],
          tr: got[3],
        });
        break;
      }

      case "MARKER": {
        closeCompare();
        const got = exactly(field, 5, warnings);
        if (!got) break;
        blocks.push({
          type: "marker",
          word: got[0],
          tr: got[1],
          en: got[2],
          ru: got[3],
          hintText: got[4],
        });
        break;
      }

      case "SENSE":
      case "PATTERN":
      case "ICON":
      case "US":
      case "UK":
      case "TR":
        warnings.push(`Строка ${line}: ${key} встречается только внутри ITEM`);
        break;

      default:
        warnings.push(`Строка ${line}: ключ ${key} не годится для этого типа`);
    }
  }
  flush();

  if (blocks.length === 0) warnings.push("В материале не нашлось содержимого");
  if (kind === "LEXIS" && !blocks.some((b) => b.type === "word")) {
    warnings.push("В лексике не нашлось ни одного слова (ITEM)");
  }
  if (kind === "TENSE" && !blocks.some((b) => b.type === "form")) {
    warnings.push("У времени нет разбора построения (FORM)");
  }

  return {
    kind,
    title: head.title,
    subtitle,
    color: head.color,
    blocks,
    warnings,
    format: "keyed",
  };
}
