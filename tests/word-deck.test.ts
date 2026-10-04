import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildWordDeck,
  canDealNextWordDeckCard,
  hasEnoughWordDeckWords,
  normalizeWordDeckLiveState,
  normalizeWordDeckSettings,
  minimumWordDeckWords,
  nextWordDeckHomeworkTracking,
  playableWordDeckCards,
  randomWordDeckPercentage,
  resetWordDeckHomeworkTracking,
  shuffleWordDeckTail,
  suggestedWordDeckTitle,
} from "../src/lib/word-deck";

const words = [
  { phraseId: "a", word: "alpha" },
  { phraseId: "b", word: "bravo" },
  { phraseId: "c", word: "charlie" },
];

test("число карт равно числу слов, умноженному на повторы", () => {
  assert.equal(buildWordDeck(words, { repeats: 4 }, () => 0.5).length, 12);
});

test("без альтернативного режима роли не назначаются", () => {
  assert.ok(buildWordDeck(words, { repeats: 2 }, () => 0.5).every((card) => card.owner === null));
});

test("процент ученика распределяется точно по всей колоде", () => {
  const deck = buildWordDeck(words, { repeats: 4, alternate: true, studentPercent: 75 }, () => 0.5);
  assert.equal(deck.filter((card) => card.owner === "STUDENT").length, 9);
  assert.equal(deck.filter((card) => card.owner === "TEACHER").length, 3);
});

test("таймеры по умолчанию выключены, значения готовы заранее", () => {
  assert.deepEqual(normalizeWordDeckSettings({}), {
    gameType: "WORDS",
    timerMode: "NONE",
    gameSeconds: 120,
    cardSeconds: 10,
    repeats: 1,
    alternate: false,
    studentPercent: 50,
    sound: true,
    showIcons: false,
    descriptionIcons: false,
    answerIcons: true,
    background: "MIDNIGHT",
    guessMode: "PICTURE",
    shuffleWords: true,
    shuffleDecks: false,
    autoPronounce: true,
    allowUsAudio: true,
    allowUkAudio: false,
    showTips: true,
    autoPronounceUk: false,
  });
});

test("у Guess by description свои безопасные настройки иконок", () => {
  const settings = normalizeWordDeckSettings({ gameType: "GUESS_DESCRIPTION" });
  assert.equal(settings.gameType, "GUESS_DESCRIPTION");
  assert.equal(settings.descriptionIcons, false);
  assert.equal(settings.answerIcons, true);
});

test("Spelling Practice включает US-озвучку и tips, но не UK", () => {
  const settings = normalizeWordDeckSettings({ gameType: "SPELLING" });
  assert.equal(settings.gameType, "SPELLING");
  assert.equal(settings.autoPronounce, true);
  assert.equal(settings.allowUsAudio, true);
  assert.equal(settings.allowUkAudio, false);
  assert.equal(settings.showTips, true);
  assert.equal(settings.autoPronounceUk, false);
  assert.equal(minimumWordDeckWords(settings), 1);
});

test("пресет Guess by picture сохраняет режим и порядок колод", () => {
  const settings = normalizeWordDeckSettings({
    gameType: "GUESS_PICTURE",
    guessMode: "MIXED",
    shuffleWords: false,
    shuffleDecks: true,
  });
  assert.equal(settings.gameType, "GUESS_PICTURE");
  assert.equal(settings.guessMode, "MIXED");
  assert.equal(settings.shuffleWords, false);
  assert.equal(settings.shuffleDecks, true);
});

test("Guess by description берёт только слова с непустым описанием", () => {
  const source = [
    { phraseId: "a", word: "alpha", description: "the first letter" },
    { phraseId: "b", word: "bravo", description: "  " },
    { phraseId: "c", word: "charlie" },
  ];
  assert.deepEqual(
    playableWordDeckCards(source, { gameType: "GUESS_DESCRIPTION" }).map((card) => card.phraseId),
    ["a"],
  );
  assert.equal(playableWordDeckCards(source, { gameType: "WORDS" }).length, 3);
});

test("истёкший таймер не блокирует следующую карту", () => {
  assert.equal(canDealNextWordDeckCard({
    cardCount: 4,
    at: 1,
    expired: true,
    observer: false,
  }), true);
  assert.equal(canDealNextWordDeckCard({
    cardCount: 4,
    at: 3,
    expired: true,
    observer: false,
  }), false);
  assert.equal(canDealNextWordDeckCard({
    cardCount: 4,
    at: 1,
    expired: true,
    observer: true,
  }), false);
});

test("иконки на карточках включаются только явно", () => {
  assert.equal(normalizeWordDeckSettings({}).showIcons, false);
  assert.equal(normalizeWordDeckSettings({ showIcons: true }).showIcons, true);
});

test("перемешивание хвоста не трогает уже сданные карты", () => {
  const got = shuffleWordDeckTail([1, 2, 3, 4], 2, () => 0);
  assert.deepEqual(got.slice(0, 2), [1, 2]);
  assert.deepEqual(got.slice(2), [4, 3]);
});

test("в колоде должно быть минимум четыре выбранных слова", () => {
  assert.equal(hasEnoughWordDeckWords(3), false);
  assert.equal(hasEnoughWordDeckWords(4), true);
});

test("название новой игры берётся из одного словника или становится Mix", () => {
  assert.equal(suggestedWordDeckTitle([]), "");
  assert.equal(suggestedWordDeckTitle(["Exploration"]), "Exploration");
  assert.equal(suggestedWordDeckTitle(["Exploration", "Travel"]), "Mix");
});

