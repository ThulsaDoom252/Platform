/**
 * Разбор готовой структуры папок и файлов из того, что вставили.
 *
 * Годится и для вставки из Google Docs (заголовки, списки, отступы),
 * и для текста, распознанного со скриншота. На выходе — дерево, которое
 * сначала показывается на проверку и только потом заводится в базе.
 *
 * Уровень вложенности берём в таком порядке:
 *   1. есть заголовки H1…H6 — значит документ уже размечен, берём их;
 *   2. заголовков нет, но есть маркированные списки — берём вложенность
 *      списков;
 *   3. остальное — по отступам в обычном тексте.
 *
 * Папка или файл: со стрелкой (▸) — точно папка, с детьми — папка,
 * лист без детей — файл. Всё это правится руками перед созданием.
 */
import { suggestIcon } from "@/lib/icon-suggest";

export type ImportKind = "FOLDER" | "FILE";

export type ImportNode = {
  name: string;
  icon: string | null;
  kind: ImportKind;
  children: ImportNode[];
};

/** Строка до сборки в дерево. */
type Row = { text: string; depth: number; folder: boolean };

/**
 * Один значок целиком: сам символ плюс хвост из селекторов начертания,
 * тона кожи и склеек ZWJ. Без этого 👮‍♂️ разваливается на половинки,
 * а флаг 🇬🇧 — на две буквы.
 */
const ONE_EMOJI = new RegExp(
  "^(?:" +
    "\\p{Regional_Indicator}{2}" +
    "|\\p{Extended_Pictographic}(?:\\uFE0F|\\uFE0E|\\p{Emoji_Modifier})*" +
    "(?:\\u200D\\p{Extended_Pictographic}(?:\\uFE0F|\\p{Emoji_Modifier})*)*" +
    ")",
  "u",
);

/** Подряд идущие значки в начале строки. */
const LEAD_EMOJI = new RegExp(`^(?:${ONE_EMOJI.source.slice(1)}\\s*)+`, "u");

/** Треугольник-раскрывашка слева от названия — признак папки. */
const ARROW = /^[▶▸►▹▾▼▿⯈➤⏵]️?\s*/u;

/** Маркер списка или нумерация. */
const BULLET = /^(?:[-–—•◦▪▫‣·∙‧*+]|\d+[.)]|[a-zа-яіїєA-ZА-ЯІЇЄ][.)])\s+/u;

/** Первый значок строки целиком — или null, если строка начинается не с него. */
export function firstEmoji(raw: string): string | null {
  return raw.match(ONE_EMOJI)?.[0] ?? null;
}

/** Отделяет ведущий значок от названия. */
export function splitIcon(raw: string): { icon: string | null; name: string } {
  const m = raw.match(LEAD_EMOJI);
  if (!m) return { icon: null, name: raw.trim() };
  // Значок берём один — первый: «📚📖 Слова» должно дать 📚 и «Слова».
  return { icon: firstEmoji(m[0]), name: raw.slice(m[0].length).trim() };
}

/** Снимает стрелку и маркер списка, попутно отмечая папку. */
function stripMarkers(line: string): { text: string; folder: boolean } {
  let text = line.trim();
  let folder = false;

  // Стрелка бывает и до маркера, и после — снимаем, пока снимается.
  for (let i = 0; i < 3; i++) {
    if (ARROW.test(text)) {
      text = text.replace(ARROW, "");
      folder = true;
      continue;
    }
    if (BULLET.test(text)) {
      text = text.replace(BULLET, "");
      continue;
    }
    break;
  }

  // Косая черта в конце — тоже «это папка», как в путях.
  if (text.endsWith("/") || text.endsWith("\\")) {
    text = text.slice(0, -1).trim();
    folder = true;
  }

  return { text, folder };
}

/** Ширина отступа в начале строки. Табуляция считается за четыре пробела. */
function indentOf(line: string): number {
  const m = line.match(/^[ \t ]*/);
  if (!m) return 0;
  let n = 0;
  for (const ch of m[0]) n += ch === "\t" ? 4 : 1;
  return n;
}

/** Строки из обычного текста — уровень по отступу. */
function rowsFromText(text: string): Row[] {
  const rows: Row[] = [];

  for (const line of text.split(/\r?\n/)) {
    if (!line.trim()) continue;
    const depth = indentOf(line);
    const { text: clean, folder } = stripMarkers(line);
    if (!clean) continue;
    rows.push({ text: clean, depth, folder });
  }

  return rows;
}

