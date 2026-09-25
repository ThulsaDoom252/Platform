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
