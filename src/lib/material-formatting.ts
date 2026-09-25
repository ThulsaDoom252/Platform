import { parseMaterial, type ParserMode } from "@/lib/materials-parser";
import { parseRuleText, type RuleBlock } from "@/lib/rule-parser";

export type FormattingPhrase = {
  phrase: string;
  transcription: string | null;
  translation: string | null;
  section: string | null;
  kind: string;
  examples: { en: string; tr: string }[];
};

const compact = (value: string | null | undefined) =>
  String(value ?? "")
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();

/** Явные остатки сырой строки, которые не должны оказаться названием записи. */
function hasBrokenPhraseShape(row: FormattingPhrase): boolean {
  const phrase = compact(row.phrase);
  if (!phrase) return true;
  if (row.kind === "PHRASE") {
    if (/[🔊🔈🔉🎧]/u.test(phrase)) return true;
    if (/^(?:💡|⚠️?|📌|📍|❗)\s*/u.test(phrase)) return true;
    if (/\s+[—–-]\s+[Ѐ-ӿ]/u.test(phrase)) return true;
    if (/\/[^/\s]{2,60}\//u.test(phrase)) return true;
    if (!compact(row.translation)) return true;
  }
  return row.examples.some((example) => !compact(example.en));
}

function hasExactDuplicates(rows: FormattingPhrase[]): boolean {
  const seen = new Set<string>();
  for (const row of rows) {
    const key = [
      row.kind,
      compact(row.section),
      compact(row.phrase),
      compact(row.transcription),
      compact(row.translation),
    ].join("\u0000");
    if (seen.has(key)) return true;
    seen.add(key);
  }
  return false;
}

/**
 * Проверяет именно форму словаря, не считая ручную замену перевода или иконки
 * ошибкой. Сохранённый исходник заново прогоняется через актуальный парсер.
 */
export function vocabularyHasFormattingIssue(
  sourceText: string | null,
  current: FormattingPhrase[],
  mode: ParserMode = "vocabulary",
): boolean {
  if (current.some(hasBrokenPhraseShape) || hasExactDuplicates(current)) return true;
  const source = sourceText?.trim() ?? "";
  if (!source) return false;

  const parsed = parseMaterial(source, mode);
  if (parsed.warnings.length > 0 || parsed.phrases.length !== current.length) return true;

  return parsed.phrases.some((expected, index) => {
    const actual = current[index];
    if (!actual || expected.kind !== actual.kind) return true;
    if (compact(expected.phrase) !== compact(actual.phrase)) return true;
    if (compact(expected.section) !== compact(actual.section)) return true;
    // Автотранскрипция может законно дополнить запись, которой IPA не было
    // в исходнике. Но указанная в исходнике транскрипция обязана сохраниться.
    if (
      expected.transcription &&
      compact(expected.transcription) !== compact(actual.transcription)
    ) {
      return true;
    }
    if (expected.translation && !compact(actual.translation)) return true;
    if (expected.examples.length !== actual.examples.length) return true;
    return expected.examples.some((example, exampleIndex) => {
      const saved = actual.examples[exampleIndex];
      return !saved || compact(example.en) !== compact(saved.en);
    });
  });
}

function ruleShape(block: RuleBlock): string {
  const variant = block.variant ?? "";
  switch (block.type) {
    case "list":
      return `${block.type}:${variant}:${block.items.length}`;
    case "table":
      return `${block.type}:${variant}:${block.headers.length}:${block.rows.length}:${block.rows
        .map((row) => row.length)
        .join(",")}`;
    default:
      return `${block.type}:${variant}`;
  }
}

function hasEmptyRuleBlock(block: RuleBlock): boolean {
  switch (block.type) {
    case "heading":
    case "formula":
    case "text":
      return !compact(block.text);
    case "callout":
      return !compact(block.text);
    case "example":
      return !compact(block.en);
    case "list":
      return block.items.length === 0 || block.items.some((item) => !compact(item));
    case "table":
      return block.headers.length === 0 && block.rows.length === 0;
  }
}

/** Проверяет структуру правила, не помечая ручную редактуру его текста. */
export function ruleHasFormattingIssue(
  sourceText: string | null,
  current: RuleBlock[],
): boolean {
  if (current.some(hasEmptyRuleBlock)) return true;
  const source = sourceText?.trim() ?? "";
  if (!source) return false;

  const parsed = parseRuleText(source);
  if (parsed.warnings.length > 0 || parsed.blocks.length !== current.length) return true;
  return parsed.blocks.some((block, index) => ruleShape(block) !== ruleShape(current[index]));
}
