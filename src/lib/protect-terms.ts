/**
 * Защита английских слов внутри пояснения от перевода.
 *
 * Правило про предлог «on» объясняется по-украински, но сам предлог —
 * это предмет разговора, а не слово из текста. Переводчик этого не знает
 * и честно превращает «on означає на поверхні» в «на означає на поверхні»,
 * после чего правило теряет смысл.
 *
 * Поэтому латинские куски внутри кириллического текста помечаются тегом,
 * а переводчику говорят этот тег не трогать. Сплошной английский текст
 * не трогаем вовсе: это пример, который как раз и надо перевести.
 */

const CYRILLIC = /[Ѐ-ӿ]/;

/**
 * Английский кусок: слово или несколько подряд, включая «V3», «-s»,
 * «doesn't» и перечисления через косую черту.
 */
const TERM = /-?[A-Za-z][A-Za-z0-9'’]*(?:[ \t]*[/–—-][ \t]*[A-Za-z0-9'’-]+|[ \t]+[A-Za-z][A-Za-z0-9'’]*)*/g;

/** Тег выбран коротким и таким, какого в учебном тексте не бывает. */
export const KEEP_TAG = "k";

const escapeXml = (text: string) =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const unescapeXml = (text: string) =>
  text.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");

/** Нужна ли этому тексту защита: есть и кириллица, и латиница. */
export function needsProtection(text: string): boolean {
  return CYRILLIC.test(text) && /[A-Za-z]/.test(text);
}

/**
 * Обернуть английские куски тегом, остальное — экранировать.
 *
 * Экранируем всегда, даже когда оборачивать нечего: переводчик получает
 * всю пачку в одном режиме, и текст без тегов должен быть таким же
 * безопасным, как текст с тегами.
 */
export function protectTerms(text: string): string {
  const escaped = escapeXml(text);
  if (!needsProtection(text)) return escaped;
  return escaped.replace(TERM, (term) => `<${KEEP_TAG}>${term}</${KEEP_TAG}>`);
}

/** Снять теги и экранирование с переведённого текста. */
export function restoreTerms(text: string): string {
  return unescapeXml(
    text.replace(new RegExp(`</?${KEEP_TAG}\\s*/?>`, "gi"), ""),
  );
}
