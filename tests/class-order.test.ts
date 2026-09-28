import { test } from "node:test";
import assert from "node:assert/strict";
import {
  daysLeftInWeek,
  groupByDay,
  orderClassPeople,
  sortBy,
  type Orderable,
} from "../src/lib/class-order";

/** Понедельник, 28 сентября 2026, десять утра. */
const MONDAY = new Date(2026, 8, 28, 10, 0, 0);

const at = (day: number, hour: number) =>
  new Date(2026, 8, day, hour, 0, 0).toISOString();

const person = (
  id: string,
  name: string,
  nextLessonAt: string | null,
  balance = 5,
): Orderable => ({ id, name, balance, nextLessonAt });

test("до конца недели считаются оставшиеся дни, включая сегодня", () => {
  assert.equal(daysLeftInWeek(new Date(2026, 8, 28)), 7); // понедельник
  assert.equal(daysLeftInWeek(new Date(2026, 9, 2)), 3); // пятница
  assert.equal(daysLeftInWeek(new Date(2026, 9, 4)), 1); // воскресенье
});

test("сначала сегодняшние, потом завтрашние", () => {
  const people = [
    person("c", "Ksenia", at(29, 12)),
    person("a", "Alla", at(28, 15)),
    person("b", "Bogdan", at(28, 9)),
  ];

  const groups = groupByDay(people, MONDAY);

  assert.equal(groups.length, 2);
  // Внутри дня — по времени урока, а не по имени.
  assert.deepEqual(groups[0].people.map((p) => p.name), ["Bogdan", "Alla"]);
  assert.deepEqual(groups[1].people.map((p) => p.name), ["Ksenia"]);
});

test("дни без занятий в списке не появляются", () => {
  const groups = groupByDay(
    [person("a", "Alla", at(28, 9)), person("b", "Bogdan", at(30, 9))],
    MONDAY,
  );

  // Вторник пустой — между понедельником и средой его нет.
  assert.equal(groups.length, 2);
  assert.equal(new Date(groups[0].day!).getDate(), 28);
  assert.equal(new Date(groups[1].day!).getDate(), 30);
});

test("без уроков на этой неделе — в последнюю группу, по имени", () => {
  const groups = groupByDay(
    [
      person("z", "Zoryana", null),
      person("a", "Alla", at(28, 9)),
      person("o", "Oksana", null),
      // Урок есть, но уже на следующей неделе.
      person("n", "Nazar", at(35, 9)),
    ],
    MONDAY,
  );

  const last = groups.at(-1)!;
  assert.equal(last.day, null);
  assert.deepEqual(last.people.map((p) => p.name), ["Nazar", "Oksana", "Zoryana"]);
});

test("неделя обрывается воскресеньем", () => {
  // В пятницу видно пятницу, субботу и воскресенье — понедельник уже нет.
  const friday = new Date(2026, 9, 2, 10, 0, 0);
  const groups = groupByDay(
    [
      person("a", "Alla", at(32, 9)), // 2 октября, пятница
      person("s", "Sofia", at(34, 9)), // 4 октября, воскресенье
      person("m", "Maria", at(35, 9)), // 5 октября, понедельник
    ],
    friday,
  );

  assert.equal(groups.filter((g) => g.day).length, 2);
  assert.deepEqual(groups.at(-1)!.people.map((p) => p.name), ["Maria"]);
});

test("по имени — в обе стороны", () => {
  const people = [
    person("b", "Bogdan", null),
    person("a", "Alla", null),
    person("k", "Ksenia", null),
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
    person("b", "Bogdan", null, 10),
    person("a", "Alla", null, 2),
    person("k", "Ksenia", null, 2),
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
  const people = [person("b", "Bogdan", null), person("a", "Alla", null)];
  sortBy(people, "name", false);
  assert.deepEqual(people.map((p) => p.name), ["Bogdan", "Alla"]);
});

test("по имени и остатку список не делится по дням", () => {
  const people = [person("a", "Alla", at(28, 9)), person("b", "Bogdan", at(29, 9))];

  const byName = orderClassPeople(people, "name", false, MONDAY);
  assert.equal(byName.length, 1);
  assert.equal(byName[0].day, null);
  assert.equal(byName[0].people.length, 2);
});

test("обратный порядок расписания переворачивает дни, а не людей внутри дня", () => {
  const people = [
    person("a", "Alla", at(28, 15)),
    person("b", "Bogdan", at(28, 9)),
    person("k", "Ksenia", at(29, 9)),
  ];

  const groups = orderClassPeople(people, "lessons", true, MONDAY);

  assert.equal(new Date(groups[0].day!).getDate(), 29);
  // Внутри понедельника порядок по времени сохранился.
  assert.deepEqual(groups[1].people.map((p) => p.name), ["Bogdan", "Alla"]);
});

test("пустой список не падает", () => {
  assert.deepEqual(groupByDay([], MONDAY), []);
  assert.deepEqual(orderClassPeople([], "name", false, MONDAY), [
    { day: null, people: [] },
  ]);
});
