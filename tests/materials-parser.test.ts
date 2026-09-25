import assert from "node:assert/strict";
import test from "node:test";
import { parseMaterial } from "../src/lib/materials-parser";

const entryWithUnmarkedExamples = `
to be named after — бути названим на честь
He is named after his father. — Він названий на честь батька.
The street is named after a writer. — Вулиця названа на честь письменника.

to give somebody/something a bad name — зіпсувати репутацію
Lies give him a bad name. — Брехня псує йому репутацію.
This story gave the brand a bad name. — Ця історія зіпсувала репутацію бренду.

you name it — що завгодно / все, що хочеш
We have pizza, pasta — you name it. — У нас є піца, паста — що завгодно.
He can fix cars, bikes — you name it. — Він може лагодити авто, велосипеди — все, що хочеш.

I didn’t catch your name — я не почув твоє ім’я
Sorry, I didn’t catch your name. — Вибач, я не почув твоє ім’я.
I didn’t catch your name, could you repeat? — Я не почув твоє ім’я, повтори, будь ласка.

to call someone names — обзивати когось
Don’t call people names. — Не обзивай людей.
Kids sometimes call each other names. — Діти інколи обзивають одне одного.
`;

test("groups unmarked bilingual examples under their vocabulary entries", () => {
  const result = parseMaterial(entryWithUnmarkedExamples, "vocabulary");

  assert.deepEqual(
    result.phrases.map((phrase) => [phrase.phrase, phrase.examples.length]),
    [
      ["to be named after", 2],
      ["to give somebody/something a bad name", 2],
      ["you name it", 2],
      ["I didn’t catch your name", 2],
      ["to call someone names", 2],
    ],
  );
  assert.deepEqual(result.phrases[2].examples[0], {
    en: "We have pizza, pasta — you name it.",
    tr: "У нас є піца, паста — що завгодно.",
  });
  assert.deepEqual(result.warnings, []);
});

test("keeps an explicit vocabulary entry even when it has no examples", () => {
  const result = parseMaterial(
    "🧠 reliable /rɪˈlaɪ.ə.bəl/ — надёжный",
    "vocabulary",
  );

  assert.equal(result.phrases.length, 1);
  assert.equal(result.phrases[0].phrase, "reliable");
  assert.equal(result.phrases[0].translation, "надёжный");
  assert.deepEqual(result.phrases[0].examples, []);
  assert.deepEqual(result.warnings, []);
});

test("keeps a Word/Examples table row when its examples cell is empty", () => {
  const result = parseMaterial(
    "Word / Phrase\tExamples\n🧠 reliable /rɪˈlaɪ.ə.bəl/ надёжный\t",
    "vocabulary",
  );

  assert.equal(result.vocabularyFormat, "word-examples-table");
  assert.equal(result.phrases[0].phrase, "reliable");
  assert.equal(result.phrases[0].translation, "надёжный");
  assert.deepEqual(result.phrases[0].examples, []);
  assert.deepEqual(result.warnings, []);
});

test("parses Google vertical separators and a split bilingual dialogue", () => {
  const source = `[🧱 Nouns (Существительные)
🎯 opportunity /ˌɒp.əˈtjuː.nə.ti/ — возможность\u000B • This job is a great opportunity. — Эта работа — отличная возможность.\u000B • I missed the opportunity to speak. — Я упустил возможность выступить.
⚙️ Verbs (Глаголы)
🔄 to change /tʃeɪndʒ/ — менять(ся)\u000B • I want to change my job. — Я хочу сменить работу.\u000B • People change over time. — Люди меняются со временем.
📈 to improve my skills /ɪmˈpruːv/ — совершенствовать свои навыки\u000B • I want to improve my skills this year. — Я хочу улучшить свои навыки в этом году.\u000B • She improves her skills every day. — Она совершенствует свои навыки каждый день.
🙏 to appreciate /əˈpriː.ʃieɪt/ — ценить\u000B • I really appreciate your help. — Я очень ценю твою помощь.\u000B • She appreciates honest feedback. — Она ценит честную обратную связь.
🧩 Adjectives (Прилагательные)
😒 ugly /ˈʌɡ.li/ — уродливый\u000B • That building is ugly. — То здание уродливое.\u000B • He called the picture ugly. — Он назвал картину уродливой.
🔌 Phrase (Фраза)
💼 What do you do for a living? — Чем вы зарабатываете на жизнь?\u000B • — What do you do for a living? — I’m a teacher.\u000B — Чем вы зарабатываете на жизнь? — Я учитель.]`;

  const result = parseMaterial(source, "vocabulary");

  assert.deepEqual(
    result.phrases.map((phrase) => [phrase.phrase, phrase.examples.length]),
    [
      ["opportunity", 2],
      ["to change", 2],
      ["to improve my skills", 2],
      ["to appreciate", 2],
      ["ugly", 2],
      ["What do you do for a living?", 1],
    ],
  );
  assert.deepEqual(result.phrases[5].examples[0], {
    en: "— What do you do for a living? — I’m a teacher.",
    tr: "Чем вы зарабатываете на жизнь? — Я учитель.",
  });
  assert.deepEqual(result.warnings, []);
});
