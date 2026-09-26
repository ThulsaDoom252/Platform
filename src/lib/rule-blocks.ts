/**
 * Из чего состоит разобранная страница-документ.
 *
 * Правило, лексика и время хранятся одинаково — списком блоков. Описание
 * этих блоков лежит здесь одно на всех: и схема базы, и парсер, и проверка
 * на сервере смотрят в этот файл.
 *
 * Раньше описаний было два — в схеме и в парсере. Расширили одно, забыли
 * второе, и сервер молча выбрасывал незнакомые блоки при сохранении:
 * в предпросмотре материал был целым, а на странице оставался огрызок.
 * Поэтому тип живёт отдельным модулем без зависимостей: его одинаково
 * безопасно тянуть и в браузер, и на сервер.
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
  | {
      type: "callout";
      label?: string;
      text: string;
      tone?: "key" | "warn" | "tip" | "info";
      /** Дополнительная информация: прячется тумблером подсказок. */
      hint?: boolean;
    }
  | { type: "formula"; text: string }
  | { type: "text"; text: string }
  /** why — почему здесь именно эта форма; есть у разобранных примеров. */
  | { type: "example"; en: string; tr?: string; why?: string }
  | { type: "list"; items: string[] }
  | { type: "table"; headers: string[]; rows: string[][] }
  /** Карточка слова в лексике: чем оно отличается от соседних. */
  | {
      type: "word";
      word: string;
      icon?: string;
      us?: string;
      uk?: string;
      tr?: string;
      sense?: string;
      pattern?: string;
      examples: { en: string; tr: string }[];
      notes: string[];
    }
  /** Строка построения времени: утверждение, отрицание или вопрос. */
  | {
      type: "form";
      sign: "+" | "-" | "?";
      formula: string;
      en: string;
      tr: string;
    }
  /** Ключевое слово времени вместе с его особенностью. */
  | {
      type: "marker";
      word: string;
      tr: string;
      en: string;
      ru: string;
      hintText: string;
    }
  /**
   * Сетка подстановки: кто — чем — что получается.
   *
   * Длинная формула в одну строку читается плохо. Разложенная по
   * колонкам, она показывает ровно то, что нужно подставить.
   */
  | {
      type: "grid";
      title?: string;
      headers: string[];
      rows: string[][];
    }
  /** Ссылка на подробный разбор; хранит обе языковые версии. */
  | {
      type: "link";
      label: string;
      ru: string;
      uk: string;
    }
) & { variant?: RuleBlockVariant };

/** Все виды блоков — чтобы проверка на сервере не забыла ни одного. */
export const RULE_BLOCK_TYPES = [
  "heading",
  "callout",
  "formula",
  "text",
  "example",
  "list",
  "table",
  "word",
  "form",
  "marker",
  "grid",
  "link",
] as const satisfies readonly RuleBlock["type"][];

const MAX_TEXT = 4000;
const MAX_BLOCKS = 400;
const VARIANTS: RuleBlockVariant[] = [
  "sheet-text",
  "sheet-lead",
  "sheet-section",
  "sheet-formula",
  "sheet-formula-grid",
  "sheet-table",
  "sheet-mistake",
  "sheet-quiz",
  "sheet-answers",
];

function str(v: unknown): string {
  return typeof v === "string" ? v.slice(0, MAX_TEXT) : "";
}

/**
 * Блоки приходят из браузера (там разбирается HTML буфера обмена),
 * поэтому форму данных проверяем на сервере, а не доверяем клиенту.
 */
