/**
 * Словник с двумя эмодзи в строке, врезками и разделами по темам.
 * Запуск: npx tsx scripts/test-parser-clothing.ts
 */
import { parseMaterial } from "../src/lib/materials-parser";

const sample = `👗 CLOTHING — ОДЯГ
🔊 натисни на гучномовець щоб почути вимову

📌 Різниця між дієсловами:
➕ to put on — надягати (дія, одного разу) → She PUT ON her coat.
👗 to wear — носити (стан, регулярно або зараз) → She WEARS jeans every day.

🏃 Verbs — Дієслова
👗 🔊 to fit /fɪt/ — підходити за розміром / пасувати
• These jeans fit me perfectly. — Ці джинси ідеально підходять мені за розміром.
• This dress doesn't fit her. — Ця сукня їй не підходить за розміром.
🧵 🔊 to get dressed /tə ɡet drest/ — одягатися (процес)
• She gets dressed in 5 minutes. — Вона одягається за 5 хвилин.

👗 Clothing — Одяг
🧵 🔊 a blouse /ə blaʊz/ — блузка
• She wore a white blouse. — Вона була в білій блузці.
👗 🔊 a dress /ə dres/ — сукня
• She wore a red dress. — Вона була в червоній сукні.

🥾 Footwear — Взуття
🥾 🔊 a boot /ə buːt/ — чобіт / черевик (один)
• She has a collection of boots. — У неї колекція чобіт.

⚠️ Always Plural — Завжди множина
⚠️ Ці слова завжди у множині — навіть якщо маєш одну штуку!
✗ a jean ✗ a trouser ✗ a short ✗ a pant
✓ jeans ✓ trousers ✓ shorts ✓ pants
👖 🔊 jeans /dʒiːnz/ — джинси
• These jeans are my favourite. — Ці джинси мої улюблені.`;

const res = parseMaterial(sample, "vocabulary");

console.log("title:", res.title, "| description:", res.description);
console.log("записей:", res.phrases.length, "| предупреждений:", res.warnings.length);
for (const w of res.warnings) console.log("  !", w);
console.log("");
for (const p of res.phrases) {
  console.log(
    [
      p.kind === "NOTE" ? "note" : "word",
      p.icon,
      (p.section ?? "—").padEnd(26),
      p.phrase.slice(0, 26).padEnd(26),
      (p.transcription ?? "").padEnd(16),
      p.translation.slice(0, 34).padEnd(34),
      `[${p.examples.length}]`,
    ].join(" | "),
  );
}
console.log("\nОЖИДАЕТСЯ: 4 раздела, заметки от ⚠️ и ✗/✓, 0 предупреждений");
