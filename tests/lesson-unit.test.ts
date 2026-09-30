import { test } from "node:test";
import assert from "node:assert/strict";
import {
  alphaKey,
  BRITISH_OPTION,
  canSee,
  categoryKey,
  findWords,
  groupWords,
  sortCategories,
  sortWords,
  type LessonWord,
  lineKey,
  lexisBlockKey,
  lineWordKey,
  lineWords,
  openSections,
  parseKey,
  parseTranscript,
  sectionKey,
  speakerTint,
  speakersOf,
  lessonFocus,
  normalizeLessonHighlights,
  toggleDialogueHighlight,
  toggleWordFocus,
  selectedLexisGroup,
  selectLexisGroup,
  yellowHighlights,
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

test("настройка UK не превращается в секцию урока", () => {
  assert.deepEqual(openSections(["video", BRITISH_OPTION]), ["vocab", "video"]);
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

test("фокус урока всегда оставляет только одно слово и цвет темы", () => {
  const first = toggleWordFocus({}, wordKey("a"));
  assert.equal(lessonFocus(first), wordKey("a"));
  assert.equal(lessonFocus(toggleWordFocus(first, wordKey("b"))), wordKey("b"));
  assert.deepEqual(toggleWordFocus({ "word:a": "red", "word:b": "green" }, wordKey("c")), {
    __focus: "word:c",
  });
});

test("повторный клик снимает фокус, а целая реплика не считается словом", () => {
  const first = toggleWordFocus({}, lineWordKey(0, 2));
  assert.deepEqual(toggleWordFocus(first, lineWordKey(0, 2)), {});
  assert.deepEqual(toggleWordFocus(first, lineKey(0)), normalizeLessonHighlights(first));
});

test("жёлтых выделений в диалоге может быть сколько угодно", () => {
  let marks = toggleDialogueHighlight({}, lineWordKey(0, 2));
  marks = toggleDialogueHighlight(marks, lineWordKey(1, 4));
  marks = toggleDialogueHighlight(marks, lineKey(2));

  assert.deepEqual(yellowHighlights(marks), {
    "line:0:2": "yellow",
    "line:1:4": "yellow",
    "line:2": "yellow",
  });
});

test("повторный клик снимает только выбранное жёлтое выделение", () => {
  let marks = toggleDialogueHighlight({}, lineWordKey(0, 2));
  marks = toggleDialogueHighlight(marks, lineWordKey(1, 4));
  marks = toggleDialogueHighlight(marks, lineWordKey(0, 2));

  assert.deepEqual(yellowHighlights(marks), { "line:1:4": "yellow" });
});

test("фокус и жёлтые выделения не стирают друг друга", () => {
  let marks = toggleDialogueHighlight({}, lineWordKey(0, 2));
  marks = toggleWordFocus(marks, lineWordKey(1, 4));

  assert.equal(lessonFocus(marks), lineWordKey(1, 4));
  assert.deepEqual(yellowHighlights(marks), { "line:0:2": "yellow" });
});

test("лексическая группа и её запись фокусируются независимо", () => {
  let marks = selectLexisGroup({}, "group-1");
  marks = toggleWordFocus(marks, lexisBlockKey("group-1", 3));

  assert.equal(selectedLexisGroup(marks), "group-1");
  assert.equal(lessonFocus(marks), lexisBlockKey("group-1", 3));
  assert.deepEqual(parseKey(lexisBlockKey("group-1", 3)), {
    kind: "lexisBlock",
    groupId: "group-1",
    block: 3,
  });
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

test("лексика идёт сразу после словника", () => {
  assert.equal(LESSON_SECTIONS.length, 6);
  assert.equal(LESSON_SECTIONS[0], "vocab");
  assert.equal(LESSON_SECTIONS[1], "lexis");
});

// ---------- словник урока ----------

test("служебные to и артикли в алфавит не идут", () => {
  /*
   * Иначе половина словника собирается на «t» и «a», и глазами там
   * ничего не найти.
   */
  assert.equal(alphaKey("to wonder"), "wonder");
  assert.equal(alphaKey("a threat"), "threat");
  assert.equal(alphaKey("an injury"), "injury");
  assert.equal(alphaKey("the bill"), "bill");
});

test("знаки препинания в начале алфавит не сбивают", () => {
  /*
   * Важно, что «(have) got to» встаёт на букву h, а не в начало списка
   * вместе со скобкой. Скобки внутри слова не трогаем — они часть
   * записи.
   */
  assert.ok(alphaKey("(have) got to").startsWith("have"));
  assert.equal(alphaKey("…menu"), "menu");
});

test("слово из одних служебных остаётся собой", () => {
  assert.equal(alphaKey("to"), "to");
  assert.equal(alphaKey(""), "");
});

test("слова встают по алфавиту, а не по порядку ввода", () => {
  const list = [
    { word: "to wonder" },
    { word: "a threat" },
    { word: "to concede" },
    { word: "guts" },
  ];
  assert.deepEqual(sortWords(list).map((w) => w.word), [
    "to concede",
    "guts",
    "a threat",
    "to wonder",
  ]);
});

test("сортировка не трогает исходный список", () => {
  const list = [{ word: "b" }, { word: "a" }];
  sortWords(list);
  assert.deepEqual(list.map((w) => w.word), ["b", "a"]);
});

test("категории идут привычным порядком, а не алфавитным", () => {
  const got = sortCategories(["💬 Phrases", "📦 Nouns", "🏃 Verbs"]);
  assert.deepEqual(got, ["📦 Nouns", "🏃 Verbs", "💬 Phrases"]);
});

test("незнакомая категория встаёт в конец", () => {
  const got = sortCategories(["Zebra words", "📦 Nouns"]);
  assert.deepEqual(got, ["📦 Nouns", "Zebra words"]);
});

test("эмодзи и регистр категорию не раздваивают", () => {
  assert.equal(categoryKey("🏃 Verbs"), categoryKey("verbs"));
});

test("словник раскладывается по категориям и алфавиту сразу", () => {
  const groups = groupWords([
    { word: "to wonder", category: "🏃 Verbs" },
    { word: "a threat", category: "📦 Nouns" },
    { word: "to concede", category: "🏃 Verbs" },
    { word: "guts", category: "📦 Nouns" },
  ]);

  assert.deepEqual(groups.map((g) => g.category), ["📦 Nouns", "🏃 Verbs"]);
  assert.deepEqual(groups[0].words.map((w) => w.word), ["guts", "a threat"]);
  assert.deepEqual(groups[1].words.map((w) => w.word), ["to concede", "to wonder"]);
});

// ---------- поиск ----------

const vocabWord = (word: string, extra: Partial<LessonWord> = {}): LessonWord => ({
  id: word,
  category: "📦 Nouns",
  icon: null,
  word,
  ipaUs: null,
  ipaUk: null,
  translation: null,
  description: null,
  imageUrl: null,
  ...extra,
});

test("ищем и по слову, и по переводу, и по описанию", () => {
  const words = [
    vocabWord("a wound", { translation: "рана", description: "a cut in the body" }),
    vocabWord("guts", { translation: "сміливість", description: "courage" }),
  ];

  assert.deepEqual(findWords(words, "wound").map((w) => w.word), ["a wound"]);
  assert.deepEqual(findWords(words, "сміл").map((w) => w.word), ["guts"]);
  assert.deepEqual(findWords(words, "courage").map((w) => w.word), ["guts"]);
});

test("пустой запрос отдаёт весь словник", () => {
  const words = [vocabWord("a"), vocabWord("b")];
  assert.equal(findWords(words, "   ").length, 2);
});

test("регистр поиску не мешает", () => {
  const words = [vocabWord("Headshot")];
  assert.equal(findWords(words, "HEAD").length, 1);
});
