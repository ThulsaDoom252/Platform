import assert from "node:assert/strict";
import test from "node:test";
import {
  parseScheduleInput,
  sameScheduleDay,
  scheduleInputValue,
  scheduleNow,
  scheduleStartOfWeek,
} from "../src/lib/schedule-time";

test("время формы сохраняется без сдвига часового пояса", () => {
  const date = parseScheduleInput("2026-10-01T17:00");
  assert.ok(date);
  assert.equal(date.toISOString(), "2026-10-01T17:00:00.000Z");
  assert.equal(scheduleInputValue(date), "2026-10-01T17:00");
});

test("текущее время переводится в часы школы", () => {
  const date = scheduleNow(new Date("2026-10-01T14:25:30.000Z"));
  assert.equal(date.toISOString(), "2026-10-01T17:25:30.000Z");
});

test("неделя и сравнение дней используют календарь расписания", () => {
  const thursday = parseScheduleInput("2026-10-01T23:30")!;
  const monday = scheduleStartOfWeek(thursday);
  assert.equal(monday.toISOString(), "2026-09-28T00:00:00.000Z");
  assert.equal(sameScheduleDay(thursday, parseScheduleInput("2026-10-01T01:00")!), true);
});

test("невозможные даты не принимаются", () => {
  assert.equal(parseScheduleInput("2026-02-31T17:00"), null);
  assert.equal(parseScheduleInput("not-a-date"), null);
});
