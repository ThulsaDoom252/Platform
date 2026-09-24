/**
 * Разбор правила в блоки документа.
 *
 * Правила в Google Docs — это не список фраз, а вёрстка: заголовки, цветные
 * врезки, формулы и таблицы на 2–4 колонки. Поэтому при вставке читаем HTML
 * из буфера обмена: там таблицы приходят настоящими <table>, и угадывать
 * структуру по отступам не нужно. Для случая «вставили просто текст»
 * оставлен запасной разбор по табуляциям.
 */

export type RuleBlockVariant =
  | "sheet-text"
  | "sheet-lead"
  | "sheet-section"
  | "sheet-formula"
  | "sheet-formula-grid"
  | "sheet-table"
  | "sheet-mistake"
  | "sheet-quiz"
  | "sheet-answers";

export type RuleBlock = (
  | { type: "heading"; text: string }
  | { type: "callout"; label?: string; text: string; tone?: "key" | "warn" | "tip" | "info" }
  | { type: "formula"; text: string }
  | { type: "text"; text: string }
  | { type: "example"; en: string; tr?: string }
  | { type: "list"; items: string[] }
  | { type: "table"; headers: string[]; rows: string[][] }
) & { variant?: RuleBlockVariant };

export type RuleParseResult = {
  title: string | null;
  subtitle: string | null;
  blocks: RuleBlock[];
  warnings: string[];
  /** Внутренний способ разбора. В интерфейсе по-прежнему один парсер правил. */
  format: RuleParserFormat;
};

export type RuleParserFormat = "generic" | "structured-study-sheet";

const DASH = /\s+[—–]\s+/;

/** Метки врезок, встречающиеся в документах. */
const CALLOUT_LABELS: { re: RegExp; tone: "key" | "warn" | "tip" | "info" }[] = [
  {
    re: /^(важливо|увага|важно|внимание|виняток|исключение|exception|не плутай|не путай)(?=[:\s!?]|$)/i,
    tone: "warn",
  },
  {
    re: /^(просто запам'?ятай|шпаргалка|порада|підказка|запам'?ятай|швидка перевірка)(?=[:\s!?]|$)/i,
    tone: "tip",
  },
  {
    re: /^(головне|головна ідея|найпростіше|ключове|коли використовуємо)(?=[:\s!?]|$)/i,
    tone: "key",
  },
  { re: /^(примітка|зверни увагу|нотатка)(?=[:\s!?]|$)/i, tone: "info" },
];

/** Эмодзи в начале строки: для проверки «похоже на заголовок» оно лишнее. */
function stripLeadEmoji(s: string): string {
  return s
    .replace(
      /^(?:[\u{1F000}-\u{1FAFF}\u{2190}-\u{27BF}\u{FE0F}\u{200D}\u{20E3}]+\s*)+/u,
      "",
    )
    .trim();
}

/**
 * Оттенок врезки по значку в начале: «✗ так нельзя» и «✓ так можно»
 * встречаются парами, и разный цвет делает разницу видимой сразу.
 */
function markerTone(s: string): "key" | "warn" | "tip" | "info" {
  if (/^[✗✘❌🚫⛔]/u.test(s)) return "warn";
  if (/^[✓✔✅]/u.test(s)) return "key";
  if (/^[⚠🚨❗]/u.test(s)) return "warn";
  if (/^[💡⭐🌟]/u.test(s)) return "tip";
  return "info";
}

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

