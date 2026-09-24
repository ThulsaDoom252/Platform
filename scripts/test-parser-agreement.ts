/**
 * Словник согласия / несогласия: статус, динамик, перевод и примеры-диалоги.
 * Запуск: npx tsx scripts/test-parser-agreement.ts
 */
import assert from "node:assert/strict";
import { parseMaterial } from "../src/lib/materials-parser";

const sample = `✅ Strong Agreement — Сильна згода
✅ 🔊 Absolutely! — Абсолютно! / Звичайно!
• Do you like it? — Absolutely! — Тобі подобається? — Абсолютно!
• Absolutely, I agree with you. — Звичайно, я з тобою згодна.
✅ 🔊 Definitely! — Точно! / Однозначно!
• Will you come? — Definitely! — Ти прийдеш? — Точно!
• Definitely, that's a great idea. — Однозначно, це чудова ідея.
✅ 🔊 Couldn't agree more — Повністю згодна / Не могла б погодитись більше
• I couldn't agree more with you. — Я повністю з тобою згодна.
• That's true — couldn't agree more. — Це правда — повністю погоджуюсь.
✅ 🔊 I completely agree with that — Я повністю з цим згодна
• I completely agree with that idea. — Я повністю згодна з цією ідеєю.
• I completely agree with what you said. — Я повністю згодна з тим, що ти сказала.
✅ 🔊 Exactly! — Саме так! / Точно!
• That's exactly what I think! — Це саме те, що я думаю!
• Exactly, you're right. — Саме так, ти права.
✅ 🔊 That's so true — Це так правда / Абсолютно вірно
• That's so true, I feel the same. — Це так правда, я відчуваю те саме.
• That's so true about Mondays! — Це так правда щодо понеділків!
✅ 🔊 100% — Сто відсотків / Повністю
• Do you agree? — 100%! — Ти згодна? — Сто відсотків!
• I support this 100%. — Я підтримую це на всі сто.
✅ 🔊 Indeed — Справді / Дійсно
• Indeed, that's a good point. — Справді, це гарна думка.
• Indeed, she was right all along. — Дійсно, весь час була права.

❌ Strong Disagreement — Категорична незгода
❌ 🔊 Absolutely not! — Абсолютно ні!
• Can I skip it? — Absolutely not! — Можна пропустити? — Абсолютно ні!
• Absolutely not, that's a bad idea. — Абсолютно ні, це погана ідея.
❌ 🔊 Definitely not! — Однозначно ні!
• Is it a good plan? — Definitely not! — Це хороший план? — Однозначно ні!
• Definitely not — I won't do it. — Однозначно ні — я цього не зроблю.
❌ 🔊 No way! — Ні за що! / Ні в якому разі!
• Will you do it? — No way! — Ти це зробиш? — Ні за що!
• No way, that's impossible. — Ні в якому разі, це неможливо.
❌ 🔊 I don't think so — Я так не думаю
• Is it a good idea? — I don't think so. — Це гарна ідея? — Я так не думаю.
• I don't think so, it's too risky. — Я так не думаю, це занадто ризиковано.
❌ 🔊 That's out of the question — Це виключено / Про це не може бути й мови
• That's out of the question — Про це не може бути й мови!
• Going there alone? That's out of the question. — Іти туди одній? Це виключено.
❌ 🔊 That's nonsense — Це нісенітниця / Це дурниця
• That's nonsense, it can't be true. — Це нісенітниця, це не може бути правдою.
• That's complete nonsense! — Це повна дурниця!
❌ 🔊 Not at all — Зовсім ні / Ні в якому разі
• Do you agree? — Not at all. — Ти згодна? — Зовсім ні.
• Not at all — I think the opposite. — Зовсім ні — я думаю навпаки.
❌ 🔊 I totally disagree with that — Я категорично не згодна з цим
• I totally disagree with that decision. — Я категорично не згодна з цим рішенням.
• I totally disagree with that opinion. — Я повністю не згодна з цією думкою.`;

const result = parseMaterial(sample, "vocabulary");
const phrases = result.phrases.filter((phrase) => phrase.kind === "PHRASE");

assert.equal(result.warnings.length, 0);
assert.equal(phrases.length, 16);
assert.equal(phrases.filter((phrase) => phrase.section?.startsWith("Strong Agreement")).length, 8);
assert.equal(
  phrases.filter((phrase) => phrase.section?.startsWith("Strong Disagreement")).length,
  8,
);
assert.ok(phrases.every((phrase) => phrase.examples.length === 2));
assert.equal(phrases[0].icon, "✅");
assert.equal(phrases[8].icon, "❌");
assert.deepEqual(phrases[0].examples[0], {
  en: "Do you like it? — Absolutely!",
  tr: "Тобі подобається? — Абсолютно!",
});

console.log("OK: 16 записей, 2 секции, по 2 примера; диалоги разделены по языкам.");
