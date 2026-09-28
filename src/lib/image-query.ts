/**
 * Из словарной записи — в поисковый запрос для картинок.
 *
 * Фраза из словника почти никогда не годится как запрос: «to get on
 * (with) somebody» ничего не найдёт, а «a piece of cake» найдёт кусок
 * торта вместо «проще простого». Поэтому запрос собирается отдельно, и
 * собирается здесь — это чистая работа со строкой, её и проверяем.
 */

/** Слова, которые не сужают поиск, а только сбивают его. */
const NOISE = new Set([
  "a", "an", "the", "to", "of", "in", "on", "at", "by", "for", "with", "from",
  "into", "onto", "about", "over", "under", "up", "down", "out", "off", "away",
  "and", "or", "but", "so", "as", "than", "that", "this", "these", "those",
  "be", "is", "are", "was", "were", "been", "being", "am",
  "do", "does", "did", "have", "has", "had",
  "it", "its", "he", "she", "they", "them", "his", "her", "their",
  "one", "ones", "some", "any", "very", "too", "not",
]);

/** Заглушки вроде sb/sth: они стоят вместо слова, картинку по ним не найти. */
const PLACEHOLDERS = new Set([
  "sb", "sth", "smb", "smth", "somebody", "someone", "something",
  "oneself", "yourself", "myself", "himself", "herself", "themselves",
  "one's", "ones", "sb's", "sth's",
]);

/** Сколько слов отдавать поиску: длинный запрос у Pixabay находит ноль. */
const MAX_WORDS = 3;

/**
 * Запрос по английской фразе.
 *
 * Пустая строка означает «искать не по чему»: так бывает, когда от
 * фразы после чистки остаются одни служебные слова.
 */
export function imageQuery(phrase: string): string {
  const cleaned = String(phrase ?? "")
    .toLowerCase()
    // Пояснение в скобках — не часть выражения: «on the left (side)».
    .replace(/\([^)]*\)/g, " ")
    // Из «hello / hi» берём первый вариант: искать надо что-то одно.
    .split("/")[0]
    .replace(/[^a-z\s'’-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!cleaned) return "";

  const words = cleaned
    .split(" ")
    .map((w) => w.replace(/^['’-]+|['’-]+$/g, ""))
    .filter(Boolean)
    .filter((w) => !PLACEHOLDERS.has(w));

  // Значимые слова важнее служебных, но если значимых не осталось —
  // лучше поискать хоть по чему-то, чем не искать вовсе.
  const meaningful = words.filter((w) => !NOISE.has(w));
  const chosen = meaningful.length > 0 ? meaningful : words;

  return chosen.slice(0, MAX_WORDS).join(" ");
}

/** Теги, по которым видно, что на картинке написан текст. */
const TEXT_TAGS = [
  "text", "typography", "font", "letter", "letters", "alphabet", "word",
  "words", "sign", "signage", "banner", "poster", "quote", "quotes",
  "calligraphy", "lettering", "handwriting", "writing", "written",
  "label", "logo", "title", "caption", "message", "note", "book cover",
];

/**
 * Написано ли на картинке слово.
 *
 * Полной гарантии теги не дают, но именно ради этого правила подборка и
 * фильтруется: картинка с подписанным ответом делает игру бессмысленной.
 */
export function looksLikeText(tags: string): boolean {
  const list = String(tags ?? "")
    .toLowerCase()
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);

  return list.some((tag) => TEXT_TAGS.includes(tag));
}

export type ImageCandidate = {
  url: string;
  thumbUrl: string;
  tags: string;
  /** Чем чаще картинку берут, тем она обычно понятнее. */
  popularity: number;
};

/** Сколько первых тегов считаем описанием того, что на картинке. */
const LEAD_TAGS = 3;

/**
 * Насколько картинка про запрошенное слово.
 *
 * Теги идут по важности: первые описывают, что на картинке, дальше —
 * что рядом. Поэтому «fork» первым тегом — это вилка, а «fork» девятым
 * тегом — чаще торт, который ею едят. Без этого поиск по короткому
 * слову отдаёт красивые снимки не про то.
 */
export function relevance(tags: string, query: string): number {
  const list = String(tags ?? "")
    .toLowerCase()
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);

  const words = String(query ?? "").toLowerCase().split(" ").filter(Boolean);
  if (words.length === 0 || list.length === 0) return 0;

  const lead = list.slice(0, LEAD_TAGS);

  return words.reduce((score, word) => {
    const inLead = lead.some((tag) => tag === word || tag.split(" ").includes(word));
    if (inLead) return score + 2;
    const anywhere = list.some((tag) => tag === word || tag.split(" ").includes(word));
    return anywhere ? score + 1 : score;
  }, 0);
}

/**
 * Отбор картинок под слово.
 *
 * Сначала выкидываем те, где, судя по тегам, написан текст. Оставшиеся
 * сортируем по тому, насколько они про само слово, и только потом — по
 * популярности. Если чистых не набралось, возвращаем что было: пустая
 * подборка хуже несовершенной — учитель всё равно смотрит на неё глазами.
 */
export function pickCandidates(
  results: ImageCandidate[],
  limit = 3,
  query = "",
): ImageCandidate[] {
  const better = (a: ImageCandidate, b: ImageCandidate) =>
    relevance(b.tags, query) - relevance(a.tags, query) || b.popularity - a.popularity;

  const clean = results.filter((r) => !looksLikeText(r.tags)).sort(better);
  if (clean.length >= limit) return clean.slice(0, limit);

  const rest = results
    .filter((r) => !clean.includes(r))
    .sort(better)
    .slice(0, limit - clean.length);

  return [...clean, ...rest];
}
