/**
 * Разбор правила в блоки документа.
 *
 * Правила в Google Docs — это не список фраз, а вёрстка: заголовки, цветные
 * врезки, формулы и таблицы на 2–4 колонки. Поэтому при вставке читаем HTML
 * из буфера обмена: там таблицы приходят настоящими <table>, и угадывать
 * структуру по отступам не нужно. Для случая «вставили просто текст»
 * оставлен запасной разбор по табуляциям.
 */

export type RuleBlock =
  | { type: "heading"; text: string }
  | { type: "callout"; label?: string; text: string; tone?: "key" | "warn" | "tip" | "info" }
  | { type: "formula"; text: string }
  | { type: "text"; text: string }
  | { type: "example"; en: string; tr?: string }
  | { type: "list"; items: string[] }
  | { type: "table"; headers: string[]; rows: string[][] };

export type RuleParseResult = {
  title: string | null;
  subtitle: string | null;
  blocks: RuleBlock[];
  warnings: string[];
};

const DASH = /\s+[—–]\s+/;

/** Метки врезок, встречающиеся в документах. */
const CALLOUT_LABELS: { re: RegExp; tone: "key" | "warn" | "tip" | "info" }[] = [
  { re: /^(важливо|увага|важно|внимание)\b/i, tone: "warn" },
  {
    re: /^(просто запам'?ятай|шпаргалка|порада|підказка|запам'?ятай|швидка перевірка)\b/i,
    tone: "tip",
  },
  {
    re: /^(головне|головна ідея|найпростіше|ключове|коли використовуємо)\b/i,
    tone: "key",
  },
  { re: /^(примітка|зверни увагу|нотатка)\b/i, tone: "info" },
];

function cleanText(s: string): string {
  return s
    .replace(/ /g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function hasLatin(s: string) {
  return /[A-Za-z]/.test(s);
}
function hasCyrillic(s: string) {
  return /[Ѐ-ӿ]/.test(s);
}

function isMostlyUpper(s: string): boolean {
  const letters = Array.from(s).filter((c) => /\p{L}/u.test(c));
  if (letters.length < 3) return false;
  const upper = letters.filter(
    (c) => c === c.toUpperCase() && c !== c.toLowerCase(),
  ).length;
  return upper / letters.length > 0.7;
}

/** «S + WORK + ON», «IF + Present Simple → WILL + V1», «WORK ON + V-ing». */
function looksLikeFormula(s: string): boolean {
  if (s.length > 90) return false;
  // «1. ОДИН ПРЕДМЕТ → IT» — это номер раздела, а не формула,
  // хотя стрелка внутри и есть.
  if (/^\d+[.)]\s/.test(s)) return false;
  const signs = (s.match(/[+→⟶≈]/g) ?? []).length;
  if (signs === 0) return false;
  // В формуле мало слов и нет конечной точки.
  return !/[.!?]$/.test(s) && s.split(/\s+/).length <= 16;
}

function looksLikeHeading(s: string): boolean {
  if (s.length > 70) return false;
  // Вопрос может быть заголовком («IT чи THEY?», «3. IF ЧИ WHEN?»),
  // а вот точка в конце — почти всегда обычное предложение.
  if (/[.!]$/.test(s)) return false;
  if (DASH.test(s)) return false;
  return /^\d+[.)]\s/.test(s) || isMostlyUpper(s) || s.split(/\s+/).length <= 6;
}

/** Строка вида «English sentence. — Український переклад.» */
function splitExample(s: string): { en: string; tr: string } | null {
  const m = s.split(DASH);
  if (m.length < 2) return null;
  const en = cleanText(m[0]);
  const tr = cleanText(m.slice(1).join(" — "));
  if (!en || !tr) return null;
  if (!hasLatin(en)) return null;
  if (!hasCyrillic(tr)) return null;
  return { en, tr };
}

function detectCallout(s: string): RuleBlock | null {
  // «ВАЖЛИВО: текст» или «Примітка: текст»
  const colon = s.indexOf(":");
  const head = colon > 0 && colon < 40 ? s.slice(0, colon) : "";
  const stripped = head.replace(/^[^\p{L}]+/u, "");

  for (const { re, tone } of CALLOUT_LABELS) {
    if (re.test(stripped)) {
      return { type: "callout", label: cleanText(head), text: cleanText(s.slice(colon + 1)), tone };
    }
    // Метка без двоеточия — «Коли використовуємо? ...»
    if (!colon && re.test(s.replace(/^[^\p{L}]+/u, ""))) {
      return { type: "callout", text: cleanText(s), tone };
    }
  }
  if (/^[⚠️🚨❗]/.test(s)) {
    return { type: "callout", text: cleanText(s), tone: "warn" };
  }
  if (/^[💡⭐🌟]/.test(s)) {
    return { type: "callout", text: cleanText(s), tone: "tip" };
  }
  return null;
}

