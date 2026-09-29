import { test } from "node:test";
import assert from "node:assert/strict";
import {
  canSee,
  lineKey,
  lineWordKey,
  lineWords,
  openSections,
  parseKey,
  parseTranscript,
  sectionKey,
  speakerTint,
  speakersOf,
  toggleHighlight,
  wordKey,
  LESSON_SECTIONS,
} from "../src/lib/lesson-unit";

// ---------- что ученику видно ----------

test("словник открыт всегда, даже если его не открывали", () => {
  /*
   * С него урок и начинается. Забытая галочка не должна оставлять
   * ученика перед пустым экраном.
   */
  assert.deepEqual(openSections(null), ["vocab"]);
  assert.deepEqual(openSections([]), ["vocab"]);
  assert.equal(canSee([], "vocab"), true);
});

test("остальные секции закрыты, пока их не открыли", () => {
  assert.equal(canSee([], "video"), false);
  assert.equal(canSee(["video"], "video"), true);
  assert.equal(canSee(["video"], "transcript"), false);
});

test("секции идут в порядке урока, а не в порядке открытия", () => {
  const open = openSections(["homework", "video"]);
  assert.deepEqual(open, ["vocab", "video", "homework"]);
});

test("чужое имя секции не проходит", () => {
  assert.deepEqual(openSections(["video", "хакер"]), ["vocab", "video"]);
});

// ---------- расшифровка ----------

test("реплики разбираются по «Имя: текст»", () => {
  const lines = parseTranscript("Anna: Hello there!\nBen: Hi, Anna.");
  assert.deepEqual(lines, [
    { speaker: "Anna", text: "Hello there!" },
    { speaker: "Ben", text: "Hi, Anna." },
  ]);
});

test("строка без имени продолжает прошлую реплику", () => {
  // В расшифровках перенос посреди фразы — обычное дело.
  const lines = parseTranscript("Anna: Hello there,\nhow are you?");
  assert.equal(lines.length, 1);
  assert.equal(lines[0].text, "Hello there, how are you?");
});

test("двоеточия внутри реплики именем не становятся", () => {
  const lines = parseTranscript("Anna: Listen: this is the important part.");
  assert.equal(lines[0].speaker, "Anna");
  assert.equal(lines[0].text, "Listen: this is the important part.");
});

test("длинное начало до двоеточия — это текст, а не имя", () => {
  const lines = parseTranscript(
    "And then he said something very long indeed: run.",
  );
  assert.equal(lines[0].speaker, "");
});

test("пустые строки не дают пустых реплик", () => {
  const lines = parseTranscript("\n\nAnna: Hi.\n\n\nBen: Hi.\n\n");
  assert.equal(lines.length, 2);
});

test("пустая расшифровка — пустой список", () => {
  assert.deepEqual(parseTranscript(""), []);
  assert.deepEqual(parseTranscript("   \n  \n"), []);
});

test("говорящие перечисляются по первому появлению", () => {
  const lines = parseTranscript("Ben: One.\nAnna: Two.\nBen: Three.");
  assert.deepEqual(speakersOf(lines), ["Ben", "Anna"]);
});

test("цвет держится за порядком, а не за именем", () => {
  const speakers = ["Ben", "Anna"];
  assert.equal(speakerTint(speakers, "Ben"), speakerTint(["Ben", "Kate"], "Ben"));
  assert.notEqual(speakerTint(speakers, "Ben"), speakerTint(speakers, "Anna"));
});

test("незнакомому говорящему цвет всё равно находится", () => {
  assert.equal(typeof speakerTint(["Ben"], "Kate"), "string");
});

// ---------- подсветки ----------

test("ключ помнит, на что показывает", () => {
  assert.deepEqual(parseKey(wordKey("abc")), { kind: "word", phraseId: "abc" });
  assert.deepEqual(parseKey(lineKey(3)), { kind: "line", index: 3 });
  assert.deepEqual(parseKey(lineWordKey(3, 7)), { kind: "lineWord", index: 3, at: 7 });
  assert.deepEqual(parseKey(sectionKey("video")), { kind: "section", section: "video" });
});

test("испорченный ключ не разбирается", () => {
  assert.equal(parseKey("line:abc"), null);
  assert.equal(parseKey("line:-1"), null);
  assert.equal(parseKey("section:секретная"), null);
  assert.equal(parseKey("непонятно"), null);
});

test("тот же цвет на том же месте снимает подсветку", () => {
  // Отдельная кнопка «убрать» заставляла бы целиться дважды.
  const once = toggleHighlight({}, wordKey("a"), "red");
  assert.deepEqual(once, { "word:a": "red" });
  assert.deepEqual(toggleHighlight(once, wordKey("a"), "red"), {});
});

test("другой цвет заменяет, а не добавляет", () => {
  const red = toggleHighlight({}, lineKey(1), "red");
  const green = toggleHighlight(red, lineKey(1), "green");
  assert.deepEqual(green, { "line:1": "green" });
});

test("подсветка одного места не трогает соседние", () => {
  let marks: Record<string, string> = {};
  marks = toggleHighlight(marks, wordKey("a"), "red");
  marks = toggleHighlight(marks, lineKey(0), "amber");
  marks = toggleHighlight(marks, wordKey("a"), "red");

  assert.deepEqual(marks, { "line:0": "amber" });
});

// ---------- слова реплики ----------

test("реплика режется на слова с сохранением пробелов", () => {
  const parts = lineWords("Hi, Anna.");
  // Склеенные обратно, они дают ту же строку — иначе подсветка
  // сдвигала бы текст.
  assert.equal(parts.join(""), "Hi, Anna.");
  assert.deepEqual(parts, ["Hi,", " ", "Anna."]);
});

test("пустая реплика не даёт слов", () => {
  assert.deepEqual(lineWords(""), []);
});

test("секций ровно пять и словник первый", () => {
  assert.equal(LESSON_SECTIONS.length, 5);
  assert.equal(LESSON_SECTIONS[0], "vocab");
});