export function sanitizeBlocks(input: unknown): RuleBlock[] {
  if (!Array.isArray(input)) return [];
  const out: RuleBlock[] = [];

  for (const raw of input.slice(0, MAX_BLOCKS)) {
    if (!raw || typeof raw !== "object") continue;
    const b = raw as Record<string, unknown>;
    const variant = VARIANTS.includes(String(b.variant) as RuleBlockVariant)
      ? (String(b.variant) as RuleBlockVariant)
      : undefined;
    const styled = variant ? { variant } : {};

    switch (b.type) {
      case "heading":
      case "formula":
      case "text": {
        const text = str(b.text);
        if (text) out.push({ type: b.type, text, ...styled });
        break;
      }
      case "callout": {
        const text = str(b.text);
        if (!text) break;
        const tone = ["key", "warn", "tip", "info"].includes(String(b.tone))
          ? (b.tone as "key" | "warn" | "tip" | "info")
          : "info";
        const label = str(b.label);
        out.push({
          type: "callout",
          text,
          tone,
          ...(label ? { label } : {}),
          // Без этого признака тумблер подсказок не знал бы, что прятать.
          ...(b.hint ? { hint: true } : {}),
          ...styled,
        });
        break;
      }
      case "example": {
        const en = str(b.en);
        if (!en) break;
        const tr = str(b.tr);
        const why = str(b.why);
        out.push({
          type: "example",
          en,
          ...(tr ? { tr } : {}),
          ...(why ? { why } : {}),
          ...styled,
        });
        break;
      }
      case "word": {
        const word = str(b.word);
        if (!word) break;
        const examples = Array.isArray(b.examples)
          ? b.examples
              .filter((ex): ex is Record<string, unknown> => !!ex && typeof ex === "object")
              .map((ex) => ({ en: str(ex.en), tr: str(ex.tr) }))
              .filter((ex) => ex.en)
              .slice(0, 10)
          : [];
        const notes = Array.isArray(b.notes)
          ? b.notes.map(str).filter(Boolean).slice(0, 10)
          : [];
        const icon = str(b.icon);
        const us = str(b.us);
        const uk = str(b.uk);
        const tr = str(b.tr);
        const sense = str(b.sense);
        const pattern = str(b.pattern);
        out.push({
          type: "word",
          word,
          ...(icon ? { icon } : {}),
          ...(us ? { us } : {}),
          ...(uk ? { uk } : {}),
          ...(tr ? { tr } : {}),
          ...(sense ? { sense } : {}),
          ...(pattern ? { pattern } : {}),
          examples,
          notes,
          ...styled,
        });
        break;
      }
      case "form": {
        const en = str(b.en);
        const formula = str(b.formula);
        if (!en && !formula) break;
        const sign = b.sign === "-" || b.sign === "?" ? b.sign : "+";
        out.push({ type: "form", sign, formula, en, tr: str(b.tr), ...styled });
        break;
      }
      case "marker": {
        const word = str(b.word);
        if (!word) break;
        out.push({
          type: "marker",
          word,
          tr: str(b.tr),
          en: str(b.en),
          ru: str(b.ru),
          hintText: str(b.hintText),
          ...styled,
        });
        break;
      }
      case "grid": {
        const headers = Array.isArray(b.headers) ? b.headers.map(str).slice(0, 8) : [];
        const rows = Array.isArray(b.rows)
          ? b.rows
              .filter(Array.isArray)
              .map((r) => (r as unknown[]).map(str).slice(0, 8))
              .filter((r) => r.some(Boolean))
              .slice(0, 60)
          : [];
        if (rows.length === 0) break;
        const title = str(b.title);
        out.push({
          type: "grid",
          ...(title ? { title } : {}),
          headers,
          rows,
          ...styled,
        });
        break;
      }
      case "link": {
        const ru = str(b.ru);
        const uk = str(b.uk);
        if (!ru && !uk) break;
        out.push({
          type: "link",
          label: str(b.label) || "Подробный разбор",
          ru: ru || uk,
          uk: uk || ru,
          ...styled,
        });
        break;
      }
      case "list": {
        const items = Array.isArray(b.items)
          ? b.items.map(str).filter(Boolean).slice(0, 100)
          : [];
        if (items.length) out.push({ type: "list", items, ...styled });
        break;
      }
      case "table": {
        const headers = Array.isArray(b.headers)
          ? b.headers.map(str).slice(0, 10)
          : [];
        const rows = Array.isArray(b.rows)
          ? b.rows
              .filter(Array.isArray)
              .map((r) => (r as unknown[]).map(str).slice(0, 10))
              .slice(0, 200)
          : [];
        if (headers.length || rows.length) {
          out.push({ type: "table", headers, rows, ...styled });
        }
        break;
      }
    }
  }
  return out;
}