/** Превращает произвольную строку в блок. */
function lineToBlock(raw: string): RuleBlock | null {
  const s = cleanText(raw);
  if (!s) return null;

  const callout = detectCallout(s);
  if (callout) return callout;

  if (looksLikeFormula(s)) return { type: "formula", text: s };

  const ex = splitExample(s);
  if (ex) return { type: "example", en: ex.en, tr: ex.tr };

  if (looksLikeHeading(s)) return { type: "heading", text: s };

  return { type: "text", text: s };
}

// ---------------------------------------------------------------- HTML

/**
 * Снимает с начала первый заголовок как название правила,
 * а следующий короткий абзац — как подзаголовок.
 */
function extractTitle(blocks: RuleBlock[]): { title: string | null; subtitle: string | null } {
  let title: string | null = null;
  let subtitle: string | null = null;

  const first = blocks[0];
  if (first && first.type === "heading") {
    title = first.text;
    blocks.shift();

    // Подзаголовок в документе стоит сразу под названием и выглядит как
    // обычная строка. Нумерованную («1. ...») или капсовую строку не трогаем —
    // это уже первый раздел правила.
    const second = blocks[0];
    if (
      second &&
      (second.type === "text" ||
        (second.type === "heading" &&
          !/^\d+[.)]\s/.test(second.text) &&
          !isMostlyUpper(second.text))) &&
      second.text.length <= 120
    ) {
      subtitle = second.text;
      blocks.shift();
    }
  }
  return { title, subtitle };
}

function styleOf(el: Element): string {
  return el.getAttribute?.("style") ?? "";
}

function paintedBackground(el: Element): boolean {
  const m = styleOf(el).match(/background(?:-color)?:\s*([^;]+)/i);
  if (!m) return false;
  const v = m[1].trim().toLowerCase();
  return !(
    !v ||
    v === "transparent" ||
    v === "#fff" ||
    v === "#ffffff" ||
    v === "white" ||
    /rgba\([^)]*,\s*0\s*\)/.test(v)
  );
}

/**
 * Есть ли у абзаца заметный фон — признак цветной врезки.
 * Google Docs красит не сам <p>, а <span> внутри него, поэтому смотрим и вглубь:
 * врезкой считаем абзац, у которого закрашена почти вся строка.
 */
function hasBackground(el: Element): boolean {
  if (paintedBackground(el)) return true;

  const total = cleanText(el.textContent ?? "").length;
  if (total === 0) return false;

  let painted = 0;
  for (const child of Array.from(el.querySelectorAll("*"))) {
    if (paintedBackground(child)) painted += cleanText(child.textContent ?? "").length;
  }
  return painted / total > 0.6;
}

/** Абзац целиком набран жирным — в документах так оформлены подзаголовки. */
function isBoldParagraph(el: Element): boolean {
  const total = cleanText(el.textContent ?? "").length;
  if (total === 0) return false;
  if (/font-weight:\s*(bold|[6-9]00)/i.test(styleOf(el))) return true;

  let bold = 0;
  for (const child of Array.from(el.querySelectorAll("*"))) {
    const tag = child.tagName.toLowerCase();
    if (tag === "b" || tag === "strong" || /font-weight:\s*(bold|[6-9]00)/i.test(styleOf(child))) {
      bold += cleanText(child.textContent ?? "").length;
    }
  }
  return bold / total > 0.9;
}

function tableToBlock(table: Element): RuleBlock | null {
  const rows = Array.from(table.querySelectorAll("tr"));
  if (rows.length === 0) return null;

  const grid = rows.map((tr) =>
    Array.from(tr.querySelectorAll("th,td")).map((c) => cleanText(c.textContent ?? "")),
  );
  const width = Math.max(...grid.map((r) => r.length));
  if (width === 0) return null;

  const norm = grid.map((r) => {
    const copy = [...r];
    while (copy.length < width) copy.push("");
    return copy;
  });

  // Первая строка — шапка, если она набрана капсом или состоит из <th>.
  const firstIsHeader =
    rows[0].querySelector("th") !== null ||
    norm[0].every((c) => !c || isMostlyUpper(c) || c.split(/\s+/).length <= 3);

  const headers = firstIsHeader ? norm[0] : [];
  const body = firstIsHeader ? norm.slice(1) : norm;
  const filtered = body.filter((r) => r.some((c) => c.length > 0));
  if (filtered.length === 0 && headers.length === 0) return null;

  return { type: "table", headers, rows: filtered };
}

