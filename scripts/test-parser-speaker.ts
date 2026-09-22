/**
 * Словник со значком озвучки и подписью рядом с ним.
 * Запуск: npx tsx scripts/test-parser-speaker.ts
 */
import { parseMaterial } from "../src/lib/materials-parser";

const sample = `📖  VOCABULARY
ЛЕКСИКА


🔵 Adverbs — Прислівники
🔊 слухати  accidentally /ˌæk.sɪˈden.təl.i/  —  випадково
• I accidentally broke my cup.  — Я випадково розбив свою чашку.
🔊 слухати  suddenly /ˈsʌd.ən.li/  —  раптом
• It suddenly started to rain.  — Раптом почався дощ.
🔊 слухати  fortunately / unfortunately /ˈfɔː.tʃənətli/  —  на щастя / на жаль
• Fortunately, we were on time.  — На щастя, ми прийшли вчасно.
🔊 слухати  basically /ˈbeɪ.sɪ.kəl.i/  —  в основному, по суті
• Basically, it is very easy.  — По суті, це дуже легко.
💬 Phrases and Words — Фрази та слова
🔊 слухати  It's all started when... /ɪts ɔːl stɑːrtɪd wen/ — Все почалося тоді, коли...
• It's all started when I met my best friend. — Все почалося тоді, коли я зустрів свого найкращого друга.
🔊 слухати  one day / once /wʌn deɪ/ — одного дня / одного разу
• One day we went to the beach. — Одного дня ми поїхали на пляж.
🔊 слухати  then / after that / next /ðen/ — потім / після цього / далі
• We had lunch. Then we went home. — Ми пообідали. Потім ми пішли додому.`;

const res = parseMaterial(sample, "vocabulary");

console.log("title:", res.title, "| description:", res.description);
console.log("записей:", res.phrases.length, "| предупреждений:", res.warnings.length);
for (const w of res.warnings) console.log("  !", w);
console.log("");
for (const p of res.phrases) {
  console.log(
    [
      p.icon,
      (p.section ?? "—").padEnd(28),
      p.phrase.padEnd(30),
      (p.transcription ?? "").padEnd(22),
      p.translation,
      `[${p.examples.length} прим.]`,
    ].join(" | "),
  );
}
console.log("\nОЖИДАЕТСЯ: 7 записей, у каждой 1 пример, 2 раздела, 0 предупреждений");
