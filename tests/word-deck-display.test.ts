import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { wordDeckTextSize } from "../src/lib/word-deck-display";

const source = readFileSync("src/components/game/word-deck-board.tsx", "utf8");

test("both card faces grow with complete words, descriptions and translations, without an inner scroll region", () => {
  for (const kind of ["word", "description", "translation"]) assert.ok(source.includes(`data-card-text="${kind}"`));
  assert.ok(!source.includes("overflow-y-auto"));
  assert.ok(!source.includes("max-h-full"));
  assert.equal((source.match(/\[grid-area:1\/1\]/g) ?? []).length, 2);
  assert.ok(source.includes("min-h-[inherit]"));
  assert.ok(source.includes("min-h-[24rem]"));
  assert.ok(source.includes("min-h-60 max-w-xl sm:min-h-72"));
  assert.ok(source.includes("[overflow-wrap:anywhere]"));
  assert.ok(source.includes("min-w-0 w-full overflow-hidden"));
  assert.ok(source.includes("basis-full sm:flex-1 sm:basis-auto"));
});
test("expired timers show one message in the header, never over the card text", () => {
  assert.equal((source.match(/t\.wordDeck\.timeUp/g) ?? []).length, 1);
  assert.ok(source.indexOf("t.wordDeck.timeUp") < source.indexOf("word-deck-card word-deck-deal-in"));
  assert.ok(source.includes('role="status" aria-live="polite"'));
  assert.ok(!source.includes("bg-slate-950/70"));
  assert.ok(source.includes('feedback !== "TIME_UP"'));
});
test("teacher controls cannot be enabled for observers or student homework", () => {
  assert.match(source, /timerControls = false/);
  assert.match(source, /const canControlTimer = timerControls && !observer && !homework && settings.timerMode !== "NONE"/);
  assert.match(source, /if \(!canControlTimer \|\| !started\) return/);
  assert.match(source, /\{canControlTimer && <>/);
  const lesson = readFileSync("src/components/lessons/lesson-view.tsx", "utf8");
  assert.ok(lesson.includes("compact timerControls={teacher}"));
});
test("paused state exposes resume and normal card judgments pause a card clock", () => {
  assert.match(source, /timerPaused \? t.wordDeck.resumeTimer : t.wordDeck.pauseTimer/);
  assert.match(source, /timerPaused \? t.wordDeck.timerPaused/);
  assert.match(source, /if \(settings.timerMode === "CARD"\) setTimerPaused\(true\)/);
});
test("long words, phrases, translations and descriptions use readable smaller text", () => {
  assert.equal(wordDeckTextSize("word"), "text-3xl sm:text-5xl");
  assert.equal(wordDeckTextSize("word", "spelling"), "text-4xl sm:text-6xl");
  assert.equal(wordDeckTextSize("look forward to spending time together and making unforgettable memories"), "text-xl sm:text-3xl");
  assert.equal(wordDeckTextSize("x".repeat(200)), "text-base sm:text-xl");
  assert.equal(wordDeckTextSize("x".repeat(500), "description"), "text-sm sm:text-base");
});
test("pause and restart are published and observed without persisting every second", () => {
  assert.match(source, /setTimerPaused\(wordDeckTimerPaused\(state, settings\)\)/);
  assert.match(source, /sound, timerPaused, timerVersion, verdict\]/);
  assert.match(source, /setTimerVersion\(\(value\) => value \+ 1\)/);
  const action = readFileSync("src/lib/actions/word-deck.ts", "utf8");
  const publish = action.slice(action.indexOf("export async function saveClassWordDeckLiveStateAction"), action.indexOf("export async function removeWordDeckFromClassAction"));
  assert.ok(publish.includes("await requireTeacher()"));
  assert.ok(publish.includes("normalizeWordDeckLiveState"));
});
