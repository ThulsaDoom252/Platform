import { test } from "node:test";
import assert from "node:assert/strict";
import { buildDeck, hasNext, scoreOf, shuffle, type DeckCard } from "../src/lib/game-deck";

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
  translation: null,
  imageUrl: `/uploads/${word}.png`,
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
