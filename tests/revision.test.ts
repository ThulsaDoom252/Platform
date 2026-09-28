import { test } from "node:test";
import assert from "node:assert/strict";
import {
  canStart,
  readiness,
  wordFits,
  wordsFor,
  TEST_MODES,
  type RevisionWord,
} from "../src/lib/revision-modes";
import {
  buildRevision,
  makeOptions,
  splitPairs,
  CHOICE_OPTIONS,
  DEFINITION_OPTIONS,
} from "../src/lib/revision-build";
import { scoreRevision, type RevisionAnswer } from "../src/lib/revision-score";

/** Предсказуемый «случайный»: без него перемешивание не проверить. */
function seeded(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

const word = (
  id: string,
  opts: Partial<RevisionWord> = {},
): RevisionWord => ({
  phraseId: id,
  word: id,
  translation: `${id}-перевод`,
  description: `a thing called ${id}`,
  imageUrl: `/uploads/words/${id}.jpg`,
  ...opts,
});

const FIVE = ["a", "b", "c", "d", "e"].map((id) => word(id));

// ---------- что какому режиму нужно ----------

test("карточкам хватает одного слова", () => {
  assert.equal(wordFits(word("x", { translation: null, imageUrl: null, description: null }), "flashcards"), true);
  assert.equal(wordFits(word("x", { translation: null }), "unscramble"), true);
});

test("режимы с переводом отсеивают слова без перевода", () => {
  const bare = word("x", { translation: null });
  assert.equal(wordFits(bare, "choose"), false);
  assert.equal(wordFits(bare, "pairs"), false);
});

test("по картинке нужна картинка, по описанию — описание", () => {
  assert.equal(wordFits(word("x", { imageUrl: null }), "picture"), false);
  assert.equal(wordFits(word("x", { description: null }), "definition"), false);
  assert.equal(wordFits(word("x", { description: null }), "definitionPairs"), false);
});

test("пустая строка за содержимое не считается", () => {
  // Пробелы вместо описания — то же, что его нет.
  assert.equal(wordFits(word("x", { description: "   " }), "definition"), false);
  assert.equal(wordFits(word("x", { imageUrl: "" }), "picture"), false);
});

test("готовность показывает, сколько слов выпадет", () => {
  const words = [word("a"), word("b", { imageUrl: null }), word("c", { imageUrl: null })];
  const picture = readiness(words).find((r) => r.mode === "picture")!;

  assert.equal(picture.usable, 1);
  assert.equal(picture.skipped, 2);
  assert.equal(picture.ready, true);
});

test("режиму без нужного числа слов ставится «не готов»", () => {
  const two = [word("a"), word("b")];
  const state = new Map(readiness(two).map((r) => [r.mode, r]));

  // Выбор из трёх на двух словах собрать нечем.
  assert.equal(state.get("choose")!.ready, false);
  assert.equal(state.get("definition")!.ready, false);
  assert.equal(state.get("pairs")!.ready, true);
});

test("задание из одних карточек не задание", () => {
  /*
   * Карточки ничего не спрашивают — это просмотр. Поэтому хотя бы один
   * проверочный режим обязателен.
   */
  assert.equal(canStart(FIVE, ["flashcards"]), false);
  assert.equal(canStart(FIVE, ["flashcards", "choose"]), true);
  assert.equal(TEST_MODES.includes("flashcards"), false);
});

test("выбранный режим без подходящих слов задание не спасает", () => {
  const noPictures = FIVE.map((w) => ({ ...w, imageUrl: null }));
  assert.equal(canStart(noPictures, ["flashcards", "picture"]), false);
});

// ---------- варианты ответа ----------

test("правильный ответ среди вариантов ровно один", () => {
  const options = makeOptions(
    "перевод",
    ["перевод", "другое", "третье", "четвёртое"],
    CHOICE_OPTIONS,
    seeded(7),
  );

  assert.equal(options.length, CHOICE_OPTIONS);
  assert.equal(options.filter((o) => o === "перевод").length, 1);
});

test("повтор правильного ответа в чужих вариантах не проходит", () => {
  // Иначе два одинаковых варианта читаются как подсказка.
  const options = makeOptions(
    "перевод",
    ["перевод", "ПЕРЕВОД", " перевод ", "другое", "третье"],
    CHOICE_OPTIONS,
    seeded(3),
  );

  assert.equal(options.filter((o) => o.trim().toLowerCase() === "перевод").length, 1);
});

test("вариантов не больше, чем есть чужих слов", () => {
  const options = makeOptions("a", ["a", "b"], DEFINITION_OPTIONS, seeded(1));
  assert.deepEqual(options.sort(), ["a", "b"]);
});

// ---------- пары ----------

test("пары режутся по четыре", () => {
  assert.deepEqual(splitPairs([1, 2, 3, 4, 5, 6, 7, 8]).map((g) => g.length), [4, 4]);
  assert.deepEqual(splitPairs([1, 2, 3]).map((g) => g.length), [3]);
  assert.deepEqual(splitPairs([1, 2, 3, 4, 5, 6, 7, 8, 9]).map((g) => g.length), [4, 5]);
});

test("одиночный хвост подклеивается к прошлой группе", () => {
  // Соединять одну пару не с чем: она сразу верная.
  const groups = splitPairs([1, 2, 3, 4, 5]);
  assert.equal(groups.length, 1);
  assert.equal(groups[0].length, 5);
});

test("группы не теряют и не дублируют слова", () => {
  for (const n of [2, 3, 4, 5, 6, 7, 8, 9, 13]) {
    const items = Array.from({ length: n }, (_, i) => i);
    const flat = splitPairs(items).flat();
    assert.deepEqual(flat.sort((a, b) => a - b), items, `n=${n}`);
  }
});

test("одного слова на пары не хватает", () => {
  assert.deepEqual(splitPairs([1]), []);
});

// ---------- сборка задания ----------

test("секции идут в порядке, заданном учителем", () => {
  const sections = buildRevision(FIVE, ["choose", "flashcards", "unscramble"], {}, seeded(5));
  assert.deepEqual(sections.map((s) => s.mode), ["choose", "flashcards", "unscramble"]);
});

test("карточки идут одной пачкой, остальное — по шагу на слово", () => {
  const sections = buildRevision(FIVE, ["flashcards", "unscramble"], {}, seeded(9));

  assert.equal(sections[0].steps.length, 1);
  assert.equal(sections[1].steps.length, 5);
});

test("секция без подходящих слов выбрасывается", () => {
  const noPictures = FIVE.map((w) => ({ ...w, imageUrl: null }));
  const sections = buildRevision(noPictures, ["picture", "choose"], {}, seeded(2));

  assert.deepEqual(sections.map((s) => s.mode), ["choose"]);
});

test("в каждом шаге выбора ровно один верный вариант", () => {
  const sections = buildRevision(FIVE, ["choose"], {}, seeded(11));

  for (const step of sections[0].steps) {
    if (step.mode !== "choose") continue;
    const correct = step.word.translation!;
    assert.equal(step.options.filter((o) => o === correct).length, 1, step.word.word);
    assert.equal(step.options.length, CHOICE_OPTIONS);
  }
});

test("сборка не теряет слова", () => {
  const sections = buildRevision(FIVE, ["unscramble"], {}, seeded(4));
  const ids = sections[0].steps.map((s) => (s.mode === "unscramble" ? s.word.phraseId : ""));
  assert.deepEqual(ids.sort(), ["a", "b", "c", "d", "e"]);
});

// ---------- итог ----------

const answer = (
  mode: RevisionAnswer["mode"],
  word: string,
  correct: boolean,
  ms: number,
  reason?: RevisionAnswer["reason"],
): RevisionAnswer => ({ mode, phraseId: word, word, correct, ms, reason });

test("точность считается по проверочным, карточки в неё не идут", () => {
  /*
   * Иначе просмотр карточек всегда завышал бы результат: там ничего не
   * спрашивают, и каждый шаг был бы «верным».
   */
  const result = scoreRevision([
    answer("flashcards", "a", true, 500),
    answer("choose", "b", true, 1000),
    answer("choose", "c", false, 2000, "wrong"),
  ]);

  assert.equal(result.total, 2);
  assert.equal(result.right, 1);
  assert.equal(result.accuracy, 50);
});

test("истёкшее время считается ошибкой и учитывается отдельно", () => {
  const result = scoreRevision([
    answer("choose", "a", false, 15000, "timeout"),
    answer("choose", "b", true, 900),
  ]);

  assert.equal(result.wrong, 1);
  assert.equal(result.timeouts, 1);
});

test("самый быстрый и самый медленный — среди верных", () => {
  // У неверного время говорит о колебаниях, а таймаут всегда был бы
  // «самым медленным».
  const result = scoreRevision([
    answer("choose", "fast", true, 800),
    answer("choose", "slow", true, 4200),
    answer("choose", "miss", false, 15000, "timeout"),
  ]);

  assert.equal(result.fastestWord, "fast");
  assert.equal(result.fastestMs, 800);
  assert.equal(result.slowestWord, "slow");
  assert.equal(result.slowestMs, 4200);
});

test("секции идут в порядке прохождения", () => {
  const result = scoreRevision([
    answer("unscramble", "a", true, 100),
    answer("choose", "b", true, 100),
    answer("unscramble", "c", true, 100),
  ]);

  assert.deepEqual(result.sections.map((s) => s.mode), ["unscramble", "choose"]);
  assert.equal(result.sections[0].total, 2);
});

test("лучшая и худшая секции — только когда есть что сравнивать", () => {
  const one = scoreRevision([answer("choose", "a", true, 100)]);
  assert.equal(one.best, null);
  assert.equal(one.worst, null);

  const two = scoreRevision([
    answer("choose", "a", true, 100),
    answer("choose", "b", true, 100),
    answer("unscramble", "c", false, 100, "wrong"),
    answer("unscramble", "d", false, 100, "wrong"),
  ]);
  assert.equal(two.best, "choose");
  assert.equal(two.worst, "unscramble");
});

test("общее время включает и карточки", () => {
  const result = scoreRevision([
    answer("flashcards", "a", true, 5000),
    answer("choose", "b", true, 1000),
  ]);

  assert.equal(result.totalMs, 6000);
});

test("пустая попытка не делит на ноль", () => {
  const result = scoreRevision([]);
  assert.equal(result.accuracy, 0);
  assert.equal(result.fastestMs, null);
  assert.deepEqual(result.sections, []);
});
