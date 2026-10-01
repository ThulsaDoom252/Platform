/**
 * Порядок учеников на экране класса.
 *
 * По умолчанию он идёт от расписания: сегодняшние занятия списком,
 * следом завтрашние и так до конца недели. Так экран отвечает на вопрос
 * «с кем я сейчас работаю», а не «кто у меня вообще есть».
 *
 * Группируются именно занятия, а не ученики: у одного человека за
 * неделю их несколько, и он должен стоять в каждом своём дне. Список
 * «по одному ближайшему уроку» показывал бы неделю в два дня.
 *
 * Считает только порядок, поэтому живёт отдельно от разметки и
 * проверяется тестами: день и часовой пояс — то место, где ошибка
 * заметна лишь на живом расписании.
 */
import { scheduleNow } from "@/lib/schedule-time";

export type ClassSortKey = "lessons" | "name" | "balance";
export const CLASS_SORTS: ClassSortKey[] = ["lessons", "name", "balance"];

/** Занятие: когда началось и сколько длится. */
export type Lesson = { at: string; minutes: number };

export type Orderable = {
  id: string;
  name: string;
  /** Остаток уроков — по нему сортируют, когда решают, кому напомнить. */
  balance: number;
  /** Все назначенные занятия на эту неделю, от раннего к позднему. */
  lessons: Lesson[];
};

/**
 * Кружок в списке: ученик и занятие, из-за которого он здесь.
 *
 * `parts` — сколько уроков расписания слилось в этот блок. Два и больше
 * значит сдвоенное занятие.
 */
export type ClassEntry<T> = {
  person: T;
  at: string | null;
  minutes: number;
  parts: number;
};

/** Склеенный блок занятий. */
export type LessonBlock = Lesson & { parts: number };

/**
 * Свести идущие подряд уроки в одно занятие.
 *
 * Два урока встык — это одно длинное занятие, а не два визита: ученик
 * приходит один раз. Показывать его двумя кружками в одном дне значит
 * говорить, что встреч будет две.
 *
 * Склеиваем, только когда между ними нет промежутка: урок в девять и
 * урок в три часа дня — разные занятия, сколько бы их ни было в один
 * день.
 */
export function mergeAdjacent(lessons: Lesson[]): LessonBlock[] {
  const sorted = lessons
    .slice()
    .sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());

  const blocks: LessonBlock[] = [];

  for (const lesson of sorted) {
    const last = blocks.at(-1);
    const startsAt = new Date(lesson.at).getTime();

    if (last) {
      const endsAt = new Date(last.at).getTime() + last.minutes * 60000;
      // Встык или внахлёст — продолжение того же занятия.
      if (startsAt <= endsAt) {
        const finish = Math.max(endsAt, startsAt + lesson.minutes * 60000);
        last.minutes = Math.round((finish - new Date(last.at).getTime()) / 60000);
        last.parts += 1;
        continue;
      }
    }

    blocks.push({ at: lesson.at, minutes: lesson.minutes, parts: 1 });
  }

  return blocks;
}

/** Группа списка: день и занятия этого дня. */
export type ClassGroup<T> = {
  /** Начало дня в ISO. Пусто — «без занятий на этой неделе». */
  day: string | null;
  entries: ClassEntry<T>[];
};

const DAY_MS = 24 * 60 * 60 * 1000;

function startOfDay(date: Date): Date {
  const out = new Date(date);
  out.setUTCHours(0, 0, 0, 0);
  return out;
}

/** Сколько дней осталось до конца недели, считая сегодняшний. */
export function daysLeftInWeek(now: Date): number {
  // Неделя кончается воскресеньем: понедельник даёт семь дней, воскресенье — один.
  const weekday = (now.getUTCDay() + 6) % 7;
  return 7 - weekday;
}

/** Ближайшее занятие — по нему сортируют плоские списки. */
export function nextLessonOf(person: Orderable): string | null {
  return person.lessons[0]?.at ?? null;
}

/**
 * Разложить занятия по дням недели.
 *
 * Дни без занятий пропускаются — пустая строка «среда» на экране только
 * мешает. Те, у кого на этой неделе занятий нет, уходят в последнюю
 * группу: они никуда не деваются, просто не занимают начало списка.
 */
export function groupByDay<T extends Orderable>(
  people: T[],
  now: Date = scheduleNow(),
): ClassGroup<T>[] {
  const today = startOfDay(now);
  const days = daysLeftInWeek(now);
  const weekEnd = new Date(today.getTime() + days * DAY_MS);

  /*
   * Раскладываем все занятия недели разом: так ученик попадает в каждый
   * свой день, а не только в ближайший. Идущие подряд уроки сводим в
   * одно занятие — это один визит, а не два.
   */
  const occurrences = people.flatMap((person) =>
    mergeAdjacent(person.lessons)
      .map((block) => ({ person, block, time: new Date(block.at).getTime() }))
      .filter(
        (row) => row.time >= today.getTime() && row.time < weekEnd.getTime(),
      ),
  );

  const groups: ClassGroup<T>[] = [];
  const busy = new Set<string>();

  for (let i = 0; i < days; i += 1) {
    const from = today.getTime() + i * DAY_MS;
    const to = from + DAY_MS;

    const ofDay = occurrences
      .filter((row) => row.time >= from && row.time < to)
      .sort((a, b) => a.time - b.time);

    if (ofDay.length === 0) continue;

    for (const row of ofDay) busy.add(row.person.id);
    groups.push({
      day: new Date(from).toISOString(),
      entries: ofDay.map((row) => ({
        person: row.person,
        at: row.block.at,
        minutes: row.block.minutes,
        parts: row.block.parts,
      })),
    });
  }

  const rest = people.filter((person) => !busy.has(person.id));
  if (rest.length > 0) {
    groups.push({
      day: null,
      entries: sortBy(rest, "name", false).map((person) => ({
        person,
        at: null,
        minutes: 0,
        parts: 0,
      })),
    });
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
      const first = nextLessonOf(a);
      const second = nextLessonOf(b);
      // Без урока — в конец при любом направлении: «скоро» их не касается.
      if (!first && !second) return collator.compare(a.name, b.name);
      if (!first) return 1;
      if (!second) return -1;
      return new Date(first).getTime() - new Date(second).getTime();
    }
    return collator.compare(a.name, b.name);
  };

  return people.slice().sort((a, b) => {
    const by = compare(a, b);
    // Безурочных не переворачиваем: иначе они возглавили бы список.
    if (key === "lessons" && (!nextLessonOf(a) || !nextLessonOf(b))) return by;
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
  if (key !== "lessons") {
    return [
      {
        day: null,
        entries: sortBy(people, key, desc, locale).map((person) => ({
          person,
          at: null,
          minutes: 0,
          parts: 0,
        })),
      },
    ];
  }

  const groups = groupByDay(people, now);
  return desc ? groups.slice().reverse() : groups;
}