function detectCallout(
  s: string,
): Extract<RuleBlock, { type: "callout" }> | null {
  // «ВАЖЛИВО: текст» или «Примітка: текст»
  const colon = s.indexOf(":");
  const head = colon > 0 && colon < 40 ? s.slice(0, colon) : "";
  const stripped = head.replace(/^[^\p{L}]+/u, "");

  for (const { re, tone } of CALLOUT_LABELS) {
    if (re.test(stripped)) {
      return { type: "callout", label: cleanText(head), text: cleanText(s.slice(colon + 1)), tone };
    }
    // Метка без двоеточия — «Коли використовуємо? ...»
    if (colon === -1 && re.test(s.replace(/^[^\p{L}]+/u, ""))) {
      return { type: "callout", text: cleanText(s), tone };
    }
  }

  // Флаг u обязателен: без него эмодзи из двух половинок разваливается,
  // и в набор попадает «половинка», совпадающая почти с любым значком.
  if (/^[⚠🚨❗]️?/u.test(s)) {
    return { type: "callout", text: cleanText(s), tone: "warn" };
  }
  if (/^[💡⭐🌟]️?/u.test(s)) {
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

// --------------------------------------------------------- Форматы правил

function blockText(block: RuleBlock): string {
  switch (block.type) {
    case "example":
      return [block.en, block.tr].filter(Boolean).join(" — ");
    case "list":
      return block.items.join(" ");
    case "table":
      return [...block.headers, ...block.rows.flat()].join(" ");
    default:
      return block.text;
  }
}

function singleCellTableText(block: RuleBlock): string | null {
  if (block.type !== "table") return null;
  const cells = [...block.headers, ...block.rows.flat()].filter(Boolean);
  return cells.length === 1 ? cells[0] : null;
}

/**
 * Формат цветной учебной шпаргалки из Google Docs: несколько нумерованных
 * секций, сравнительные таблицы, формулы, типичные ошибки и мини-проверка.
 * Названия темы здесь только усиливают сигнал — формат не привязан к одному
 * конкретному правилу и пригодится для следующих таких же документов.
 */
function detectRuleFormat(raw: string, blocks: RuleBlock[]): RuleParserFormat {
  const text = cleanText(`${raw} ${blocks.map(blockText).join(" ")}`);
  const upper = text.toUpperCase();
  let score = 0;

  const tables = blocks.filter((block) => block.type === "table").length;
  const numberedSections = (text.match(/(?:^|\s)\d{1,2}[.)]?\s*[А-ЯІЇЄҐA-Z][А-ЯІЇЄҐA-Z\s]{4,}/gu) ?? [])
    .length;

  if (tables >= 2) score += 2;
  if (numberedSections >= 3) score += 2;
  if (/\bTO\s*\+\s*V\b/i.test(text) && /\bV\s*[-‐‑]?\s*ING\b/i.test(text)) score += 2;
  if (/ТИПОВІ\s+ПОМИЛКИ|ТИПИЧНЫЕ\s+ОШИБКИ|COMMON\s+MISTAKES/i.test(upper)) score += 2;
  if (/МІНІ\s*ПЕРЕВІРКА|МИНИ\s*ПРОВЕРКА|MINI\s*(?:CHECK|TEST)/i.test(upper)) score += 2;
  if (/ВІДПОВІДІ|ОТВЕТЫ|ANSWERS/i.test(upper)) score += 1;
  if (/REMEMBER/.test(upper) && /FORGET/.test(upper)) score += 1;

  return score >= 5 ? "structured-study-sheet" : "generic";
}

function splitStructuredTitle(text: string): { title: string; subtitle: string | null } | null {
  const s = cleanText(text);
  const known = s.match(
    /^(REMEMBER)\s*(?:[|/]|[ІI])\s*(FORGET)\s*(?:(INFINITIVE\s+(?:VS|ТА|AND)\s+GERUND)|(.+?БЕЗ\s+ПЛУТАНИНИ))?$/i,
  );
  if (!known) return null;
  return {
    title: `${known[1]} | ${known[2]}`.toUpperCase(),
    subtitle: cleanText(known[3] ?? known[4] ?? "") || null,
  };
}

function isStructuredFormula(text: string): boolean {
  return /^(?:REMEMBER|FORGET)\s*\+\s*(?:TO\s*\+\s*V|V\s*[-‐‑]?\s*ING)\s*=/i.test(
    stripLeadEmoji(text),
  );
}

function isAnswerLine(text: string): boolean {
  return /^(?:ВІДПОВІДІ|ОТВЕТЫ|ANSWERS)(?=[:\s]|$)\s*:*/i.test(stripLeadEmoji(text));
}

function answerCallout(text: string): RuleBlock {
  const clean = stripLeadEmoji(text);
  const match = clean.match(/^(ВІДПОВІДІ|ОТВЕТЫ|ANSWERS)(?=[:\s]|$)\s*:*/i);
  const label = cleanText(match?.[1] ?? "Відповіді");
  return {
    type: "callout",
    label,
    text: cleanText(clean.slice(match?.[0].length ?? 0)),
    tone: "key",
    variant: "sheet-answers",
  };
}

function normalizeSectionHeading(text: string): string {
  const clean = stripLeadEmoji(text);
  // Google Docs иногда склеивает номер и название цветной плашки: «1ПОРЯДОК».
  return clean.replace(/^(\d{1,2})\s*(?=[А-ЯІЇЄҐA-Z])/u, "$1. ");
}

function isNumberedSection(text: string): boolean {
  const normalized = normalizeSectionHeading(text);
  const body = normalized.replace(/^\d{1,2}[.)]\s*/, "");
  return /^\d{1,2}[.)]\s*/.test(normalized) && isMostlyUpper(body);
}

function isQuizHeading(text: string): boolean {
  return /МІНІ\s*ПЕРЕВІРКА|МИНИ\s*ПРОВЕРКА|MINI\s*(?:CHECK|TEST)/i.test(text);
}

function isQuizItem(text: string): boolean {
  const clean = stripLeadEmoji(text);
  const match = clean.match(/^\d{1,2}[.)]\s*(.+)$/);
  if (!match || isMostlyUpper(match[1])) return false;
  return /_{2,}|\b(?:remember|forget)\b/i.test(match[1]);
}

function isMistakeLine(text: string): boolean {
  const clean = text.trim();
  return /^[✗✘❌🚫⛔✓✔✅]/u.test(clean) || (/\b[✗✘❌]\b/u.test(clean) && /[✓✔✅]/u.test(clean));
}

