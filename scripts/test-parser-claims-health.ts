import assert from "node:assert/strict";
import { parseMaterial } from "../src/lib/materials-parser";

const source = [
  "🧪 Tasks & Public Health — Завдання та громадське здоров’я",
  "📌 🔊 to assign to — призначати до / доручати комусь",
  "• The manager assigned the task to me. — Керівник доручив мені це завдання.",
  "• She was assigned to the research team. — Її призначили до дослідницької групи.",
  "🦠 🔊 an epidemic /ˌep.ɪˈdem.ɪk/ — епідемія",
  "• The epidemic spread rapidly. — Епідемія швидко поширилася.",
  "⚠️ 🔊 an outbreak /ˈaʊt.breɪk/ — спалах / раптовий початок",
  "• An outbreak closed the school. — Через спалах школу закрили.",
  "💡 🔊 to put forward — висувати / пропонувати",
  "• She put forward a proposal. — Вона висунула пропозицію.",
  "↩️ 🔊 withdrawal /wɪðˈdrɔː.əl/ — виведення / зняття",
  "⬅️ 🔊 to withdraw /wɪðˈdrɔː/ — відкликати / відмовлятися",
  "⭐ 🔊 significant /sɪɡˈnɪf.ɪ.kənt/ — значний / важливий",
  "📚 🔊 content /ˈkɒn.tent/; /kənˈtent/ — зміст; задоволений",
  "💡 Content. Іменник і прикметник мають різний наголос.",
].join("\n");

const result = parseMaterial(source, "vocabulary");
assert.deepEqual(result.warnings, []);

const byPhrase = new Map(result.phrases.map((phrase) => [phrase.phrase, phrase]));
for (const phrase of ["to assign to", "an outbreak", "to put forward"]) {
  assert.equal(byPhrase.get(phrase)?.kind, "PHRASE", `${phrase} must be a phrase`);
}
assert.equal(byPhrase.get("to assign to")?.examples.length, 2);
assert.equal(byPhrase.get("an epidemic")?.examples.length, 1);
assert.equal(byPhrase.get("an outbreak")?.examples.length, 1);
assert.equal(byPhrase.get("withdrawal")?.icon, "↩️");
assert.equal(byPhrase.get("to withdraw")?.icon, "⬅️");
assert.equal(byPhrase.get("significant")?.icon, "⭐");
assert.equal(byPhrase.get("content")?.transcription, "/ˈkɒn.tent/; /kənˈtent/");
assert.equal(byPhrase.get("Content")?.kind, "NOTE");

console.log("Парсер Claims, Health & Research: ok");
