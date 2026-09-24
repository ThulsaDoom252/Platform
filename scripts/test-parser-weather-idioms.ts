/**
 * Идиомы о погоде: пояснение 💡 между выражением и его примерами.
 * Запуск: npx tsx scripts/test-parser-weather-idioms.ts
 */
import assert from "node:assert/strict";
import { parseMaterial } from "../src/lib/materials-parser";

const sample = `💬 Idioms — Ідіоми
🌦 🔊 as right as rain — здоровий як бик / у повному порядку
💡 Почуваєшся абсолютно добре / здоровим після хвороби або проблем.
• Don’t worry — after some rest you’ll be as right as rain. — Не хвилюйся — після відпочинку ти будеш здорова як ніколи.
• She was ill last week, but now she's as right as rain. — Минулого тижня вона хворіла, але тепер повністю здорова.
🧊 🔊 break the ice — зламати лід / розрядити обстановку
💡 Зробити щось, щоб зняти напругу або незручність на початку спілкування.
• He told a joke to break the ice at the meeting. — Він розповів жарт, щоб розрядити обстановку на зустрічі.
• A smile can break the ice in any situation. — Посмішка може зламати лід у будь-якій ситуації.
🌧 🔊 it's raining cats and dogs — іде дощ як з відра / ллє як з відра
💡 Дуже сильний дощ.
• We can't go out — it's raining cats and dogs! — Ми не можемо вийти — ллє як з відра!
• I got completely soaked — it was raining cats and dogs. — Я промокла наскрізь — дощ лив як з відра.
🌦 🔊 it never rains but it pours — прийшла біда — відчиняй ворота
💡 Неприємності рідко трапляються поодиноко — зазвичай всі проблеми приходять разом.
• I lost my phone, then my wallet — it never rains but it pours. — Я загубила телефон, потім гаманець — прийшла біда, відчиняй ворота.
• It never rains but it pours — three problems in one day. — Всі проблеми разом — три неприємності за один день.
🌫 🔊 my mind is in a fog — голова як в тумані / думки заплутані
💡 Відчуття плутанини, неможливість ясно мислити.
• I haven't slept — my mind is in a fog today. — Я не спала — сьогодні голова як в тумані.
• After the long meeting my mind was in a fog. — Після довгої наради думки були заплутані.
🧊 🔊 to be on thin ice — бути на тонкому льоду / ризикувати
💡 Перебувати в небезпечній або ризикованій ситуації.
• Be careful — you're on thin ice with the boss right now. — Обережно — ти зараз на тонкому льоду з Босом.
• He's on thin ice after missing three deadlines. — Він на тонкому льоду після трьох пропущених дедлайнів.
❄ 🔊 a frosty reception — холодний прийом / крижаний прийом
💡 Недружній або холодний прийом від людей.
• The new manager got a frosty reception from the team. — Новий менеджер отримав холодний прийом від команди.
• Her idea was met with a frosty reception. — Її ідею було зустрінуто холодно.
🌂 🔊 to take a rain check — відкласти на інший раз / попросити перенести
💡 Відмовитися від чогось зараз, але погодитися зробити це пізніше.
• I can't come tonight — can I take a rain check? — Я не можу прийти сьогодні — можна перенесемо на інший раз?
• She took a rain check on dinner and came the next week. — Вона попросила перенести вечерю і прийшла наступного тижня.
🌧 🔊 under the weather — почуватися недобре / занедужати
💡 Почуватися хворою або погано — зазвичай фізично.
• I'm feeling a bit under the weather today. — Сьогодні я почуваюся трохи недобре.
• He stayed home because he was under the weather. — Він залишився вдома, бо почувався погано.`;

const result = parseMaterial(sample, "vocabulary");
const phrases = result.phrases.filter((item) => item.kind === "PHRASE");
const notes = result.phrases.filter((item) => item.kind === "NOTE");

assert.equal(result.warnings.length, 0);
assert.equal(phrases.length, 9);
assert.equal(notes.length, 9);
assert.ok(phrases.every((phrase) => phrase.section === "Idioms — Ідіоми"));
assert.ok(notes.every((note) => note.section === "Idioms — Ідіоми"));
assert.ok(phrases.every((phrase) => phrase.examples.length === 2));
assert.deepEqual(phrases[0].examples[0], {
  en: "Don’t worry — after some rest you’ll be as right as rain.",
  tr: "Не хвилюйся — після відпочинку ти будеш здорова як ніколи.",
});
assert.deepEqual(phrases[7].examples[0], {
  en: "I can't come tonight — can I take a rain check?",
  tr: "Я не можу прийти сьогодні — можна перенесемо на інший раз?",
});

console.log("OK: 9 идиом, 9 заметок, по 2 примера; внутренние тире сохранены.");
