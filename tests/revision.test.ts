import { test } from "node:test";
import assert from "node:assert/strict";
import {
  canStart,
  canStartWith,
  readiness,
  randomRevisionPercentage,
  wordFits,

  TEST_MODES,
  type RevisionWord,
} from "../src/lib/revision-modes";
import {
  buildRevision,
  makeOptions,
  splitPairs,
  wordsOfMode,
  scrambleLetters,
  scrambleParts,
  pairOrder,
  planProgress,
  testSectionsComplete,
  nextSection,
  stepSize,
  timeoutRest,
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

test("карточка сохраняет словарную иконку", () => {
  const plan = buildRevision([word("apple", { icon: "🍎" })], ["flashcards"], {}, seeded(1));
  const card = plan[0]?.steps[0];
  assert.equal(card?.mode, "flashcards");
  if (card?.mode === "flashcards") assert.equal(card.words[0].icon, "🍎");
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

test("случайные проценты выбирают нужную долю без дублей", () => {
  const words = Array.from({ length: 20 }, (_, index) => word(String(index)));
  for (const percent of [25, 50, 75] as const) {
    const picked = randomRevisionPercentage(words, percent, seeded(percent));
    assert.equal(picked.length, 20 * percent / 100);
    assert.equal(new Set(picked.map((item) => item.phraseId)).size, picked.length);
  }
});

test("случайный процент не оставляет непустой словник без слов", () => {
  assert.equal(randomRevisionPercentage([word("only")], 25, seeded(1)).length, 1);
});

test("выбору из переводов нужны варианты, а описанию хватает одной записи", () => {
  const two = [word("a"), word("b")];
  const state = new Map(readiness(two).map((r) => [r.mode, r]));

  // Выбор из трёх на двух словах собрать нечем.
  assert.equal(state.get("choose")!.ready, false);
  assert.equal(state.get("definition")!.ready, true);
  assert.equal(state.get("pairs")!.ready, true);
});

test("одно описание включает оба режима с описаниями", () => {
  const one = [word("a", { imageUrl: null })];
  const state = new Map(readiness(one).map((r) => [r.mode, r]));
  assert.equal(state.get("definition")!.ready, true);
  assert.equal(state.get("definitionPairs")!.ready, true);

  const plan = buildRevision(one, ["definition", "definitionPairs"], { shuffleWords: false });
  assert.deepEqual(plan.map((section) => [section.mode, section.steps.length]), [
    ["definition", 1],
    ["definitionPairs", 1],
  ]);
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
  assert.deepEqual(result.sections.map((section) => section.mode), ["choose"]);
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

test("общее время не включает карточки", () => {
  const result = scoreRevision([
    answer("flashcards", "a", true, 5000),
    answer("choose", "b", true, 1000),
  ]);

  assert.equal(result.totalMs, 1000);
});

test("пустая попытка не делит на ноль", () => {
  const result = scoreRevision([]);
  assert.equal(result.accuracy, 0);
  assert.equal(result.fastestMs, null);
  assert.deepEqual(result.sections, []);
});

// ---------- где остановился ----------

test("шаг знает, сколько ответов он закрывает", () => {
  const sections = buildRevision(FIVE, ["flashcards", "pairs", "choose"], {}, seeded(6));
  const cards = sections.find((s) => s.mode === "flashcards")!;
  const choose = sections.find((s) => s.mode === "choose")!;

  // Карточки закрывают всю пачку разом, выбор — по слову за шаг.
  assert.equal(stepSize(cards.steps[0]), 5);
  assert.equal(stepSize(choose.steps[0]), 1);
});

test("непройденный хвост уходит в просрочку", () => {
  const plan = buildRevision(FIVE, ["choose", "unscramble"], {}, seeded(3));
  const rest = timeoutRest(plan, 7);

  assert.equal(rest.length, 3);
  assert.equal(rest.every((a) => !a.correct && a.reason === "timeout"), true);
  // Слова берутся в порядке прохождения, а не в порядке словника.
  assert.deepEqual(
    rest.map((a) => a.mode),
    ["unscramble", "unscramble", "unscramble"],
  );
});

test("у пройденного задания хвоста нет", () => {
  const plan = buildRevision(FIVE, ["choose"], {}, seeded(3));
  assert.deepEqual(timeoutRest(plan, 5), []);
});

test("просрочка хвоста роняет точность", () => {
  /*
   * Иначе брошенное на середине задание выглядело бы отличным: пять
   * верных из пяти отвеченных.
   */
  const plan = buildRevision(FIVE, ["choose", "unscramble"], {}, seeded(3));
  const answered = plan[0].steps.map((step) =>
    answer("choose", step.mode === "choose" ? step.word.word : "", true, 500),
  );

  const result = scoreRevision([...answered, ...timeoutRest(plan, answered.length)]);
  assert.equal(result.total, 10);
  assert.equal(result.accuracy, 50);
  assert.equal(result.timeouts, 5);
});

// ---------- свой набор слов на каждую секцию ----------

test("режим берёт только отданные ему слова", () => {
  const plan = buildRevision(
    FIVE,
    ["flashcards", "choose"],
    { byMode: { choose: ["a", "b", "c"] } },
    seeded(12),
  );

  const cards = plan.find((s) => s.mode === "flashcards")!;
  const choose = plan.find((s) => s.mode === "choose")!;

  // Карточкам набор не задали — берут весь словник.
  assert.equal(stepSize(cards.steps[0]), 5);
  assert.equal(choose.steps.length, 3);
});

test("порядок словника важнее порядка галочек", () => {
  // Учитель мог тыкать вразнобой — задание всё равно идёт по словнику.
  const picked = wordsOfMode("choose", FIVE, { choose: ["d", "a", "c"] });
  assert.deepEqual(picked.map((w) => w.phraseId), ["a", "c", "d"]);
});

test("режим без своего набора берёт всё", () => {
  assert.equal(wordsOfMode("choose", FIVE, undefined).length, 5);
  assert.equal(wordsOfMode("choose", FIVE, { picture: ["a"] }).length, 5);
});

test("урезанный набор может уронить режим ниже минимума", () => {
  /*
   * Выбор из трёх на двух словах собрать нечем: секция должна исчезнуть
   * до старта, а не показать ученику вопрос с двумя вариантами.
   */
  const plan = buildRevision(
    FIVE,
    ["choose", "unscramble"],
    { byMode: { choose: ["a", "b"] } },
    seeded(13),
  );

  assert.deepEqual(plan.map((s) => s.mode), ["unscramble"]);
});

test("задание не пускают, если проверочный режим остался без слов", () => {
  const enough = (mode: string) => (mode === "choose" ? FIVE.slice(0, 2) : FIVE);
  assert.equal(canStartWith(enough, ["flashcards", "choose"]), false);
  assert.equal(canStartWith(() => FIVE, ["flashcards", "choose"]), true);
});

// ---------- рассыпанные буквы ----------

test("буквы перемешиваются, а не остаются на местах", () => {
  /*
   * Случайная перестановка иногда возвращает слово как есть — и задание
   * превращается в «нажми по порядку». Это и была жалоба.
   */
  for (let seed = 1; seed <= 40; seed++) {
    const mixed = scrambleLetters("grateful", seeded(seed)).join("");
    assert.notEqual(mixed, "grateful", `seed=${seed}`);
  }
});

test("рассыпанное слово состоит из тех же букв", () => {
  const mixed = scrambleLetters("refugee", seeded(5));
  assert.deepEqual([...mixed].sort(), [..."refugee"].sort());
});

test("переставлять нечего — слово остаётся собой", () => {
  assert.deepEqual(scrambleLetters("a", seeded(1)), ["a"]);
  assert.deepEqual(scrambleLetters("aaa", seeded(1)), ["a", "a", "a"]);
});

test("фраза рассыпается по коробке на слово", () => {
  const parts = scrambleParts("to push for", seeded(9));

  assert.deepEqual(parts.map((p) => p.text), ["to", "push", "for"]);
  // В каждой коробке буквы своего слова, чужих там нет.
  for (const part of parts) {
    assert.deepEqual([...part.letters].sort(), [...part.text].sort());
  }
});

test("шаг «собери слово» приносит буквы с собой", () => {
  const plan = buildRevision([word("grateful")], ["unscramble"], {}, seeded(3));
  const step = plan[0].steps[0];

  assert.equal(step.mode, "unscramble");
  if (step.mode !== "unscramble") return;
  assert.equal(step.parts.length, 1);
  assert.notEqual(step.parts[0].letters.join(""), "grateful");
});

// ---------- собранные пары наверх ----------

test("собранные пары уходят наверх в порядке находок", () => {
  assert.deepEqual(pairOrder(["a", "b", "c", "d"], ["c", "a"]), ["c", "a", "b", "d"]);
});

test("несобранное сохраняет свой порядок", () => {
  assert.deepEqual(pairOrder(["a", "b", "c"], []), ["a", "b", "c"]);
  // Чужой id в собранных колонку не ломает.
  assert.deepEqual(pairOrder(["a", "b"], ["z", "b"]), ["b", "a"]);
});

// ---------- свободный ход между секциями ----------

const answerIn = (mode: RevisionAnswer["mode"], n: number): RevisionAnswer[] =>
  Array.from({ length: n }, (_, i) => answer(mode, `w${i}`, true, 100));

test("прогресс считается по каждой секции отдельно", () => {
  const plan = buildRevision(FIVE, ["choose", "unscramble"], {}, seeded(4));
  // Ученик ушёл во вторую секцию и ответил там два раза.
  const progress = planProgress(plan, answerIn("unscramble", 2));

  assert.deepEqual(progress[0], { mode: "choose", step: 0, answered: 0, total: 5, done: false });
  assert.equal(progress[1].step, 2);
  assert.equal(progress[1].answered, 2);
});

test("карточки закрываются одним шагом целиком", () => {
  const plan = buildRevision(FIVE, ["flashcards", "choose"], {}, seeded(4));
  const half = planProgress(plan, answerIn("flashcards", 5));

  assert.equal(half[0].done, true);
  assert.equal(half[1].done, false);
});

test("карточки не блокируют завершение проверочной части", () => {
  const plan = buildRevision(FIVE, ["flashcards", "choose"], {}, seeded(4));
  const progress = planProgress(plan, answerIn("choose", 5));

  assert.equal(progress.find((section) => section.mode === "flashcards")?.done, false);
  assert.equal(testSectionsComplete(progress), true);
});

test("следующая секция ищется по кругу", () => {
  const plan = buildRevision(FIVE, ["choose", "unscramble", "picture"], {}, seeded(4));
  const progress = planProgress(plan, answerIn("unscramble", 5));

  // Со второй (уже пройденной) уходим на третью.
  assert.equal(nextSection(progress, 1), 2);
  // С третьей — обратно на первую, она ещё не тронута.
  assert.equal(nextSection(progress, 2), 2);
  assert.equal(nextSection(progress, 0), 0);
});

test("пройдено всё — следующей секции нет", () => {
  const plan = buildRevision(FIVE, ["choose"], {}, seeded(4));
  assert.equal(nextSection(planProgress(plan, answerIn("choose", 5))), -1);
});
