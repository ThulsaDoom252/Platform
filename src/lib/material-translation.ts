import "server-only";
import type { RuleBlock } from "@/lib/db/schema";
import {
  KEEP_TAG,
  needsProtection,
  protectTerms,
  restoreTerms,
} from "@/lib/protect-terms";

export type MaterialTranslationLang = "RU" | "UK";

export type VocabularyTranslationInput = {
  id: string;
  kind?: "PHRASE" | "NOTE";
  phrase: string;
  section?: string | null;
  currentTranslation?: string | null;
  /** Жёлтая заметка «что стоит знать» под словом. */
  note?: string | null;
  examples?: { en: string; currentTranslation?: string | null }[];
};

export type VocabularyTranslationResult = {
  id: string;
  phrase: string;
  translation: string;
  note: string;
  examples: string[];
};

type SourceLanguage = MaterialTranslationLang | "EN";
type TargetLanguage = MaterialTranslationLang | "EN";
type TranslationSegment = {
  id: string;
  text: string;
  source?: SourceLanguage;
  context?: string;
};

const BATCH_SIZE = 50;
const CYRILLIC = /[\u0400-\u04ff]/;

function deepLSettings() {
  const key = (process.env.DEEPL_AUTH_KEY ?? process.env.DEEPL_KEY)?.trim();
  if (!key) {
    throw new Error(
      "Не задан DEEPL_AUTH_KEY или DEEPL_KEY. Добавьте ключ DeepL API в файл .env и перезапустите приложение.",
    );
  }

  const configured = process.env.DEEPL_API_URL?.trim().replace(/\/$/, "");
  const baseUrl = configured || (key.endsWith(":fx") ? "https://api-free.deepl.com" : "https://api.deepl.com");
  return { key, baseUrl };
}