/** Отступ абзаца в вставленном HTML: Google Docs пишет его в margin-left. */
function styleIndent(el: Element): number {
  const style = el.getAttribute("style") ?? "";
  const m = style.match(/margin-left:\s*(-?[\d.]+)\s*(pt|px|in|cm)/i);
  if (!m) return 0;

  const value = Number(m[1]);
  if (!Number.isFinite(value) || value <= 0) return 0;

  const unit = m[2].toLowerCase();
  const pt = unit === "pt" ? value : unit === "px" ? value * 0.75 : unit === "in" ? value * 72 : value * 28.35;
  // Один шаг отступа в Docs — 36pt (полдюйма).
  return Math.round(pt / 36);
}

/**
 * Строки из вставленного HTML.
 * Возвращает null, если разобрать нечего — тогда работаем по тексту.
 */
function rowsFromHtml(html: string): Row[] | null {
  if (typeof DOMParser === "undefined") return null;

  const doc = new DOMParser().parseFromString(html, "text/html");
  const body = doc.body;
  if (!body) return null;

  const headings = [...body.querySelectorAll("h1,h2,h3,h4,h5,h6")];
  const items = [...body.querySelectorAll("li")];

  // 1. Документ размечен заголовками — этого достаточно, тело не трогаем.
  if (headings.length >= 2) {
    const rows: Row[] = [];
    for (const h of headings) {
      const { text, folder } = stripMarkers(h.textContent ?? "");
      if (!text) continue;
      rows.push({ text, depth: Number(h.tagName[1]) - 1, folder });
    }
    return rows.length >= 2 ? rows : null;
  }

  // 2. Заголовков нет — берём вложенность списков.
  if (items.length >= 2) {
    const rows: Row[] = [];
    for (const li of items) {
      // Текст самого пункта, без вложенных списков внутри него.
      const own = [...li.childNodes]
        .filter((n) => !(n.nodeType === 1 && /^(UL|OL)$/.test((n as Element).tagName)))
        .map((n) => n.textContent ?? "")
        .join("");

      const { text, folder } = stripMarkers(own);
      if (!text) continue;

      let depth = 0;
      for (let p = li.parentElement; p; p = p.parentElement) {
        if (/^(UL|OL)$/.test(p.tagName)) depth++;
      }
      rows.push({ text, depth: Math.max(0, depth - 1), folder });
    }
    return rows.length >= 2 ? rows : null;
  }

  // 3. Ни того, ни другого — может, отступы проставлены абзацам.
  const paras = [...body.querySelectorAll("p,div")].filter(
    (el) => !el.querySelector("p,div") && (el.textContent ?? "").trim(),
  );
  if (paras.length >= 2 && paras.some((el) => styleIndent(el) > 0)) {
    const rows: Row[] = [];
    for (const el of paras) {
      const { text, folder } = stripMarkers(el.textContent ?? "");
      if (!text) continue;
      rows.push({ text, depth: styleIndent(el), folder });
    }
    return rows.length >= 2 ? rows : null;
  }

  return null;
}

/** Собирает плоские строки в дерево по их уровням. */
function buildTree(rows: Row[]): ImportNode[] {
  const roots: ImportNode[] = [];
  const stack: { depth: number; node: ImportNode }[] = [];

  for (const row of rows) {
    const { icon, name } = splitIcon(row.text);
    if (!name) continue;

    const node: ImportNode = {
      name,
      icon: icon ?? suggestIcon(name),
      // Пока лист — файл; ниже перевернём, если у него появятся дети.
      kind: row.folder ? "FOLDER" : "FILE",
      children: [],
    };

    while (stack.length && stack[stack.length - 1].depth >= row.depth) stack.pop();

    const parent = stack[stack.length - 1]?.node;
    if (parent) {
      parent.children.push(node);
      parent.kind = "FOLDER";
    } else {
      roots.push(node);
    }

    stack.push({ depth: row.depth, node });
  }

  return roots;
}

export type ParsedTree = {
  nodes: ImportNode[];
  /** Сколько всего узлов — чтобы показать «распознано N». */
  count: number;
  /** Все на одном уровне: вложенность не считалась, стоит предупредить. */
  flat: boolean;
};

/**
 * Разбирает вставленное. HTML точнее (в нём есть заголовки и отступы),
 * поэтому его пробуем первым, а текст держим про запас.
 */
export function parseTree(input: { html?: string | null; text?: string | null }): ParsedTree {
  const rows =
    (input.html ? rowsFromHtml(input.html) : null) ??
    rowsFromText(input.text ?? "");

  const nodes = buildTree(rows);
  return {
    nodes,
    count: countNodes(nodes),
    flat: nodes.length > 1 && nodes.every((n) => n.children.length === 0),
  };
}

export function countNodes(nodes: ImportNode[]): number {
  return nodes.reduce((sum, n) => sum + 1 + countNodes(n.children), 0);
}
