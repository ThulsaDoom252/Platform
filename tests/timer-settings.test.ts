import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";
import vm from "node:vm";
import { DEFAULT_TIMER_SECONDS, editTimerInput, normalizeOptionalTimerSeconds, normalizeTimerSeconds, syncTimerInput } from "../src/lib/timer-settings";
import { liveClassTimerState, normalizeClassTimerState } from "../src/lib/class-timer";
import { DEFAULT_WORD_DECK_SETTINGS, normalizeWordDeckSettings, wordDeckTimerSeconds } from "../src/lib/word-deck";

test("all new timer durations default to exactly two minutes", () => {
  assert.equal(DEFAULT_TIMER_SECONDS, 120);
  assert.equal(normalizeTimerSeconds(undefined), 120);
  assert.equal(normalizeOptionalTimerSeconds(undefined), 120);
  assert.equal(normalizeClassTimerState({})?.durationSeconds, 120);
  const defaults = normalizeWordDeckSettings({});
  for (const key of ["gameSeconds", "cardSeconds", "guessSeconds", "sentenceSeconds"] as const) {
    assert.equal(defaults[key], 120);
    assert.equal(DEFAULT_WORD_DECK_SETTINGS[key], 120);
  }
  assert.equal(defaults.timerMode, "NONE", "a duration default does not enable a previously disabled word-deck timer");
});

test("explicit blanks and zero are never replaced by default durations", () => {
  for (const value of [0, "0", "", "   "]) {
    assert.equal(normalizeTimerSeconds(value), 0);
    assert.equal(normalizeOptionalTimerSeconds(value), 0);
    assert.equal(normalizeClassTimerState({ durationSeconds: value })?.durationSeconds, 0);
  }
  const zero = normalizeWordDeckSettings({ gameSeconds: 0, cardSeconds: 0, guessSeconds: 0, sentenceSeconds: 0 });
  assert.equal(wordDeckTimerSeconds(zero), 0);
  assert.equal(wordDeckTimerSeconds({ ...zero, timerMode: "GAME" }), 0);
});

test("old custom durations and explicit Off settings stay unchanged", () => {
  assert.equal(normalizeClassTimerState({ durationSeconds: 300 })?.durationSeconds, 300);
  const old = normalizeWordDeckSettings({ cardSeconds: 10, gameSeconds: 90 });
  assert.equal(old.cardSeconds, 10);
  assert.equal(old.gameSeconds, 90);
  assert.equal(old.guessSeconds, 10);
  assert.equal(old.sentenceSeconds, 10);
  assert.equal(normalizeOptionalTimerSeconds(null), null);
  const revision = readFileSync("src/components/revision/revision-setup.tsx", "utf8");
  assert.ok(revision.includes("useState(Boolean(initial?.totalSeconds))"));
  assert.ok(revision.includes("initial?.answerSeconds ?? null"));
  assert.ok(revision.includes("value={perAnswer ?? DEFAULT_TIMER_SECONDS}"));
  assert.ok(revision.includes("totalSeconds: wholeTimerEnabled ? Math.max(0, minutes * 60) : null"));
});

test("server duration bounds reject non-finite values and preserve valid short timers", () => {
  assert.equal(normalizeTimerSeconds(-5), 0);
  assert.equal(normalizeTimerSeconds(999_999), 86_400);
  assert.equal(normalizeTimerSeconds(999, 120), 120);
  assert.equal(normalizeTimerSeconds(Number.POSITIVE_INFINITY), 120);
  assert.equal(normalizeTimerSeconds(Number.NaN, 59), 59);
  assert.equal(normalizeTimerSeconds(1), 1);
});

test("clearing zero leaves a blank draft after the parent's numeric acknowledgement", () => {
  const blank = editTimerInput("");
  assert.equal(blank.value, 0);
  assert.equal(blank.text, "");
  assert.equal(syncTimerInput(blank, 0), blank);
  assert.deepEqual(editTimerInput("7"), { value: 7, text: "7" });
  assert.deepEqual(syncTimerInput(blank, 120), { value: 120, text: "120" });
});