async function requestDeepL(
  texts: string[],
  target: TargetLanguage,
  source?: SourceLanguage,
  context?: string,
): Promise<string[]> {
  if (texts.length === 0) return [];
  const { key, baseUrl } = deepLSettings();

  // Английское слово внутри пояснения — предмет разговора, а не текст:
  // помечаем такие куски и просим переводчик их не трогать.
  const keep = texts.some(needsProtection);
  const payload = keep ? texts.map(protectTerms) : texts;
  const response = await fetch(`${baseUrl}/v2/translate`, {
    method: "POST",
    headers: {
      authorization: `DeepL-Auth-Key ${key}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      text: payload,
      target_lang: target,
      ...(source && source !== target ? { source_lang: source } : {}),
      ...(context?.trim() ? { context: context.slice(0, 12_000) } : {}),
      ...(keep ? { tag_handling: "xml", ignore_tags: [KEEP_TAG] } : {}),
      model_type: "prefer_quality_optimized",
      preserve_formatting: true,
    }),
    signal: AbortSignal.timeout(30_000),
  });

  if (!response.ok) {
    const detail = (await response.text()).slice(0, 300);
    if (response.status === 403) {
      throw new Error("DeepL отклонил ключ. Проверьте DEEPL_AUTH_KEY и тариф API.");
    }
    if (response.status === 456) {
      throw new Error("Закончился лимит символов DeepL API.");
    }
    throw new Error(`DeepL ${response.status}: ${detail || "ошибка перевода"}`);
  }

  const json = (await response.json()) as { translations?: { text?: string }[] };
  const translations = (json.translations ?? []).map((item) => {
    const text = item.text?.trim() ?? "";
    return keep ? restoreTerms(text) : text;
  });
  if (translations.length !== texts.length || translations.some((text) => !text)) {
    throw new Error("DeepL вернул неполный перевод");
  }
  return translations;
}

/** Короткий двусторонний перевод для словника прямо во время урока. */
export async function translateShortText(
  text: string,
  target: TargetLanguage,
  source: SourceLanguage,
): Promise<string> {
  const [translated] = await requestDeepL([text], target, source, "English lesson vocabulary");
  return translated;
}

/** Пакетный перевод коротких учебных фраз, в том числе для редактора домашки. */
export async function translateShortTexts(
  values: string[],
  target: TargetLanguage,
  source: SourceLanguage,
  context = "English lesson homework",
): Promise<string[]> {
  const texts = values
    .map((value) => String(value ?? "").trim().slice(0, 1_500))
    .filter(Boolean)
    .slice(0, 100);
  if (texts.length !== values.length) {
    throw new Error("Заполни все предложения перед переводом");
  }

  const translated: string[] = [];
  for (let offset = 0; offset < texts.length; offset += BATCH_SIZE) {
    translated.push(...await requestDeepL(
      texts.slice(offset, offset + BATCH_SIZE),
      target,
      source,
      context,
    ));
  }
  return translated;
}

async function translateSegments(
  segments: TranslationSegment[],
  target: MaterialTranslationLang,
): Promise<Map<string, string>> {
  const result = new Map<string, string>();
  const groups = new Map<string, TranslationSegment[]>();

  for (const segment of segments) {
    if (!segment.text.trim()) continue;
    if (segment.source === target) {
      result.set(segment.id, segment.text);
      continue;
    }
    const key = segment.source ?? "AUTO";
    groups.set(key, [...(groups.get(key) ?? []), segment]);
  }

  for (const [sourceKey, grouped] of groups) {
    for (let offset = 0; offset < grouped.length; offset += BATCH_SIZE) {
      const batch = grouped.slice(offset, offset + BATCH_SIZE);
      const context = Array.from(
        new Set(batch.map((item) => item.context?.trim()).filter(Boolean)),
      ).join("\n\n");
      const translated = await requestDeepL(
        batch.map((item) => item.text),
        target,
        sourceKey === "AUTO" ? undefined : (sourceKey as SourceLanguage),
        context,
      );
      batch.forEach((item, index) => result.set(item.id, translated[index]));
    }
  }

  return result;
}

/**
 * Переводит только значения карточки. Английское слово всегда остаётся исходником,
 * а при переключении языка существующий украинский/русский перевод заменяется новым.
 */
export async function translateVocabulary(
  items: VocabularyTranslationInput[],
  target: MaterialTranslationLang,
  sourceLanguage?: MaterialTranslationLang,
): Promise<Map<string, VocabularyTranslationResult>> {
  const segments: TranslationSegment[] = [];

  for (const item of items) {
    const examples = item.examples ?? [];
    const context = [
      `English headword: ${item.phrase}`,
      item.section ? `Section: ${item.section}` : "",
      ...examples.filter((example) => example.en.trim()).map((example) => `English example: ${example.en}`),
    ]
      .filter(Boolean)
      .join("\n");

    if (item.kind === "NOTE") {
      segments.push({
        id: `${item.id}:phrase`,
        text: item.phrase,
        source: sourceLanguage,
        context,
      });
      if (item.currentTranslation?.trim()) {
        segments.push({
          id: `${item.id}:translation`,
          text: item.currentTranslation,
          source: sourceLanguage,
          context,
        });
      }
    } else {
      const existing = item.currentTranslation?.trim();
      segments.push({
        id: `${item.id}:translation`,
        text: existing || item.phrase,
        source: existing ? sourceLanguage : "EN",
        context,
      });
    }

    if (item.note?.trim()) {
      segments.push({
        id: `${item.id}:note`,
        text: item.note,
        source: sourceLanguage,
        context,
      });
    }

    examples.forEach((example, index) => {
      const existing = example.currentTranslation?.trim();
      if (!existing && !example.en.trim()) return;
      segments.push({
        id: `${item.id}:example:${index}`,
        text: existing || example.en,
        source: existing ? sourceLanguage : "EN",
        context,
      });
    });
  }

  const translated = await translateSegments(segments, target);
  const result = new Map<string, VocabularyTranslationResult>();
  for (const item of items) {
    const examples = (item.examples ?? []).map((example, index) =>
      example.en.trim()
        ? (translated.get(`${item.id}:example:${index}`) ?? example.currentTranslation ?? "")
        : "",
    );
    const phrase =
      item.kind === "NOTE"
        ? (translated.get(`${item.id}:phrase`) ?? item.phrase)
        : item.phrase;
    const translation =
      translated.get(`${item.id}:translation`) ?? item.currentTranslation?.trim() ?? "";

    if (item.kind !== "NOTE" && !translation) {
      throw new Error(`DeepL не вернул перевод для «${item.phrase}»`);
    }
    const note = translated.get(`${item.id}:note`) ?? item.note?.trim() ?? "";
    result.set(item.id, { id: item.id, phrase, translation, note, examples });
  }
  return result;
}

function shouldTranslateExisting(text: string, source?: SourceLanguage) {
  return text.trim() && (!source || source === "EN" || CYRILLIC.test(text));
}

/** Переводит пояснения правила, не трогая английские примеры и формулы. */
export async function translateRuleBlocks(
  blocks: RuleBlock[],
  target: MaterialTranslationLang,
  sourceLanguage?: MaterialTranslationLang,
): Promise<RuleBlock[]> {
  const segments: TranslationSegment[] = [];
  const add = (
    id: string,
    text: string | undefined,
    source: SourceLanguage | undefined = sourceLanguage,
  ) => {
    if (!text?.trim() || !shouldTranslateExisting(text, source)) return;
    segments.push({ id, text, source, context: "English grammar learning material" });
  };

  /**
   * Кусок, где английское намешано с пояснением: «підмет + don't + V».
   * Целиком английское не трогаем — это формула или пример, а не текст.
   */
  const addMixed = (id: string, text: string | undefined) => {
    if (text && CYRILLIC.test(text)) add(id, text);
  };

  blocks.forEach((block, index) => {
    switch (block.type) {
      case "heading":
      case "text":
        add(`${index}.text`, block.text);
        break;
      case "callout":
        add(`${index}.label`, block.label);
        add(`${index}.text`, block.text);
        break;
      case "formula":
        // Формула наполовину английская, наполовину нет: «підмет + V».
        // Английское защищено тегом, остальное переводится как обычно.
        addMixed(`${index}.text`, block.text);
        break;
      case "example":
        if (block.tr?.trim()) add(`${index}.tr`, block.tr);
        else add(`${index}.tr`, block.en, "EN");
        add(`${index}.why`, block.why);
        break;
      case "list":
        block.items.forEach((item, itemIndex) => add(`${index}.items.${itemIndex}`, item));
        break;
      case "table":
        block.headers.forEach((text, cell) => add(`${index}.headers.${cell}`, text));
        block.rows.forEach((row, rowIndex) =>
          row.forEach((text, cell) => add(`${index}.rows.${rowIndex}.${cell}`, text)),
        );
        break;
      case "word":
        // Само слово и схема употребления английские — их не переводим.
        add(`${index}.tr`, block.tr);
        add(`${index}.sense`, block.sense);
        block.examples.forEach((example, exampleIndex) =>
          add(`${index}.examples.${exampleIndex}`, example.tr || example.en,
            example.tr ? sourceLanguage : "EN"),
        );
        block.notes.forEach((note, noteIndex) =>
          add(`${index}.notes.${noteIndex}`, note),
        );
        break;
      case "form":
        addMixed(`${index}.formula`, block.formula);
        add(`${index}.tr`, block.tr || block.en, block.tr ? sourceLanguage : "EN");
        break;
      case "marker":
        add(`${index}.tr`, block.tr);
        add(`${index}.ru`, block.ru || block.en, block.ru ? sourceLanguage : "EN");
        add(`${index}.hintText`, block.hintText);
        break;
      case "grid":
        add(`${index}.title`, block.title);
        block.headers.forEach((text, cell) => add(`${index}.headers.${cell}`, text));
        block.rows.forEach((row, rowIndex) =>
          row.forEach((text, cell) =>
            addMixed(`${index}.rows.${rowIndex}.${cell}`, text),
          ),
        );
        break;
      case "link":
        add(`${index}.label`, block.label);
        break;
    }
  });

  const translated = await translateSegments(segments, target);
  const get = (id: string, fallback: string) => translated.get(id) ?? fallback;

  return blocks.map((block, index): RuleBlock => {
    switch (block.type) {
      case "heading":
      case "text":
      case "formula":
        return { ...block, text: get(`${index}.text`, block.text) };
      case "callout":
        return {
          ...block,
          ...(block.label ? { label: get(`${index}.label`, block.label) } : {}),
          text: get(`${index}.text`, block.text),
        };
      case "example":
        return {
          ...block,
          tr: get(`${index}.tr`, block.tr ?? ""),
          ...(block.why ? { why: get(`${index}.why`, block.why) } : {}),
        };
      case "list":
        return {
          ...block,
          items: block.items.map((item, itemIndex) =>
            get(`${index}.items.${itemIndex}`, item),
          ),
        };
      case "table":
        return {
          ...block,
          headers: block.headers.map((text, cell) =>
            get(`${index}.headers.${cell}`, text),
          ),
          rows: block.rows.map((row, rowIndex) =>
            row.map((text, cell) => get(`${index}.rows.${rowIndex}.${cell}`, text)),
          ),
        };
      case "word":
        return {
          ...block,
          ...(block.tr ? { tr: get(`${index}.tr`, block.tr) } : {}),
          ...(block.sense ? { sense: get(`${index}.sense`, block.sense) } : {}),
          examples: block.examples.map((example, exampleIndex) => ({
            ...example,
            tr: get(`${index}.examples.${exampleIndex}`, example.tr),
          })),
          notes: block.notes.map((note, noteIndex) =>
            get(`${index}.notes.${noteIndex}`, note),
          ),
        };
      case "form":
        return {
          ...block,
          formula: get(`${index}.formula`, block.formula),
          tr: get(`${index}.tr`, block.tr),
        };
      case "marker":
        return {
          ...block,
          tr: get(`${index}.tr`, block.tr),
          ru: get(`${index}.ru`, block.ru),
          hintText: get(`${index}.hintText`, block.hintText),
        };
      case "grid":
        return {
          ...block,
          ...(block.title ? { title: get(`${index}.title`, block.title) } : {}),
          headers: block.headers.map((text, cell) =>
            get(`${index}.headers.${cell}`, text),
          ),
          rows: block.rows.map((row, rowIndex) =>
            row.map((text, cell) => get(`${index}.rows.${rowIndex}.${cell}`, text)),
          ),
        };
      case "link":
        return { ...block, label: get(`${index}.label`, block.label) };
    }
  });
}

export async function translateMaterialText(
  text: string,
  target: MaterialTranslationLang,
  sourceLanguage?: MaterialTranslationLang,
): Promise<string> {
  if (!shouldTranslateExisting(text, sourceLanguage) || sourceLanguage === target) return text;
  const result = await translateSegments(
    [{ id: "text", text, source: sourceLanguage, context: "English learning material" }],
    target,
  );
  return result.get("text") ?? text;
}
