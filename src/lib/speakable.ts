/**
 * Что на странице имеет смысл озвучивать.
 *
 * Кнопка звука раньше появлялась только у одиночного слова, и обороты
 * вроде «in front of», «next to», «on the left (side)» оставались немыми —
 * а это ровно то, что ученику и надо услышать. Поэтому берём любой
 * английский текст: слово, оборот или целое предложение.
 *
 * Не озвучиваем перевод (узнаём по кириллице), транскрипции в косых
 * чертах и скобках, и всё, в чём букв вовсе нет.
 */

const CYRILLIC = /[Ѐ-ӿ]/;
const LATIN = /[A-Za-z]/;
const TRANSCRIPTION = /^\/.*\/$|^\[.*\]$/;

/** Верхняя граница: длиннее этого на странице не текст, а абзац. */
const MAX_LENGTH = 160;

export function speakable(cell: string): string | null {
  const text = cell.trim();
  if (text.length < 2 || text.length > MAX_LENGTH) return null;
  if (CYRILLIC.test(text)) return null;
  if (!LATIN.test(text)) return null;
  if (TRANSCRIPTION.test(text)) return null;
  return text;
}
