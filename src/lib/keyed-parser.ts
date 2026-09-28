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

/**
 * Знак формы: утверждение, отрицание или вопрос.
 *
 * Модель пишет его по-разному — плюсом, длинным тире, галочкой, словом.
 * Отбрасывать из-за этого целую строку нельзя: без построения время
 * бесполезно. Поэтому непонятный знак выводим из самого предложения —
 * вопрос виден по знаку в конце, отрицание по not и его сокращениям.
 */
function formSign(
  raw: string,
  en: string,
): { sign: "+" | "-" | "?"; guessed: boolean } {
  const token = raw.trim().toLowerCase();

  if (/^[+➕✅]|^(plus|affirmative|утвержд|стверд|позитив)/u.test(token)) {
    return { sign: "+", guessed: false };
  }
  if (/^[-–—−➖❌]|^(minus|negative|отриц|запереч)/u.test(token)) {
    return { sign: "-", guessed: false };
  }
  if (/^[?？❓]|^(question|вопрос|питаль|запит)/u.test(token)) {
    return { sign: "?", guessed: false };
  }

  const sentence = en.trim();
  if (sentence.endsWith("?")) return { sign: "?", guessed: true };
  // Сокращения вроде doesn't границей слова не ловятся: апостроф стоит
  // внутри слова, поэтому ищем саму частицу.
  if (/(n['’]t\b|\bnot\b|\bnever\b|\bno\b)/i.test(sentence)) {
    return { sign: "-", guessed: true };
  }
  return { sign: "+", guessed: true };
}

/**
 * Та же ссылка, но на нужном языке.
 *
 * Справочники обычно различают язык куском пути или поддоменом. Если
 * узнаём такой кусок — подменяем, не узнаём — отдаём как есть: лучше
 * открыть чужой язык, чем никуда.
 */
function localized(url: string, lang: "ru" | "uk"): string {
  const other = lang === "ru" ? "uk" : "ru";
  return url
    .replace(new RegExp(`/${other}/`, "i"), `/${lang}/`)
    .replace(new RegExp(`([?&](?:lang|locale)=)${other}(?![a-z])`, "i"), `$1${lang}`)
    .replace(new RegExp(`^(https?://)${other}[.]`, "i"), `$1${lang}.`);
}

/** Общий разбор шапки: тип и название. */
type Head = { title: string | null };

export type KeyedVocabResult = ParseResult;
export type KeyedBlocksResult = RuleParseResult & {
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
  const head: Head = { title: null };
  const phrases: ParsedPhrase[] = [];

  let section: string | null = null;
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
        // Цвет задаёт тема платформы, а не материал: тем может стать
        // больше, и зашитый в текст цвет однажды выпадет из оформления.
        warnings.push(`Строка ${line}: COLOR не нужен — цвет берётся из темы`);
        break;

      case "CATEGORY":
        close();
        section = value;
        break;

      case "WORD":
        close();
        current = {
          icon: null,
          section,
          kind: "PHRASE",
          phrase: value,
          transcription: null,
          transcriptionUs: null,
          transcriptionUk: null,
          translation: "",
          note: null,
          description: null,
          imageSource: null,
          examples: [],
        };
        break;

      case "ICON":
      case "US":
      case "UK":
      case "TR":
      case "DEF":
      case "IMG":
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
  if (key === "DEF") {
    // Описание нужно игре, а не читалке, поэтому длину держим короткой:
    // на карточке оно должно читаться целиком с одного взгляда.
    word.description = value.slice(0, 200);
    return;
  }
  if (key === "IMG") {
    if (!/^https?:\/\//i.test(value)) {
      warnings.push(`Строка ${line}: IMG у «${word.phrase}» — не ссылка, пропущено`);
      return;
    }
    word.imageSource = value;
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
  const head: Head = { title: null };
  let subtitle: string | null = null;
  const blocks: RuleBlock[] = [];

  /** Открытая карточка слова в лексике. */
  let item: Extract<RuleBlock, { type: "word" }> | null = null;
  /** Копим подряд идущие сравнения в одну таблицу. */
  let compare: string[][] = [];
  /** Открытая сетка подстановки. */
  let grid: Extract<RuleBlock, { type: "grid" }> | null = null;
  /** Ссылка на подробный разбор — всегда последней. */
  let link: Extract<RuleBlock, { type: "link" }> | null = null;

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
    });
    compare = [];
  };

  const closeGrid = () => {
    if (!grid) return;
    if (grid.rows.length > 0) blocks.push(grid);
    else warnings.push(`Сетка «${grid.title ?? "без названия"}» осталась пустой`);
    grid = null;
  };

  const flush = () => {
    closeItem();
    closeCompare();
    closeGrid();
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
        warnings.push(`Строка ${line}: COLOR не нужен — цвет берётся из темы`);
        break;

      case "INTRO":
        subtitle = subtitle ? `${subtitle} ${value}` : value;
        break;

      case "SECTION":
        flush();
        blocks.push({ type: "heading", text: value });
        break;

      case "TEXT":
      case "WHY":
        flush();
        blocks.push({ type: "text", text: value });
        break;

      case "GRID":
        flush();
        grid = { type: "grid", title: value, headers: [], rows: [] };
        break;

      case "HEAD":
        if (!grid) {
          warnings.push(`Строка ${line}: HEAD вне сетки (GRID) — пропущено`);
          break;
        }
        grid.headers = parts(value);
        break;

      case "ROW":
        if (!grid) {
          warnings.push(`Строка ${line}: ROW вне сетки (GRID) — пропущено`);
          break;
        }
        grid.rows.push(parts(value));
        break;

      case "LINK": {
        const got = parts(value);
        // Одна ссылка или сразу две: русская и украинская.
        const ru = got[0] ?? "";
        const uk = got[1] ?? "";
        if (!ru.toLowerCase().startsWith("http")) {
          warnings.push(`Строка ${line}: LINK должен начинаться с http`);
          break;
        }
        link = {
          type: "link",
          label: "Подробный разбор",
          ru,
          uk: uk || localized(ru, "uk"),
        };
        if (!uk) link.ru = localized(ru, "ru");
        break;
      }

      case "FORMULA":
        closeCompare();
        blocks.push({ type: "formula", text: value });
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
            ...(got[2] ? { why: got[2] } : {}),
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
        });
        break;

      case "TRAP": {
        closeCompare();
        const got = parts(field.value);
        blocks.push({
          type: "callout",
          tone: "warn",
          text: got[0],
          ...(got[1] ? { label: got[1] } : {}),
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
        const { sign, guessed } = formSign(got[0], got[2]);
        if (guessed) {
          warnings.push(
            `Строка ${line}: непонятный знак «${short(got[0], 12)}» у FORM — взяли «${sign}» по самому предложению`,
          );
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
  if (link) blocks.push(link);

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
    blocks,
    warnings,
    format: "keyed",
  };
}
