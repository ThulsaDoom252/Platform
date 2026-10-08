import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { scrollScriptListToToday } from "../src/lib/script-list-scroll";
import { scheduleDateValue, scheduleNow, scheduleStartOfWeek } from "../src/lib/schedule-time";

function scriptList({ height = 500, scrollTop = 0, top = 180, border = 0 } = {}) {
  const days = [
    { dataset: { scriptDay: "2026-10-05" }, getBoundingClientRect: () => ({ top: 186 }) },
    { dataset: { scriptDay: "2026-10-08" }, getBoundingClientRect: () => ({ top: 940 }) },
    { dataset: { scriptDay: "2026-10-09" }, getBoundingClientRect: () => ({ top: 1280 }) },
  ];
  const list = { clientHeight: height, clientTop: border, scrollTop,
    getBoundingClientRect: () => ({ top }), querySelectorAll: () => days } as unknown as HTMLElement;
  return list;
}

test("opening Scripts puts Thursday 08.10 at the top of its own list", () => {
  const list = scriptList();
  assert.equal(scrollScriptListToToday(list, "2026-10-08"), true);
  assert.equal(list.scrollTop, 760);
});

test("alignment accounts for existing scrolling and container borders, without scrolling the page", () => {
  const list = scriptList({ scrollTop: 225, top: 300, border: 1 });
  assert.equal(scrollScriptListToToday(list, "2026-10-08"), true);
  assert.equal(list.scrollTop, 864);
  const source = readFileSync("src/lib/script-list-scroll.ts", "utf8");
  assert.doesNotMatch(source, /scrollIntoView|window\.|document\./);
});

test("other weeks and hidden mobile lists do not consume the initial scroll", () => {
  const list = scriptList({ scrollTop: 50 });
  assert.equal(scrollScriptListToToday(list, "2026-10-15"), false);
  assert.equal(list.scrollTop, 50);
  const hidden = scriptList({ height: 0, scrollTop: 10 });
  assert.equal(scrollScriptListToToday(hidden, "2026-10-08"), false);
  assert.equal(hidden.scrollTop, 10);
  Object.defineProperty(hidden, "clientHeight", { value: 500 });
  assert.equal(scrollScriptListToToday(hidden, "2026-10-08"), true);
});

test("today and the current week use school time, including a UTC date boundary", () => {
  const today = scheduleNow(new Date("2026-10-07T21:05:00.000Z"));
  assert.equal(scheduleDateValue(today), "2026-10-08");
  assert.equal(today.getUTCDay(), 4);
  assert.equal(scheduleDateValue(scheduleStartOfWeek(today)), "2026-10-05");
});

test("the scripts list waits for loaded rows, retries on mobile return and preserves manual browsing", () => {
  const source = readFileSync("src/components/script/script-weeks.tsx", "utf8");
  assert.match(source, /ref=\{listRef\}/);
  assert.match(source, /data-script-day=\{scheduleDateValue\(day\)\}/);
  assert.match(source, /weeks\[0\]\?\.start\.getTime\(\) !== anchor\.getTime\(\)/);
  assert.match(source, /scrolledToday\.current === todayKey/);
  assert.match(source, /\[anchor, weeks, showHistory, todayKey, openId\]/);
  assert.match(source, /i < WEEKDAYS \|\| sameDay\(day, today\)/);
  assert.match(source, /showHistory \|\| !sameDay\(anchor/);
});
