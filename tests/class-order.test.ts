import { test } from "node:test";
import assert from "node:assert/strict";
import {
  daysLeftInWeek,
  groupByDay,
  mergeAdjacent,
  nextLessonOf,
  orderClassPeople,
  sortBy,
  type Orderable,
} from "../src/lib/class-order";

/** Понедельник, 28 сентября 2026, десять утра. */
const MONDAY = new Date(2026, 8, 28, 10, 0, 0);

/** Урок по умолчанию длится час — как в расписании. */
const at = (day: number, hour: number, minutes = 60) => ({
  at: new Date(2026, 8, day, hour, 0, 0).toISOString(),
  minutes,
});

const person = (
  id: string,
  name: string,
  lessons: { at: string; minutes: number }[],
  balance = 5,
): Orderable => ({ id, name, balance, lessons });

/** Имена в группе — с ними проверки читаются короче. */
const names = <T extends Orderable>(group: { entries: { person: T }[] }) =>
  group.entries.map((e) => e.person.name);

test("до конца недели считаются оставшиеся дни, включая сегодня", () => {
  assert.equal(daysLeftInWeek(new Date(2026, 8, 28)), 7); // понедельник
  assert.equal(daysLeftInWeek(new Date(2026, 9, 2)), 3); // пятница
  assert.equal(daysLeftInWeek(new Date(2026, 9, 4)), 1); // воскресенье
});

test("ученик стоит в каждом своём дне, а не только в ближайшем", () => {
  /*
   * Из-за этого неделя и схлопывалась в два дня: брался один ближайший
   * урок, и человек с занятиями в понедельник и среду попадал только в
   * понедельник.
   */
  const people = [
    person("v", "Victoria", [at(28, 17), at(29, 17), at(30, 17)]),
    person("k", "Ksenia", [at(28, 9)]),
  ];

  const groups = groupByDay(people, MONDAY);

  assert.equal(groups.length, 3);
  assert.deepEqual(names(groups[0]), ["Ksenia", "Victoria"]);
  assert.deepEqual(names(groups[1]), ["Victoria"]);
  assert.deepEqual(names(groups[2]), ["Victoria"]);
});

test("вся неделя видна целиком", () => {
  const people = [
    person("a", "Alla", [at(28, 9), at(29, 9), at(30, 9), at(31, 9)]),
    person("b", "Bogdan", [at(32, 9), at(33, 9), at(34, 9)]),
  ];

  const groups = groupByDay(people, MONDAY);

  // Понедельник … воскресенье: семь дней, и ни один не потерян.
  assert.equal(groups.filter((g) => g.day).length, 7);
});

test("в каждом дне показывается время именно этого занятия", () => {
  const people = [person("v", "Victoria", [at(28, 17), at(29, 11)])];
  const groups = groupByDay(people, MONDAY);

  assert.equal(groups[0].entries[0].at, at(28, 17).at);
  assert.equal(groups[1].entries[0].at, at(29, 11).at);
});

test("внутри дня — по времени урока, а не по имени", () => {
  const groups = groupByDay(
    [
      person("c", "Ksenia", [at(28, 15)]),
      person("b", "Bogdan", [at(28, 9)]),
      person("a", "Alla", [at(28, 12)]),
    ],
    MONDAY,
  );

  assert.deepEqual(names(groups[0]), ["Bogdan", "Alla", "Ksenia"]);
});

test("дни без занятий в списке не появляются", () => {
  const groups = groupByDay(
    [person("a", "Alla", [at(28, 9)]), person("b", "Bogdan", [at(30, 9)])],
    MONDAY,
  );

  // Вторник пустой — между понедельником и средой его нет.
  assert.equal(groups.length, 2);
  assert.equal(new Date(groups[0].day!).getDate(), 28);
  assert.equal(new Date(groups[1].day!).getDate(), 30);
});

test("снятый с расписания уходит в «без занятий»", () => {
  const withLesson = [person("a", "Alla", [at(28, 9)])];
  assert.equal(groupByDay(withLesson, MONDAY)[0].day !== null, true);

  // Тот же ученик после отмены урока: остаётся на экране, но в конце.
  const without = [person("a", "Alla", [])];
  const groups = groupByDay(without, MONDAY);
  assert.equal(groups.length, 1);
  assert.equal(groups[0].day, null);
  assert.deepEqual(names(groups[0]), ["Alla"]);
});

test("без уроков на этой неделе — в последнюю группу, по имени", () => {
  const groups = groupByDay(
    [
      person("z", "Zoryana", []),
      person("a", "Alla", [at(28, 9)]),
      person("o", "Oksana", []),
      // Урок есть, но уже на следующей неделе.
      person("n", "Nazar", [at(35, 9)]),
    ],
    MONDAY,
  );

  const last = groups.at(-1)!;
  assert.equal(last.day, null);
  assert.deepEqual(names(last), ["Nazar", "Oksana", "Zoryana"]);
});

test("неделя обрывается воскресеньем", () => {
  // В пятницу видно пятницу, субботу и воскресенье — понедельник уже нет.
  const friday = new Date(2026, 9, 2, 10, 0, 0);
  const groups = groupByDay(
    [
      person("a", "Alla", [at(32, 9)]), // 2 октября, пятница
      person("s", "Sofia", [at(34, 9)]), // 4 октября, воскресенье
      person("m", "Maria", [at(35, 9)]), // 5 октября, понедельник
    ],
    friday,
  );

  assert.equal(groups.filter((g) => g.day).length, 2);
  assert.deepEqual(names(groups.at(-1)!), ["Maria"]);
});

