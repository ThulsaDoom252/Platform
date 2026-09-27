/**
 * Пул скороговорок: порядок и предупреждение о повторе.
 *
 * Вынесено из разметки, потому что ошибается здесь именно счёт, а не
 * вёрстка: перестановка перетаскиванием и подсчёт «сколько раз уже
 * давал» — то, что нужно проверять тестами.
 */

export type TwisterOrderItem = { id: string; sortOrder: number; createdAt: string };

/** Как показывать пул. */
export type TwisterView = "grid" | "list" | "large";
export const TWISTER_VIEWS: TwisterView[] = ["grid", "list", "large"];

/** Чем сортировать. «manual» — тот порядок, что учитель выставил руками. */
export type TwisterSort = "manual" | "newest" | "title";
export const TWISTER_SORTS: TwisterSort[] = ["manual", "newest", "title"];

/**
 * Перестановка элемента списка.
 *
 * Возвращает новый порядок id. Индексы за пределами списка оставляют
 * его нетронутым: при промахе мимо цели порядок не должен меняться.
 */
export function moveItem<T>(items: T[], from: number, to: number): T[] {
  if (from === to) return items.slice();
  if (from < 0 || from >= items.length) return items.slice();
  if (to < 0 || to >= items.length) return items.slice();

  const next = items.slice();
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}

/**
 * Порядок пула для показа.
 *
 * Ручной порядок — основной: учитель раскладывает карточки так, как
 * идёт по ним на уроке. Остальные режимы ничего не записывают, они
 * только меняют вид.
 */
export function sortTwisters<T extends { sortOrder: number; createdAt: string; title: string | null }>(
  items: T[],
  sort: TwisterSort,
): T[] {
  const list = items.slice();

  if (sort === "newest") {
    return list.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  if (sort === "title") {
    // Безымянные уходят вниз: иначе они занимают всё начало списка.
    return list.sort((a, b) => {
      if (!a.title && !b.title) return a.sortOrder - b.sortOrder;
      if (!a.title) return 1;
      if (!b.title) return -1;
      return a.title.localeCompare(b.title, undefined, { sensitivity: "base" });
    });
  }

  return list.sort(
    (a, b) => a.sortOrder - b.sortOrder || b.createdAt.localeCompare(a.createdAt),
  );
}

export type TwisterSeen = { times: number; lastAt: string | null };

/**
 * Нужно ли предупредить, что эта скороговорка у ученика уже была.
 *
 * Возвращает null, когда её не давали: нечего и говорить. Само
 * сообщение собирает страница — язык знает она, а не эта функция.
 */
export function repeatWarning(seen: TwisterSeen | undefined): TwisterSeen | null {
  if (!seen || seen.times <= 0) return null;
  return { times: seen.times, lastAt: seen.lastAt };
}
