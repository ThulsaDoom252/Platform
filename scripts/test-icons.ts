/**
 * База иконок и подбор по названию.
 * Запуск: npx tsx scripts/test-icons.ts
 *
 * Проверяет, что внутри групп нет одинаковых значков (иначе окно выбора
 * ругается на повторяющиеся ключи) и что названия разделов находятся
 * на всех трёх языках.
 */
import {
  PICKER_GROUPS,
  PICKER_ICON_COUNT,
  UNICODE_ICON_COUNT,
  ALL_ICONS,
  searchIcons,
} from "../src/lib/icons-data";
import { suggestIcon, suggestVocabularyIcon } from "../src/lib/icon-suggest";

const dup: string[] = [];
for (const g of PICKER_GROUPS) {
  const seen = new Set<string>();
  for (const [i] of g.icons) {
    if (seen.has(i)) dup.push(`${g.label}: ${i}`);
    seen.add(i);
  }
}

console.log("записей:", ALL_ICONS.length, "| групп:", PICKER_GROUPS.length);
console.log("уникальных значков:", new Set(ALL_ICONS.map(([i]) => i)).size);
console.log("дубли внутри групп:", dup.length ? dup.join(", ") : "нет");
console.log("");

const names = [
  "Body parts", "Частини тіла", "Части тела",
  "Professions", "Професії", "Профессии",
  "Weather", "Погода", "Actions", "Дії", "Действия",
  "Food", "Їжа", "City", "Місто", "Город",
  "Family", "Сім'я", "Health", "Здоров'я", "Здоровье",
  "School", "Школа", "Shopping", "Покупки",
  "Home", "Дім", "Дом", "Feelings", "Почуття", "Чувства",
  "Seasons", "Пори року", "Clothing", "Одяг", "Sport", "Спорт",
  "zzz qqq",
];

let misses = 0;
for (const n of names) {
  const icon = suggestIcon(n);
  if (!icon && n !== "zzz qqq") misses++;
  console.log((icon ?? "—").padEnd(4), n);
}

console.log(`\nНе подобрано (кроме бессмыслицы): ${misses}. Ожидается 0.`);

const catalogCases: [string, string][] = [
  ["армия", "🪖"],
  ["жесты", "👋"],
  ["емоции", "😀"],
  ["продукты", "🍎"],
  ["планеты", "🪐"],
  ["devil", "😈"],
  ["demon", "😈"],
  ["daemon", "😈"],
];

for (const [query, expected] of catalogCases) {
  const found = searchIcons(query).some(([icon]) => icon === expected);
  if (!found) throw new Error(`Поиск «${query}» не нашёл ${expected}`);
}

if (UNICODE_ICON_COUNT < 1_900 || PICKER_ICON_COUNT < UNICODE_ICON_COUNT) {
  throw new Error("Полный Unicode-каталог иконок не подключён");
}

console.log(
  `Полный каталог: ${UNICODE_ICON_COUNT} Unicode-записей, ${PICKER_ICON_COUNT} уникальных иконок.`,
);

const semanticCases: [string, string, string][] = [
  ["a deal", "сделка / договор", "🤝"],
  ["adulterers", "прелюбодеи / изменники", "💔"],
  ["ark-builders", "строители ковчега", "👷"],
  ["doorman", "привратник / охранник на входе", "🚪"],
  ["obsolete", "застарілий", "🗑️"],
];

for (const [phrase, translation, expected] of semanticCases) {
  const actual = suggestVocabularyIcon(phrase, translation);
  if (actual !== expected) {
    throw new Error(`Для «${phrase}» ожидалась ${expected}, получена ${actual ?? "—"}`);
  }
}

if (suggestIcon("Phrases with make") !== "🔨") {
  throw new Error("Автоподбор не учёл полное название «Phrases with make»");
}

console.log("Семантический подбор по полному названию и переводу: ok");
