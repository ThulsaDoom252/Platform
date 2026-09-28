/**
 * Что переносится на новые записи словника при перестройке страницы.
 *
 * Наполнение и переформатирование стирают фразы и создают их заново из
 * исходного текста. Картинки лежат отдельной таблицей и уходят вместе со
 * старыми строками — а их учитель подбирал руками, по одной. Терять эту
 * работу при каждой правке исходника нельзя.
 *
 * Поэтому перед заменой снимаем картинки, а после — возвращаем тем
 * словам, которые остались на странице. Сопоставляем по самому слову:
 * идентификаторы у новых записей другие, а слово то же.
 */

export type CarryPhrase = { id: string; phrase: string };
export type CarryImage = {
  phraseId: string;
  url: string;
  thumbUrl: string | null;
  origin: string;
  sortOrder: number;
  picked: boolean;
};

/**
 * Ключ сопоставления: слово без регистра, лишних пробелов и обрамляющих
 * знаков. «To Sneeze» и «to sneeze  » — одно и то же слово.
 */
export function carryKey(phrase: string): string {
  return String(phrase ?? "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/^[\s"'«»„“”]+|[\s"'«»„“”.,;:!?]+$/g, "")
    .trim();
}

/**
 * Куда переложить снятые картинки.
 *
 * Возвращает готовые строки для вставки. Слова, которых на странице не
 * осталось, отбрасываются вместе со своими картинками: держать их
 * привязанными не к чему.
 *
 * Если одно и то же слово встречается дважды, картинки достаются
 * первому — дублировать их по всем копиям значило бы размножать выбор,
 * которого учитель не делал.
 */
export function carryImages(
  oldPhrases: CarryPhrase[],
  images: CarryImage[],
  newPhrases: CarryPhrase[],
): CarryImage[] {
  const wordOf = new Map(oldPhrases.map((p) => [p.id, carryKey(p.phrase)]));

  const target = new Map<string, string>();
  for (const p of newPhrases) {
    const key = carryKey(p.phrase);
    if (key && !target.has(key)) target.set(key, p.id);
  }

  const out: CarryImage[] = [];
  for (const image of images) {
    const key = wordOf.get(image.phraseId);
    const to = key ? target.get(key) : undefined;
    if (!to) continue;
    out.push({ ...image, phraseId: to });
  }

  return out;
}
