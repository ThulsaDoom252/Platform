/**
 * На какой язык переведён материал.
 *
 * Метка в базе врёт: страница создаётся с языком по умолчанию, а
 * наполняют её чем придётся — из двадцати двух словников с русскими
 * переводами все были помечены украинскими. Поэтому язык определяется
 * по самому тексту, а метка остаётся лишь запасным ответом.
 *
 * Считаем буквы, которые есть только в одном из языков: «і, ї, є, ґ»
 * против «ы, э, ъ, ё». На живом словнике их десятки, и спутать два
 * языка по ним невозможно.
 */

export type TranslationLang = "RU" | "UK";

const UK_ONLY = /[іїєґ]/gi;
const RU_ONLY = /[ыэъё]/gi;

/** Сколько различающих букв в тексте. Нужно и для решения, и для теста. */
export function langMarks(text: string): { uk: number; ru: number } {
  const body = String(text ?? "");
  return {
    uk: (body.match(UK_ONLY) ?? []).length,
    ru: (body.match(RU_ONLY) ?? []).length,
  };
}

/**
 * Язык по набору строк.
 *
 * Пусто — когда различающих букв нет вовсе: короткий словник из слов
 * вроде «дом» и «кот» пишется одинаково на обоих. Тогда решать не по
 * чему, и врать наугад хуже, чем оставить прежнюю метку.
 */
export function detectTranslationLang(texts: (string | null | undefined)[]): TranslationLang | null {
  const body = texts.filter(Boolean).join(" ");
  const { uk, ru } = langMarks(body);

  if (uk === 0 && ru === 0) return null;
  return uk > ru ? "UK" : "RU";
}

/**
 * Язык страницы: по тексту, а при неясности — по сохранённой метке.
 *
 * Отдельной функцией, потому что этот порядок важнее самого подсчёта:
 * тексту верим всегда, метке — только когда текст молчит.
 */
export function pageTranslationLang(
  texts: (string | null | undefined)[],
  stored: TranslationLang,
): TranslationLang {
  return detectTranslationLang(texts) ?? stored;
}
