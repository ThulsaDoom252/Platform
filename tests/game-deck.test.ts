import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildDeck,
  doubleFaces,
  hasNext,
  scoreOf,
  shuffle,
  spreadDuplicates,
  statsOf,
  type DeckCard,
} from "../src/lib/game-deck";

/** Предсказуемый «случайный»: без него перемешивание не проверить. */
function seeded(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

const card = (nodeId: string, word: string): DeckCard => ({
  phraseId: `${nodeId}-${word}`,
  nodeId,
  word,
  translation: `${word}-перевод`,
  imageUrl: `/uploads/${word}.png`,
  face: "PICTURE",
});

const first = { nodeId: "one", cards: [card("one", "a"), card("one", "b"), card("one", "c")] };
const second = { nodeId: "two", cards: [card("two", "x"), card("two", "y")] };

test("без перемешивания порядок словников сохраняется", () => {
  const deck = buildDeck([first, second], { shuffleWords: false, shuffleDecks: false });
  assert.deepEqual(deck.map((c) => c.word), ["a", "b", "c", "x", "y"]);
});

test("слова мешаются внутри словника, но словники не смешиваются", () => {
  const deck = buildDeck(
    [first, second],
    { shuffleWords: true, shuffleDecks: false },
    seeded(7),
  );

  // Первыми всё равно идут все три слова первого словника.
  assert.deepEqual(
    deck.slice(0, 3).map((c) => c.nodeId),
    ["one", "one", "one"],
  );
  assert.deepEqual(
    deck.slice(3).map((c) => c.nodeId),
    ["two", "two"],
  );
  assert.deepEqual(new Set(deck.map((c) => c.word)), new Set(["a", "b", "c", "x", "y"]));
});

test("когда мешаются и словники — карточки идут вперемешку", () => {
  const deck = buildDeck(
    [first, second],
    { shuffleWords: true, shuffleDecks: true },
    seeded(3),
  );

  assert.equal(deck.length, 5);
  const nodes = deck.map((c) => c.nodeId);
  assert.notDeepEqual(nodes, ["one", "one", "one", "two", "two"]);
});

test("перемешивание ничего не теряет и не дублирует", () => {
  for (const seed of [1, 42, 1234, 99999]) {
    const deck = buildDeck(
      [first, second],
      { shuffleWords: true, shuffleDecks: true },
      seeded(seed),
    );
    assert.equal(deck.length, 5, `seed ${seed}`);
    assert.equal(new Set(deck.map((c) => c.phraseId)).size, 5, `seed ${seed}`);
  }
});

test("исходные списки перемешивание не трогает", () => {
  buildDeck([first, second], { shuffleWords: true, shuffleDecks: true }, seeded(5));
  assert.deepEqual(first.cards.map((c) => c.word), ["a", "b", "c"]);
  assert.deepEqual(second.cards.map((c) => c.word), ["x", "y"]);
});

test("один словник тоже собирается", () => {
  const deck = buildDeck([first], { shuffleWords: false, shuffleDecks: true });
  assert.equal(deck.length, 3);
});

test("пустой выбор даёт пустую колоду", () => {
  assert.deepEqual(buildDeck([], { shuffleWords: true, shuffleDecks: true }), []);
});

test("тасование возвращает новый список", () => {
  const items = [1, 2, 3, 4];
  const mixed = shuffle(items, seeded(11));
  assert.deepEqual(items, [1, 2, 3, 4]);
  assert.equal(mixed.length, 4);
  assert.deepEqual(new Set(mixed), new Set(items));
});

test("следующая карта есть, пока колода не кончилась", () => {
  assert.equal(hasNext([1, 2, 3], 0), true);
  assert.equal(hasNext([1, 2, 3], 2), false);
  assert.equal(hasNext([], 0), false);
});

test("истёкший таймер не считается ни верным, ни ошибкой", () => {
  const score = scoreOf(["right", "wrong", "timeout", "right", null]);
  assert.deepEqual(score, { right: 2, wrong: 1, total: 5 });
});

test("смешанный режим даёт по две карты на слово", () => {
  const deck = buildDeck(
    [first],
    { shuffleWords: false, shuffleDecks: false, mixFaces: true },
  );

  assert.equal(deck.length, 6);
  assert.equal(deck.filter((c) => c.face === "PICTURE").length, 3);
  assert.equal(deck.filter((c) => c.face === "TRANSLATION").length, 3);
  // Каждое слово встречается ровно дважды.
  for (const word of ["a", "b", "c"]) {
    assert.equal(deck.filter((c) => c.word === word).length, 2, word);
  }
});

test("обе стороны слова не стоят подряд после перемешивания", () => {
  /*
   * Ради этого удвоение и делается до тасования: если картинка и
   * перевод одного слова идут парой, вторая карта ничего не проверяет —
   * ответ только что назвали вслух.
   */
  const many = {
    nodeId: "one",
    cards: "abcdefgh".split("").map((w) => card("one", w)),
  };

  const deck = buildDeck(
    [many],
    { shuffleWords: true, shuffleDecks: false, mixFaces: true },
    seeded(21),
  );

  const pairsTogether = deck.filter(
    (c, i) => i > 0 && deck[i - 1].phraseId === c.phraseId,
  ).length;

  assert.equal(deck.length, 16);
  assert.equal(pairsTogether, 0, `подряд стоят ${pairsTogether} пар`);
});

test("разведение работает на любом раскладе", () => {
  const many = {
    nodeId: "one",
    cards: "abcdefghij".split("").map((w) => card("one", w)),
  };

  for (const seed of [1, 7, 21, 99, 1234, 55555]) {
    const deck = buildDeck(
      [many],
      { shuffleWords: true, shuffleDecks: true, mixFaces: true },
      seeded(seed),
    );

    const together = deck.filter(
      (c, i) => i > 0 && deck[i - 1].phraseId === c.phraseId,
    ).length;

    assert.equal(together, 0, `seed ${seed}`);
    assert.equal(deck.length, 20, `seed ${seed}`);
  }
});

test("разведение не теряет и не дублирует карты", () => {
  const source = [card("one", "a"), card("one", "a"), card("one", "b")];
  const spread = spreadDuplicates(source);
  assert.equal(spread.length, 3);
  assert.deepEqual(
    spread.map((c) => c.word).sort(),
    ["a", "a", "b"],
  );
});

test("развести нечего — список не меняется", () => {
  const source = [card("one", "a"), card("one", "b")];
  assert.deepEqual(spreadDuplicates(source), source);
});

test("удвоение не трогает исходные карты", () => {
  const source = [card("one", "a")];
  const doubled = doubleFaces(source);
  assert.equal(source.length, 1);
  assert.equal(source[0].face, "PICTURE");
  assert.equal(doubled.length, 2);
});

test("статистика: точность считается от отвеченных, не от всей колоды", () => {
  const stats = statsOf(
    ["right", "wrong", "timeout", "right", null],
    [1200, 3400, null, 800, null],
    ["a", "b", "c", "d", "e"],
  );

  assert.equal(stats.right, 2);
  assert.equal(stats.wrong, 1);
  assert.equal(stats.answered, 3);
  assert.equal(stats.timeouts, 1);
  // 2 из 3 названных, а не 2 из 5 карт.
  assert.equal(stats.accuracy, 67);
});

test("статистика: самый быстрый и самый долгий ответ со словами", () => {
  const stats = statsOf(
    ["right", "right", "wrong"],
    [2500, 900, 4100],
    ["fork", "umbrella", "sneeze"],
  );

  assert.equal(stats.fastestMs, 900);
  assert.equal(stats.fastestWord, "umbrella");
  assert.equal(stats.slowestMs, 4100);
  assert.equal(stats.slowestWord, "sneeze");
  assert.equal(stats.averageMs, Math.round((2500 + 900 + 4100) / 3));
});

test("статистика: таймаут во время ответа не попадает", () => {
  // Иначе «самый долгий ответ» всегда равнялся бы длине таймера.
  const stats = statsOf(["right", "timeout"], [1000, 10000], ["a", "b"]);
  assert.equal(stats.slowestMs, 1000);
  assert.equal(stats.slowestWord, "a");
});

test("статистика без ответов не делит на ноль", () => {
  const stats = statsOf([null, null], [null, null], ["a", "b"]);
  assert.equal(stats.accuracy, 0);
  assert.equal(stats.fastestMs, null);
  assert.equal(stats.slowestMs, null);
  assert.equal(stats.averageMs, null);
});
