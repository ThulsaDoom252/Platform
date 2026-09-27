import { test } from "node:test";
import assert from "node:assert/strict";
import { imageQuery, looksLikeText, pickCandidates } from "../src/lib/image-query";

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
