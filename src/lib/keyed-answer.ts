/**
 * Очистка ответа модели до чистого исходника.
 *
 * Просьба «ничего, кроме формата» выполняется не всегда: приходят
 * вступления вроде «Ось ваш матеріал:» и тройные кавычки вокруг текста.
 * Парсеру это мусор, поэтому срезаем его здесь, а не надеемся на
 * послушность модели.
 */

const START = /^TYPE:\s*(VOCAB|RULE|LEXIS|TENSE)\b/m;

/** Убирает обёртки и всё, что стоит до объявления типа. */
export function cleanKeyedAnswer(raw: string): string {
  let text = String(raw ?? "").trim();

  const fence = text.match(/^```[a-z]*\s*\n([\s\S]*?)\n?```$/i);
  if (fence) text = fence[1].trim();

  const start = text.search(START);
  if (start > 0) text = text.slice(start);

  // Хвост после материала: «Готово!», подписи и тому подобное.
  text = text.replace(/\n```\s*$/i, "");

  return text.trim();
}

/** Похоже ли это на наш исходник вообще. */
export function looksKeyed(text: string): boolean {
  return START.test(text);
}
