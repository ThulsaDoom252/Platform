/**
 * Подбор иконки по названию — для папок, страниц и слов словника.
 *
 * Работает на той же базе иконок, что и ручной выбор: у каждой прописаны
 * ключевые слова по-русски и по-английски. Украинский близок к русскому,
 * поэтому сравниваем по основе слова, а несколько характерных отличий
 * («одяг», «взуття», «їжа») добавлены отдельным списком.
 */
import { ALL_ICONS } from "./icons-data";

/** Украинские слова, которые на русскую основу не похожи. */
const UK_HINTS: Record<string, string> = {
  одяг: "одежда",
  взуття: "обувь",
  їжа: "еда",
  напої: "напитки",
  подорож: "путешествия",
  подорожі: "путешествия",
  тварини: "животные",
  птахи: "птица",
  робота: "работа",
  гроші: "деньги",
  здоров: "здоровье",
  погода: "погода",
  місто: "город",
  будинок: "дом",
  школа: "школа",
  книга: "книга",
  книжка: "книга",
  слова: "слово",
  фрази: "фраза",
  правила: "правило",
  помилки: "ошибка",
  час: "время",
  числа: "число",
  кольори: "цвет",
  сім: "семья",
  друзі: "друг",
  спорт: "спорт",
  музика: "музыка",
  фільми: "кино",
  навчання: "учёба",
  вправи: "практика",
  дієслова: "глагол",
  іменники: "существительное",
  прикметники: "прилагательное",
  прислівники: "наречие",
};

/** Слова, которые ничего не говорят о смысле. */
const STOP = new Set([
  "the", "and", "for", "with", "vs", "или", "и", "для", "та", "і",
  "part", "часть", "частина", "basics", "основы", "основи",
]);

/** Основа слова: отбрасываем типовые окончания, чтобы «слова» нашли «слово». */
function stem(word: string): string {
  return word
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "")
    .replace(/(ами|ями|ов|ев|ей|ах|ях|и|ы|а|я|у|ю|е|і|ї|s|es)$/u, "");
}

function tokens(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((w) => w.length > 1 && !STOP.has(w));
}

/**
 * Иконка, лучше всего подходящая названию. Возвращает null, если
 * ничего похожего нет — навязывать случайный значок хуже, чем не предлагать.
 */
export function suggestIcon(name: string): string | null {
  const words = tokens(name);
  if (words.length === 0) return null;

  // Украинские подсказки переводим в привычные парсеру основы.
  const wanted = words.flatMap((w) => {
    const hint = Object.keys(UK_HINTS).find((k) => w.startsWith(k));
    return hint ? [w, UK_HINTS[hint]] : [w];
  });
  // Короткие основы тоже нужны: «їжа» после отсечения окончания — «їж».
  const stems = wanted.map(stem).filter((s) => s.length >= 2);
  if (stems.length === 0) return null;

  let best: { icon: string; score: number } | null = null;

  for (const [icon, keywords] of ALL_ICONS) {
    const keys = keywords.split(/\s+/);
    let score = 0;

    for (const s of stems) {
      for (const k of keys) {
        const ks = stem(k);
        if (!ks) continue;
        // Точное совпадение основы весомее, чем просто общее начало.
        if (ks === s) score += 3;
        else if (ks.startsWith(s) || s.startsWith(ks)) score += 1;
      }
    }

    if (score > 0 && (!best || score > best.score)) best = { icon, score };
  }

  return best && best.score >= 2 ? best.icon : null;
}