test("быстрый процент выбирает нужную случайную долю слов", () => {
  const twelve = Array.from({ length: 12 }, (_, index) => index + 1);
  assert.equal(randomWordDeckPercentage(twelve, 25, () => 0.5).length, 3);
  assert.equal(randomWordDeckPercentage(twelve, 50, () => 0.5).length, 6);
  assert.equal(randomWordDeckPercentage(twelve, 75, () => 0.5).length, 9);
  assert.equal(randomWordDeckPercentage([1], 25, () => 0.5).length, 1);
});

test("живой стол сохраняет порядок, но не принимает подменённый текст", () => {
  const deck = buildWordDeck(words, { repeats: 1, alternate: true }, () => 0.5);
  const reversed = [...deck].reverse().map((card) => ({ ...card, word: "подмена" }));
  const state = normalizeWordDeckLiveState(words, { repeats: 1, alternate: true }, {
    deck: reversed,
    at: 1,
    faceUp: true,
    sound: false,
    time: 7,
    expired: false,
    updatedAt: "now",
  });
  assert.deepEqual(state?.deck.map((card) => card.instanceId), reversed.map((card) => card.instanceId));
  assert.ok(state?.deck.every((card) => card.word !== "подмена"));
  assert.equal(state?.at, 1);
  assert.equal(state?.faceUp, true);
  assert.equal(state?.readDescriptions, false);
  assert.equal(state?.verdict, null);
  assert.equal(state?.feedback, null);
});

test("живой стол синхронизирует озвучивание и оценку, но отбрасывает чужие значения", () => {
  const deck = buildWordDeck(words, { repeats: 1 }, () => 0.5);
  const state = normalizeWordDeckLiveState(words, { repeats: 1 }, {
    deck,
    at: 0,
    faceUp: false,
    sound: true,
    time: 10,
    expired: false,
    readDescriptions: true,
    verdict: "WRONG",
    feedback: "WRONG",
    updatedAt: "now",
  });
  assert.equal(state?.readDescriptions, true);
  assert.equal(state?.verdict, "WRONG");
  assert.equal(state?.feedback, "WRONG");

  const cleaned = normalizeWordDeckLiveState(words, { repeats: 1 }, {
    ...state!,
    verdict: "RIGHT" as const,
    feedback: "TIME_UP" as const,
  });
  assert.equal(cleaned?.verdict, "RIGHT");
  assert.equal(cleaned?.feedback, "TIME_UP");
});

test("ученик не может прислать неполную или повторённую колоду", () => {
  const deck = buildWordDeck(words, { repeats: 1 }, () => 0.5);
  const base = { at: 0, faceUp: true, sound: true, time: 10, expired: false, updatedAt: "now" };
  assert.equal(normalizeWordDeckLiveState(words, { repeats: 1 }, { ...base, deck: deck.slice(1) }), null);
  assert.equal(normalizeWordDeckLiveState(words, { repeats: 1 }, { ...base, deck: [deck[0], deck[0], deck[2]] }), null);
});

test("домашняя игра хранит время каждого завершённого прохождения без дублей", () => {
  const started = nextWordDeckHomeworkTracking(
    { assignedByTeacherId: "teacher", attempts: [] },
    { started: true, finished: false, wasFinished: false },
    new Date("2026-10-04T10:00:00.000Z"),
  );
  const finished = nextWordDeckHomeworkTracking(
    started,
    { started: true, finished: true, wasFinished: false },
    new Date("2026-10-04T10:02:05.000Z"),
  );
  assert.equal(finished.attempts?.length, 1);
  assert.equal(finished.attempts?.[0]?.durationMs, 125_000);

  const duplicate = nextWordDeckHomeworkTracking(
    finished,
    { started: true, finished: true, wasFinished: true },
    new Date("2026-10-04T10:03:00.000Z"),
  );
  assert.deepEqual(duplicate.attempts, finished.attempts);
});

test("после сброса следующая попытка домашней игры считается отдельно", () => {
  const first = {
    attemptStartedAt: "2026-10-04T10:00:00.000Z",
    lastCompletedAttemptStartedAt: "2026-10-04T10:00:00.000Z",
    attempts: [{ finishedAt: "2026-10-04T10:01:00.000Z", durationMs: 60_000 }],
  };
  const reset = nextWordDeckHomeworkTracking(
    first,
    { started: false, finished: false, wasFinished: true },
    new Date("2026-10-04T10:02:00.000Z"),
  );
  const restarted = nextWordDeckHomeworkTracking(
    reset,
    { started: true, finished: false, wasFinished: false },
    new Date("2026-10-04T10:03:00.000Z"),
  );
  const second = nextWordDeckHomeworkTracking(
    restarted,
    { started: true, finished: true, wasFinished: false },
    new Date("2026-10-04T10:03:45.000Z"),
  );
  assert.deepEqual(second.attempts?.map((attempt) => attempt.durationMs), [60_000, 45_000]);
});

test("учительский полный сброс игры удаляет прогресс, но сохраняет владельца", () => {
  const reset = resetWordDeckHomeworkTracking({
    assignedByTeacherId: "teacher",
    attemptStartedAt: "2026-10-04T10:00:00.000Z",
    lastCompletedAttemptStartedAt: "2026-10-04T10:00:00.000Z",
    attempts: [{ finishedAt: "2026-10-04T10:01:00.000Z", durationMs: 60_000 }],
  });
  assert.equal(reset.assignedByTeacherId, "teacher");
  assert.equal(reset.attemptStartedAt, undefined);
  assert.equal(reset.lastCompletedAttemptStartedAt, undefined);
  assert.deepEqual(reset.attempts, []);
});