test("прошедшее сегодня занятие день не занимает", () => {
  // Список строится от начала дня, поэтому утренний урок виден и в обед.
  const groups = groupByDay([person("k", "Ksenia", [at(28, 9)])], MONDAY);
  assert.equal(groups[0].entries.length, 1);
});

test("ближайшее занятие — первое из списка", () => {
  assert.equal(nextLessonOf(person("a", "Alla", [at(28, 9), at(29, 9)])), at(28, 9).at);
  assert.equal(nextLessonOf(person("b", "Bogdan", [])), null);
});

test("по имени — в обе стороны", () => {
  const people = [
    person("b", "Bogdan", []),
    person("a", "Alla", []),
    person("k", "Ksenia", []),
  ];

  assert.deepEqual(sortBy(people, "name", false).map((p) => p.name), [
    "Alla",
    "Bogdan",
    "Ksenia",
  ]);
  assert.deepEqual(sortBy(people, "name", true).map((p) => p.name), [
    "Ksenia",
    "Bogdan",
    "Alla",
  ]);
});

test("по остатку — в обе стороны, при равенстве по имени", () => {
  const people = [
    person("b", "Bogdan", [], 10),
    person("a", "Alla", [], 2),
    person("k", "Ksenia", [], 2),
  ];

  assert.deepEqual(sortBy(people, "balance", false).map((p) => p.name), [
    "Alla",
    "Ksenia",
    "Bogdan",
  ]);
  assert.deepEqual(sortBy(people, "balance", true).map((p) => p.name), [
    "Bogdan",
    "Ksenia",
    "Alla",
  ]);
});

test("сортировка не портит исходный список", () => {
  const people = [person("b", "Bogdan", []), person("a", "Alla", [])];
  sortBy(people, "name", false);
  assert.deepEqual(people.map((p) => p.name), ["Bogdan", "Alla"]);
});

test("по имени и остатку список не делится по дням", () => {
  const people = [person("a", "Alla", [at(28, 9)]), person("b", "Bogdan", [at(29, 9)])];

  const byName = orderClassPeople(people, "name", false, MONDAY);
  assert.equal(byName.length, 1);
  assert.equal(byName[0].day, null);
  assert.equal(byName[0].entries.length, 2);
});

test("обратный порядок расписания переворачивает дни, а не людей внутри дня", () => {
  const people = [
    person("a", "Alla", [at(28, 15)]),
    person("b", "Bogdan", [at(28, 9)]),
    person("k", "Ksenia", [at(29, 9)]),
  ];

  const groups = orderClassPeople(people, "lessons", true, MONDAY);

  assert.equal(new Date(groups[0].day!).getDate(), 29);
  assert.deepEqual(names(groups[1]), ["Bogdan", "Alla"]);
});

test("пустой список не падает", () => {
  assert.deepEqual(groupByDay([], MONDAY), []);
  assert.deepEqual(orderClassPeople([], "name", false, MONDAY), [
    { day: null, entries: [] },
  ]);
});

test("два урока встык — одно занятие", () => {
  /*
   * Ученик приходит один раз, а не дважды. Два кружка в одном дне
   * говорили бы, что встреч будет две.
   */
  const blocks = mergeAdjacent([at(29, 9), at(29, 10)]);

  assert.equal(blocks.length, 1);
  assert.equal(blocks[0].at, at(29, 9).at);
  assert.equal(blocks[0].minutes, 120);
  assert.equal(blocks[0].parts, 2);
});

test("три урока подряд — тоже одно", () => {
  const blocks = mergeAdjacent([at(29, 9), at(29, 10), at(29, 11)]);
  assert.equal(blocks.length, 1);
  assert.equal(blocks[0].minutes, 180);
  assert.equal(blocks[0].parts, 3);
});

test("уроки с перерывом остаются разными занятиями", () => {
  // Девять утра и три часа дня — это два визита, а не длинный урок.
  const blocks = mergeAdjacent([at(29, 9), at(29, 15)]);
  assert.equal(blocks.length, 2);
  assert.equal(blocks[0].parts, 1);
  assert.equal(blocks[1].parts, 1);
});

test("короткий урок не склеивается со следующим часом", () => {
  // 09:00 на полчаса и 10:00 — между ними полчаса паузы.
  const blocks = mergeAdjacent([at(29, 9, 30), at(29, 10)]);
  assert.equal(blocks.length, 2);
});

test("накладка считается одним занятием", () => {
  // Урок на 90 минут и следующий через час: расписание так позволяет.
  const blocks = mergeAdjacent([at(29, 9, 90), at(29, 10)]);
  assert.equal(blocks.length, 1);
  assert.equal(blocks[0].minutes, 120);
});

test("порядок на входе неважен", () => {
  const blocks = mergeAdjacent([at(29, 10), at(29, 9)]);
  assert.equal(blocks.length, 1);
  assert.equal(blocks[0].at, at(29, 9).at);
});

test("склейка не трогает исходный список", () => {
  const source = [at(29, 9), at(29, 10)];
  mergeAdjacent(source);
  assert.equal(source.length, 2);
  assert.equal(source[0].minutes, 60);
});

test("сдвоенный урок даёт один кружок в дне", () => {
  const groups = groupByDay([person("a", "Alla", [at(28, 9), at(28, 10)])], MONDAY);

  assert.equal(groups[0].entries.length, 1);
  assert.equal(groups[0].entries[0].parts, 2);
  assert.equal(groups[0].entries[0].minutes, 120);
});

test("разнесённые по дню уроки дают два кружка", () => {
  const groups = groupByDay([person("a", "Alla", [at(28, 9), at(28, 15)])], MONDAY);
  assert.equal(groups[0].entries.length, 2);
});
