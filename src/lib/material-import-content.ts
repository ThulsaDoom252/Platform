import { parseMaterial, type ParsedPhrase } from "@/lib/materials-parser";
import { parseRuleText, type RuleBlock } from "@/lib/rule-parser";

export type ImportedFileContent =
  | {
      kind: "VOCAB" | "MISTAKE";
      phrases: ParsedPhrase[];
      sourceText: string;
      warnings: string[];
    }
  | {
      kind: "RULE";
      blocks: RuleBlock[];
      sourceText: string;
      warnings: string[];
    }
  | { error: string };

const RULE_PATH =
  /\b(?:rules?|grammar|tenses?|conditionals?|modals?|articles?|clefts?|syntax)\b|правил|грамат|граммат|часи|времена|конструкц/iu;
const VOCAB_PATH =
  /\b(?:vocab(?:ulary)?|lexic(?:on)?|idioms?|phrasal|phrases?|collocations?|terms?|words?)\b|слов|лексик|ідіом|идиом|фраз|термін|термин/iu;

/** Ближайшая папка важнее корневой: Rules → Lexic считается словарём. */
function pathHint(path: string[]): "VOCAB" | "RULE" | null {
  for (const part of [...path].reverse()) {
    const value = String(part ?? "").trim();
    if (VOCAB_PATH.test(value)) return "VOCAB";
    if (RULE_PATH.test(value)) return "RULE";
  }
  return null;
}

function textLooksLikeVocabulary(source: string): boolean {
  const lines = source.split(/\r?\n/).filter((line) => line.trim());
  const bilingual = lines.filter(
    (line) =>
      /[A-Za-z]/.test(line) &&
      /[Ѐ-ӿ]/u.test(line) &&
      /\s+[—–-]\s+/.test(line),
  ).length;
  const ipa = lines.filter((line) => /\/[^/\s]{2,80}\//u.test(line)).length;
  return bilingual >= 2 || ipa >= 2;
}

/**
 * Автоматически выбирает существующий парсер и возвращает готовое содержимое.
 * Никакой текст существующего файла эта функция не заменяет — она применяется
 * только сразу после создания нового узла.
 */
export function parseImportedFileContent(
  raw: string,
  path: string[],
  scope: "MATERIAL" | "PERSONAL" | "STUDENT" | "MISTAKE",
  preferredKind?: "VOCAB" | "RULE" | "MISTAKE" | null,
): ImportedFileContent {
  const sourceText = String(raw ?? "").trim().slice(0, 1_000_000);
  if (!sourceText) return { error: "пустой текст" };

  if (scope === "MISTAKE" || preferredKind === "MISTAKE") {
    const parsed = parseMaterial(sourceText, "mistake");
    return parsed.phrases.length > 0
      ? {
          kind: "MISTAKE",
          phrases: parsed.phrases,
          sourceText,
          warnings: parsed.warnings,
        }
      : { error: parsed.warnings[0] ?? "не удалось разобрать ошибки" };
  }

  if (preferredKind === "VOCAB") {
    const parsed = parseMaterial(sourceText, "vocabulary");
    return parsed.phrases.length > 0
      ? {
          kind: "VOCAB",
          phrases: parsed.phrases,
          sourceText,
          warnings: parsed.warnings,
        }
      : { error: parsed.warnings[0] ?? "не удалось разобрать словарь" };
  }

  if (preferredKind === "RULE") {
    const parsed = parseRuleText(sourceText);
    return parsed.blocks.length > 0
      ? {
          kind: "RULE",
          blocks: parsed.blocks,
          sourceText,
          warnings: parsed.warnings,
        }
      : { error: parsed.warnings[0] ?? "не удалось разобрать правило" };
  }

  const hint = pathHint(path);
  const vocabularyFirst = hint === "VOCAB" || (!hint && textLooksLikeVocabulary(sourceText));

  if (vocabularyFirst) {
    const parsed = parseMaterial(sourceText, "vocabulary");
    if (parsed.phrases.length > 0) {
      return {
        kind: "VOCAB",
        phrases: parsed.phrases,
        sourceText,
        warnings: parsed.warnings,
      };
    }
    if (hint === "VOCAB") {
      return { error: parsed.warnings[0] ?? "не удалось разобрать словарь" };
    }
  }

  const parsedRule = parseRuleText(sourceText);
  if (parsedRule.blocks.length > 0) {
    return {
      kind: "RULE",
      blocks: parsedRule.blocks,
      sourceText,
      warnings: parsedRule.warnings,
    };
  }

  // Если автоматический выбор правила не сработал, словарь остаётся запасным
  // вариантом для короткого файла из одной записи.
  const parsedVocabulary = parseMaterial(sourceText, "vocabulary");
  if (parsedVocabulary.phrases.length > 0) {
    return {
      kind: "VOCAB",
      phrases: parsedVocabulary.phrases,
      sourceText,
      warnings: parsedVocabulary.warnings,
    };
  }

  return {
    error:
      parsedRule.warnings[0] ??
      parsedVocabulary.warnings[0] ??
      "текст не распознан",
  };
}
