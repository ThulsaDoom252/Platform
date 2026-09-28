import { test } from "node:test";
import assert from "node:assert/strict";
import {
  imageQuery,
  looksLikeText,
  pickCandidates,
  relevance,
} from "../src/lib/image-query";

test("пояснение в скобках в запрос не идёт", () => {
  assert.equal(imageQuery("on the left (side)"), "left");
  assert.equal(imageQuery("(a) cup of tea"), "cup tea");
});

test("из вариантов через слеш берётся первый", () => {
  assert.equal(imageQuery("sofa / couch"), "sofa");
});

test("инфинитивное to и артикли отбрасываются", () => {
  assert.equal(imageQuery("to sneeze"), "sneeze");
  assert.equal(imageQuery("a piece of cake"), "piece cake");
  assert.equal(imageQuery("the weather"), "weather");
});

test("служебное слово как само слово словника не тащит за собой to", () => {
  // «to have» уходило в поиск целиком: по общему списку значимых слов в
  // нём не оставалось, и запасной путь возвращал фразу как есть.
  assert.equal(imageQuery("to have"), "have");
  assert.equal(imageQuery("to be"), "be");
  assert.equal(imageQuery("to do"), "do");
  assert.equal(imageQuery("in front of"), "front");
});

test("заглушки sb и sth выкидываются", () => {
  assert.equal(imageQuery("give sb a hand"), "give hand");
  assert.equal(imageQuery("take care of sth"), "take care");
});

test("запрос не длиннее трёх слов", () => {
  const query = imageQuery("run out of time completely today");
  assert.ok(query.split(" ").length <= 3, query);
});

test("из одних служебных слов запрос всё-таки собирается", () => {
  // Иначе «in front of» не искалось бы вовсе.
  assert.ok(imageQuery("in front of").length > 0);
});

test("пустая и мусорная строка дают пустой запрос", () => {
  assert.equal(imageQuery(""), "");
  assert.equal(imageQuery("  "), "");
  assert.equal(imageQuery("123 !!!"), "");
});

test("картинки с текстом опознаются по тегам", () => {
  assert.equal(looksLikeText("typography, font, design"), true);
  assert.equal(looksLikeText("banner, sale"), true);
  assert.equal(looksLikeText("cat, animal, pet"), false);
  assert.equal(looksLikeText(""), false);
});

test("тег совпадает целиком, а не куском слова", () => {
  // «textile» и «letterbox» — не надписи.
  assert.equal(looksLikeText("textile, fabric"), false);
  assert.equal(looksLikeText("letterbox, mail"), false);
});

const candidate = (url: string, tags: string, popularity: number) => ({
  url,
  thumbUrl: url,
  tags,
  popularity,
});

test("подборка выкидывает надписи и берёт популярные", () => {
  const picked = pickCandidates([
    candidate("a", "cat, pet", 10),
    candidate("b", "typography, quote", 900),
    candidate("c", "cat, kitten", 50),
    candidate("d", "cat, animal", 30),
  ]);

  assert.deepEqual(picked.map((c) => c.url), ["c", "d", "a"]);
});

test("слово в первых тегах весит больше, чем в хвосте", () => {
  // Ровно тот случай, из-за которого «fork» находил торты: слово стояло
  // девятым тегом на снимке про десерт.
  assert.ok(relevance("fork, cutlery, kitchen", "fork") > relevance("cake, dessert, coffee, fork", "fork"));
  assert.equal(relevance("cat, pet", "dog"), 0);
  assert.equal(relevance("", "fork"), 0);
  assert.equal(relevance("fork, spoon", ""), 0);
});

test("тег из нескольких слов тоже считается", () => {
  assert.ok(relevance("piece of cake, dessert", "cake") > 0);
});

test("картинка про само слово обходит популярную не про то", () => {
  const picked = pickCandidates(
    [
      candidate("wallpaper", "wallpaper, background, desktop, fork", 5000),
      candidate("real", "fork, cutlery, kitchen", 10),
    ],
    3,
    "fork",
  );

  assert.deepEqual(picked.map((c) => c.url), ["real", "wallpaper"]);
});

test("без запроса порядок остаётся по популярности", () => {
  const picked = pickCandidates(
    [candidate("a", "cat", 10), candidate("b", "cat", 900)],
    3,
  );
  assert.deepEqual(picked.map((c) => c.url), ["b", "a"]);
});

test("если чистых не хватило — добираем остальными", () => {
  const picked = pickCandidates([
    candidate("a", "cat", 10),
    candidate("b", "text, word", 900),
  ]);

  // Чистая идёт первой, надпись — следом, но подборка не пустая.
  assert.deepEqual(picked.map((c) => c.url), ["a", "b"]);
});

test("пустой ответ поиска не ломает подборку", () => {
  assert.deepEqual(pickCandidates([]), []);
});
