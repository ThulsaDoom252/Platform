/**
 * Порядок учеников на экране класса.
 *
 * По умолчанию он идёт от расписания: сегодняшние занятия списком,
 * следом завтрашние и так до конца недели. Так экран отвечает на вопрос
 * «с кем я сейчас работаю», а не «кто у меня вообще есть».
 *
 * Считает только порядок, поэтому живёт отдельно от разметки и
 * проверяется тестами: день и часовой пояс — то место, где ошибка
 * заметна лишь на живом расписании.
 */

export type ClassSortKey = "lessons" | "name" | "balance";
export const CLASS_SORTS: ClassSortKey[] = ["lessons", "name", "balance"];

export type Orderable = {
  id: string;
  name: string;
  /** Остаток уроков — по нему сортируют, когда решают, кому напомнить. */
  balance: number;
  /** Ближайшее занятие. Пусто — уроков впереди нет. */
  nextLessonAt: string | null;
};

/** Группа списка: день и те, у кого в этот день занятие. */
export type ClassGroup<T> = {
  /** Начало дня в ISO. Пусто — «без занятий на этой неделе». */
  day: string | null;
  people: T[];
};

const DAY_MS = 24 * 60 * 60 * 1000;

function startOfDay(date: Date): Date {
  const out = new Date(date);
  out.setHours(0, 0, 0, 0);
  return out;
}

/** Сколько дней осталось до конца недели, считая сегодняшний. */
export function daysLeftInWeek(now: Date): number {
  // Неделя кончается воскресеньем: понедельник даёт семь дней, воскресенье — один.
  const weekday = (now.getDay() + 6) % 7;
  return 7 - weekday;
}

/**
 * Разложить учеников по дням недели.
 *
 * Дни без занятий пропускаются — пустая строка «среда» на экране только
 * мешает. Те, у кого на этой неделе занятий нет, уходят в последнюю
 * группу: они никуда не деваются, просто не занимают начало списка.
 */
export function groupByDay<T extends Orderable>(
  people: T[],
  now: Date = new Date(),
): ClassGroup<T>[] {
  const today = startOfDay(now);
  const days = daysLeftInWeek(now);
  const weekEnd = new Date(today.getTime() + days * DAY_MS);

  const groups: ClassGroup<T>[] = [];
  const placed = new Set<string>();

  for (let i = 0; i < days; i += 1) {
    const from = new Date(today.getTime() + i * DAY_MS);
    const to = new Date(from.getTime() + DAY_MS);

    const ofDay = people
      .filter((person) => {
        if (!person.nextLessonAt) return false;
        const at = new Date(person.nextLessonAt).getTime();
        return at >= from.getTime() && at < to.getTime();
      })
      .sort(
        (a, b) =>
          new Date(a.nextLessonAt!).getTime() - new Date(b.nextLessonAt!).getTime(),
      );

    if (ofDay.length === 0) continue;

    for (const person of ofDay) placed.add(person.id);
    groups.push({ day: from.toISOString(), people: ofDay });
  }

  // Остальные — и те, у кого урок позже этой недели, и те, у кого его нет.
  const rest = people.filter((person) => {
    if (placed.has(person.id)) return false;
    if (!person.nextLessonAt) return true;
    return new Date(person.nextLessonAt).getTime() >= weekEnd.getTime();
  });

  if (rest.length > 0) {
    groups.push({ day: null, people: sortBy(rest, "name", false) });
  }

  return groups;
}

/** Плоская сортировка — когда порядок не от расписания. */
export function sortBy<T extends Orderable>(
  people: T[],
  key: ClassSortKey,
  desc: boolean,
  locale?: string,
): T[] {
  const collator = new Intl.Collator(locale, { sensitivity: "base" });

  const compare = (a: T, b: T): number => {
    if (key === "balance") {
      // При равном остатке порядок всё равно должен быть предсказуемым.
      return a.balance - b.balance || collator.compare(a.name, b.name);
    }
    if (key === "lessons") {
      // Без урока — в конец при любом направлении: «скоро» их не касается.
      if (!a.nextLessonAt && !b.nextLessonAt) return collator.compare(a.name, b.name);
      if (!a.nextLessonAt) return 1;
      if (!b.nextLessonAt) return -1;
      return (
        new Date(a.nextLessonAt).getTime() - new Date(b.nextLessonAt).getTime()
      );
    }
    return collator.compare(a.name, b.name);
  };

  return people.slice().sort((a, b) => {
    const by = compare(a, b);
    // Безурочных не переворачиваем: иначе они возглавили бы список.
    if (key === "lessons" && (!a.nextLessonAt || !b.nextLessonAt)) return by;
    return desc ? -by : by;
  });
}

/**
 * Готовый порядок для экрана.
 *
 * По расписанию — с разбивкой по дням, по имени и остатку — одним
 * списком: делить их по дням незачем, там другой вопрос.
 */
export function orderClassPeople<T extends Orderable>(
  people: T[],
  key: ClassSortKey,
  desc: boolean,
  now: Date = new Date(),
  locale?: string,
): ClassGroup<T>[] {
  if (key !== "lessons") return [{ day: null, people: sortBy(people, key, desc, locale) }];

  const groups = groupByDay(people, now);
  return desc ? groups.slice().reverse() : groups;
}
