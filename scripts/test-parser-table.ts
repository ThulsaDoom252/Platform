/**
 * Словник, оформленный таблицей: колонки Word / IPA / Translation
 * и заголовки по частям речи. Запуск: npx tsx scripts/test-parser-table.ts
 */
import { parseMaterial } from "../src/lib/materials-parser";

const sample = [
  "📖 Nouns — Іменники",
  "\tWord / Phrase\tIPA\tTranslation",
  "🔊\tan election\t/ɪˈlekʃən/\tвибори",
  "🔊\ta grave\t/ɡreɪv/\tмогила",
  "🔊\ta heart attack\t\tсерцевий напад / інфаркт",
  "🔊\tmoney laundering\t\tвідмивання грошей",
  "🔊\tofficials\t/əˈfɪʃəlz/\tпосадовці / офіційні особи",
  "🔊\trage\t/reɪdʒ/\tлють / сильний гнів; лютувати",
  "🔊\tschemes\t/skiːmz/\tсхеми / плани / програми",
  "🔊\tweed / weeds\t/wiːd/\tбур'ян / бур'яни; марихуана (розм.)",
  "🎨 Adjectives — Прикметники",
  "\tWord / Phrase\tIPA\tTranslation",
  "🔊\tto be desperate\t\tбути у відчаї / відчайдушно потребувати",
  "🔊\tto be united\t\tбути об'єднаними / згуртованими",
  "💡 Adverbs — Прислівники",
  "\tWord / Phrase\tIPA\tTranslation",
  "🔊\toutrageously\t/aʊtˈreɪ.dʒəs.li/\tобурливо / шокуюче / надзвичайно",
  "⚡ Verbs — Дієслова",
  "\tWord / Phrase\tIPA\tTranslation",
  "🔊\tto abuse\t/əˈbjuːz/\tзловживати / жорстоко поводитися",
  "🔊\tto be elected\t\tбути обраним",
  "🔊\tto verify\t/ˈver.ɪ.faɪ/\tперевіряти / підтверджувати достовірність",
].join("\n");

const res = parseMaterial(sample, "vocabulary");

console.log("записей:", res.phrases.length, "| предупреждений:", res.warnings.length);
for (const w of res.warnings) console.log("  !", w);
console.log("");
for (const p of res.phrases) {
  console.log(
    [
      p.icon,
      (p.section ?? "—").padEnd(24),
      p.phrase.padEnd(18),
      (p.transcription ?? "").padEnd(18),
      p.translation,
    ].join(" | "),
  );
}
console.log("\nОЖИДАЕТСЯ: 14 записей, 0 предупреждений, 4 раздела");