/** Разбор HTML, скопированного из Google Docs. Работает только в браузере. */
export function parseRuleHtml(html: string): RuleParseResult {
  const warnings: string[] = [];
  if (typeof DOMParser === "undefined") {
    return { title: null, subtitle: null, blocks: [], warnings: ["HTML доступен только в браузере."] };
  }

  const doc = new DOMParser().parseFromString(html, "text/html");
  const blocks: RuleBlock[] = [];

  const walk = (node: Element) => {
    for (const el of Array.from(node.children)) {
      const tag = el.tagName.toLowerCase();

      if (tag === "table") {
        const t = tableToBlock(el);
        if (t) blocks.push(t);
        continue;
      }

      if (/^h[1-6]$/.test(tag)) {
        const text = cleanText(el.textContent ?? "");
        if (text) blocks.push({ type: "heading", text });
        continue;
      }

      if (tag === "ul" || tag === "ol") {
        const items = Array.from(el.querySelectorAll("li"))
          .map((li) => cleanText(li.textContent ?? ""))
          .filter(Boolean);
        if (items.length) blocks.push({ type: "list", items });
        continue;
      }

      if (tag === "br" || tag === "hr") continue;

      // Контейнер без собственного текста — идём глубже.
      const ownText = cleanText(el.textContent ?? "");
      const hasBlockChildren = Array.from(el.children).some((c) =>
        /^(table|ul|ol|h[1-6]|p|div)$/i.test(c.tagName),
      );

      if (hasBlockChildren) {
        walk(el);
        continue;
      }

      if (!ownText) continue;

      // Цветная врезка из документа.
      if (hasBackground(el)) {
        const c = detectCallout(ownText);
        blocks.push(c ?? { type: "callout", text: ownText, tone: "info" });
        continue;
      }

      const b = lineToBlock(ownText);
      if (!b) continue;

      // Жирная короткая строка без точки в конце — заголовок раздела,
      // даже если по словам она на заголовок не тянет.
      if (
        b.type === "text" &&
        ownText.length <= 90 &&
        !/[.!]$/.test(ownText) &&
        isBoldParagraph(el)
      ) {
        blocks.push({ type: "heading", text: ownText });
        continue;
      }

      blocks.push(b);
    }
  };

  walk(doc.body);

  const { title, subtitle } = extractTitle(blocks);

  if (blocks.length === 0) warnings.push("Не удалось выделить содержимое.");
  return { title, subtitle, blocks, warnings };
}

// ---------------------------------------------------------------- Текст

/** Запасной разбор, когда вставили обычный текст: таблицы — по табуляциям. */
export function parseRuleText(raw: string): RuleParseResult {
  const warnings: string[] = [];
  const lines = raw.split(/\r?\n/).map((l) => l.replace(/\s+$/, ""));
  const blocks: RuleBlock[] = [];

  let tableBuffer: string[][] = [];
  const flushTable = () => {
    if (tableBuffer.length === 0) return;
    const width = Math.max(...tableBuffer.map((r) => r.length));
    const norm = tableBuffer.map((r) => {
      const c = [...r];
      while (c.length < width) c.push("");
      return c;
    });
    const firstIsHeader = norm[0].every(
      (c) => !c || isMostlyUpper(c) || c.split(/\s+/).length <= 3,
    );
    blocks.push({
      type: "table",
      headers: firstIsHeader ? norm[0] : [],
      rows: firstIsHeader ? norm.slice(1) : norm,
    });
    tableBuffer = [];
  };

  for (const line of lines) {
    if (line.includes("\t")) {
      tableBuffer.push(line.split("\t").map(cleanText));
      continue;
    }
    flushTable();
    const b = lineToBlock(line);
    if (b) blocks.push(b);
  }
  flushTable();

  const { title, subtitle } = extractTitle(blocks);

  if (blocks.length === 0) warnings.push("Пустой текст.");
  return { title, subtitle, blocks, warnings };
}
