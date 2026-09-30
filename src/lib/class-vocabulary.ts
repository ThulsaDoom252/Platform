export type ClassVocabularyLang = "RU" | "UK";

const LATIN = /[a-z]/gi;
const CYRILLIC = /[\u0400-\u04ff]/g;

export function cleanClassVocabularyText(value: unknown, max = 240): string {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

export function normalizeClassVocabularyLang(value: unknown): ClassVocabularyLang {
  return value === "RU" ? "RU" : "UK";
}

/** Определяет направление: английский → выбранный язык или обратно. */
export function classVocabularyDirection(
  value: unknown,
): "FROM_ENGLISH" | "TO_ENGLISH" | null {
  const text = cleanClassVocabularyText(value);
  const latin = (text.match(LATIN) ?? []).length;
  const cyrillic = (text.match(CYRILLIC) ?? []).length;
  if (latin === 0 && cyrillic === 0) return null;
  return cyrillic > latin ? "TO_ENGLISH" : "FROM_ENGLISH";
}