/** Exercise the actual React input component's render/onChange cycle with isolated hook state. */
function inputHarness(initial: number) {
  let settingsValue = initial;
  let hookState: { value: number; text: string } | undefined;
  const exports: Record<string, unknown> = {};
  const source = ts.transpileModule(readFileSync("src/components/timer-number-input.tsx", "utf8"), { compilerOptions: {
    jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
  } }).outputText;
  vm.runInNewContext(source, { exports, require: (name: string) => {
    if (name === "react") return { useState: (initial: () => typeof hookState) => {
      hookState ??= initial();
      return [hookState, (next: typeof hookState) => { hookState = next; }];
    } };
    if (name === "react/jsx-runtime") return { jsx: (type: string, props: unknown) => ({ type, props }) };
    if (name === "@/lib/timer-settings") return { editTimerInput, syncTimerInput };
    throw new Error(`Unexpected input import ${name}`);
  } });
  type Input = { props: { value: string; onChange: (event: { target: { value: string } }) => void } };
  const component = exports.TimerNumberInput as (props: { value: number; onChange: (value: number) => void }) => Input;
  const render = () => component({ value: settingsValue, onChange: (value) => { settingsValue = value; } });
  return { render, value: () => settingsValue, external: (value: number) => { settingsValue = value; }, type: (value: string) => render().props.onChange({ target: { value } }) };
}

test("real input allows deleting zero and entering a new number without a forced leading zero", () => {
  const input = inputHarness(0);
  assert.equal(input.render().props.value, "0");
  input.type("");
  assert.equal(input.render().props.value, "");
  assert.equal(input.value(), 0);
  input.type("4");
  assert.equal(input.render().props.value, "4");
  assert.equal(input.value(), 4);
  input.type("45");
  assert.equal(input.render().props.value, "45");
});

test("empty input remains empty across rerenders and saves as zero; an external edit still refreshes it", () => {
  const input = inputHarness(120);
  input.type("");
  for (let render = 0; render < 5; render++) assert.equal(input.render().props.value, "");
  assert.equal(normalizeTimerSeconds(input.value()), 0);
  input.external(90);
  assert.equal(input.render().props.value, "90");
});

test("zero-duration running class timers finish cleanly, without negative time or default fallback", () => {
  const state = liveClassTimerState({ durationSeconds: 0, remainingMs: 0, status: "RUNNING", endsAt: "2026-10-12T12:00:00Z" }, Date.parse("2026-10-12T12:00:00Z"));
  assert.equal(state?.durationSeconds, 0);
  assert.equal(state?.remainingMs, 0);
  assert.equal(state?.status, "FINISHED");
});

test("every timer editor uses the blank-preserving input, and class fields have no five-second minimum", () => {
  for (const path of ["class/class-timer", "game/word-deck-studio", "game/guess-setup", "game/guess-picture-studio", "revision/revision-setup"]) {
    const source = readFileSync(`src/components/${path}.tsx`, "utf8");
    assert.ok(source.includes("<TimerNumberInput"), path);
    assert.ok(!source.includes("setSeconds(Number"), path);
  }
  const editor = readFileSync("src/components/class/class-timer.tsx", "utf8");
  assert.ok(editor.includes("durationSeconds: DEFAULT_TIMER_SECONDS"));
  assert.ok(!editor.includes("durationSeconds: Math.max(5,"));
  const guess = readFileSync("src/lib/actions/guess-picture.ts", "utf8");
  assert.equal((guess.match(/const seconds = normalizeTimerSeconds/g) ?? []).length, 4);
  const classSave = readFileSync("src/lib/actions/class-tools.ts", "utf8");
  assert.ok(classSave.includes("durationSeconds: normalizeTimerSeconds(input.durationSeconds)"));
});
