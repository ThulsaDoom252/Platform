/** Ручная проверка парсера на кусках документа. Запуск: npx tsx scripts/test-parser.ts */
import { parseMaterial } from "../src/lib/materials-parser";

const sample = `LANGUAGE & WORDPLAY — МОВА ТА ГРА СЛІВ
ЛЕКСИКА ПРО СЛОВЕСНІ ІГРИ, МОВУ ТА СПІЛКУВАННЯ

Adjectives — Language & Attitudes
avid /ˈæv.ɪd/ — завзятий / пристрасний
• She is an avid reader of historical novels. — Вона — завзята читачка історичних романів.
• He is an avid traveller. — Він — пристрасний мандрівник.

Game Descriptions — Опис гри
a close game — напружена гра / гра приблизно рівних суперників
• It was a close game, but we won 2-1. — Це була напружена гра, але ми перемогли 2:1.

Similes & Idioms — Descriptions & Impressions
He's as hard as nails — він дуже витривалий / незламний
• My grandfather is as hard as nails and never complains. — Мій дідусь дуже витривалий.
She went as white as a sheet — вона зблідла / стала білою як полотно
• She went as white as a sheet when she heard the news. — Вона стала білою як полотно.

💡 Mark vs stain. Mark — загальна назва сліду. Stain — пляма від речовини.`;

const res = parseMaterial(sample, "vocabulary");

console.log("TITLE:      ", res.title);
console.log("DESCRIPTION:", res.description);
console.log("WARNINGS:   ", res.warnings.length ? res.warnings : "нет");
console.log("");

let section: string | null = null;
for (const p of res.phrases) {
  if (p.section !== section) {
    section = p.section;
    console.log(`\n=== СЕКЦИЯ: ${section ?? "(без секции)"} ===`);
  }
  if (p.kind === "NOTE") {
    console.log(`  💡 ЗАМЕТКА: ${p.phrase} ⇒ ${p.translation}`);
    continue;
  }
  console.log(`  ${p.icon} ${p.phrase} ${p.transcription ?? ""}`);
  console.log(`     ⇒ ${p.translation}`);
  for (const e of p.examples) console.log(`       • ${e.en}`);
}

const phrases = res.phrases.filter((p) => p.kind === "PHRASE").length;
const notes = res.phrases.filter((p) => p.kind === "NOTE").length;
console.log(`\nИТОГО: ${phrases} записей, ${notes} заметок`);
console.log("ОЖИДАЕТСЯ: 4 записи, 1 заметка, 3 секции");