function normalizeStructuredStudySheet(input: RuleBlock[]): {
  title: string | null;
  subtitle: string | null;
  blocks: RuleBlock[];
} {
  let title: string | null = null;
  let subtitle: string | null = null;
  let inQuiz = false;
  let quizItems: string[] = [];
  const blocks: RuleBlock[] = [];

  const flushQuiz = () => {
    if (quizItems.length) {
      blocks.push({ type: "list", items: quizItems, variant: "sheet-quiz" });
    }
    quizItems = [];
  };

  for (const original of input) {
    const singleCell = singleCellTableText(original);
    const text = cleanText(singleCell ?? blockText(original));
    if (!text) continue;

    const titleParts = splitStructuredTitle(text);
    if (titleParts) {
      if (!title) title = titleParts.title;
      if (!subtitle && titleParts.subtitle) subtitle = titleParts.subtitle;
      // На второй странице Google Docs часто повторяет шапку документа.
      // В материале она не должна становиться ещё одним разделом.
      continue;
    }

    if (
      title &&
      !subtitle &&
      /INFINITIVE\s+(?:VS|ТА|AND)\s+GERUND|ІНФІНІТИВ.+ГЕРУНД/i.test(text) &&
      text.length <= 100
    ) {
      subtitle = text;
      continue;
    }

    if (isAnswerLine(text)) {
      flushQuiz();
      blocks.push(answerCallout(text));
      inQuiz = false;
      continue;
    }

    if (isQuizItem(text) && inQuiz) {
      quizItems.push(text.replace(/^\d{1,2}[.)]\s*/, ""));
      continue;
    }

    if (singleCell !== null || original.type !== "table") {
      if (isQuizHeading(text)) {
        flushQuiz();
        blocks.push({
          type: "heading",
          text: normalizeSectionHeading(text),
          variant: "sheet-section",
        });
        inQuiz = true;
        continue;
      }

      if (isNumberedSection(text)) {
        flushQuiz();
        blocks.push({
          type: "heading",
          text: normalizeSectionHeading(text),
          variant: "sheet-section",
        });
        inQuiz = false;
        continue;
      }

      if (isStructuredFormula(text)) {
        flushQuiz();
        blocks.push({ type: "formula", text, variant: "sheet-formula" });
        continue;
      }

      if (isMistakeLine(text)) {
        flushQuiz();
        blocks.push({
          type: "callout",
          text,
          tone: markerTone(text) === "key" ? "key" : "warn",
          variant: "sheet-mistake",
        });
        continue;
      }

      // Одноячеечные таблицы в таких документах используются как цветные
      // полосы-заголовки, а не как настоящие таблицы данных.
      if (singleCell !== null) {
        flushQuiz();
        const callout = detectCallout(text);
        blocks.push(
          callout
            ? { ...callout, variant: callout.tone === "key" ? "sheet-lead" : "sheet-text" }
            : {
                type: "heading",
                text: normalizeSectionHeading(text),
                variant: "sheet-section",
              },
        );
        continue;
      }
    }

    flushQuiz();
    if (original.type === "table") {
      const formulaGrid =
        original.rows.length <= 1 &&
        original.headers.length <= 2 &&
        /TO\s*\+\s*V/i.test(text) &&
        /V\s*[-‐‑]?\s*ING/i.test(text);
      blocks.push({
        ...original,
        variant: formulaGrid ? "sheet-formula-grid" : "sheet-table",
      });
    } else if (original.type === "callout") {
      blocks.push({
        ...original,
        variant: original.tone === "key" ? "sheet-lead" : "sheet-text",
      });
    } else {
      blocks.push({ ...original, variant: "sheet-text" });
    }
  }

  flushQuiz();

  if (!title) {
    const extracted = extractTitle(blocks);
    title = extracted.title;
    subtitle = extracted.subtitle;
  }

  return { title, subtitle, blocks };
}

function finalizeRuleParse(
  raw: string,
  blocks: RuleBlock[],
  warnings: string[],
): RuleParseResult {
  const format = detectRuleFormat(raw, blocks);
  if (format === "structured-study-sheet") {
    const normalized = normalizeStructuredStudySheet(blocks);
    if (normalized.blocks.length === 0) warnings.push("Не удалось выделить содержимое.");
    return { ...normalized, warnings, format };
  }

  const { title, subtitle } = extractTitle(blocks);
  if (blocks.length === 0) warnings.push(raw.trim() ? "Не удалось выделить содержимое." : "Пустой текст.");
  return { title, subtitle, blocks, warnings, format };
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
    return {
      title: null,
      subtitle: null,
      blocks: [],
      warnings: ["HTML доступен только в браузере."],
      format: "generic",
    };
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

      // Цветная плашка из документа: это либо врезка, либо заголовок раздела.
      if (hasBackground(el)) {
        const c = detectCallout(ownText);
        if (c) {
          blocks.push(c);
          continue;
        }

        // Короткая строка без точки в конце — заголовок раздела,
        // просто нарисованный полосой («🕐 Конкретний час»).
        if (looksLikeHeading(stripLeadEmoji(ownText))) {
          blocks.push({ type: "heading", text: ownText });
          continue;
        }

        blocks.push({ type: "callout", text: ownText, tone: markerTone(ownText) });
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
  return finalizeRuleParse(doc.body.textContent ?? "", blocks, warnings);
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
  return finalizeRuleParse(raw, blocks, warnings);
}
