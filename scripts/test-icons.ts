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
import {
  isSafeAutomaticIcon,
  suggestIcon,
  suggestVocabularyIcon,
} from "../src/lib/icon-suggest";

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

if (suggestIcon("Food") !== "🍎") {
  throw new Error("Словарные смысловые подсказки не должны менять иконку папки Food");
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
  ["buddy", "товариш / приятель", "👥"],
  ["mate", "товариш / приятель", "👥"],
  ["Oi!", "Гей! / Ей! (вигук)", "👋"],
  ["oldie but a goodie", "старе, але добре", "👴"],
  ["a vial", "флакон / ампула", "🧪"],
  ["a guinea pig", "морська свинка / піддослідна тварина", "🐹"],
  ["crew", "екіпаж / команда", "👥"],
  ["alias", "псевдонім / вигадане ім’я", "🎭"],
  ["shoelaces", "шнурки", "👟"],
  ["intestines", "кишківник / нутрощі", "🧬"],
  ["dumb", "тупий / нерозумний", "🤪"],
  ["sacrificial", "жертовний", "🐑"],
  ["to be worth smth", "коштувати чогось / бути вартим", "💎"],
  ["to be supposed to", "мати бути / передбачатися / повинен бути", "📋"],
  ["to mention", "згадувати / зазначати", "💬"],
  ["to rent", "орендувати", "🔑"],
  ["to fancy", "подобатися / симпатизувати", "❤️"],
  ["to sacrifice", "жертвувати", "🐑"],
  ["to tie smth", "зав’язувати щось", "🔗"],
  ["to hold up to something", "відповідати / витримувати перевірку", "🛡️"],
  ["to sell out", "продати / зрадити принципи", "💰"],
  ["to go at/in/around/up/over", "іти / рухатися", "🧭"],
  ["them → em", "їх / їм (розмовне скорочення)", "✂️"],
  ["because → cause", "тому що (скорочення)", "🔗"],
  ["going to → gonna", "збираюся (розмовне скорочення)", "🔮"],
  ["in what way?", "яким чином? / у який спосіб?", "🤔"],
  ["double the smth", "вдвічі більше / подвоїти щось", "2️⃣"],
  ["he needs doing more than ever", "з ним потрібно розібратися як ніколи", "🛠️"],
  ["brat", "пустун / зіпсована дитина", "👶"],
  ["ass", "задниця (груба)", "🍑"],
  ["bullshit", "дурниця / нісенітниця", "💩"],
  ["twat", "дурень / мудак", "🤬"],
  ["retard", "дегенерат (образливо, уникати)", "⚠️"],
  ["stench", "вонь / зловоние", "🤢"],
  ["guidance", "наставление / руководство", "🧭"],
  ["indulgence", "потакание / потворство", "🍬"],
  ["prey", "добыча / жертва", "🎯"],
  ["to allow", "разрешать / позволять", "✅"],
  ["to be in charge", "быть главным / быть ответственным", "👑"],
  ["in remembrance of", "в память о", "🕯️"],
  ["you have no business here", "тебе здесь нечего делать", "🚫"],
  ["PTSD", "ПТСР (посттравматичний стресовий розлад)", "🧠"],
  ["sober", "тверезий / серйозний", "😐"],
  ["genuine", "справжній / щирий", "💎"],
  ["to internalize", "засвоїти / прийняти всередині себе", "🧠"],
  ["to evaluate", "оцінювати / аналізувати", "📊"],
  ["something is going on", "щось відбувається", "🔄"],
  ["I've been working my ass off", "я пахав як проклятий", "🥵"],
  ["a few", "кілька", "3️⃣"],
  ["accountability", "відповідальність / підзвітність", "⚖️"],
  ["plague", "чума / лихо", "🦠"],
  ["the Almighty", "Всевишній", "🙏"],
  ["throat", "горло", "🗣️"],
  ["it caught up with me", "це мене наздогнало / догнало", "⏳"],
  ["For somebody's sake", "заради когось / та годі вже", "🙏"],
  ["just in case", "про всяк випадок", "🛡️"],
  ["duty", "обов’язок / борг", "📋"],
  ["relevant", "актуальний / доречний / що стосується справи", "🎯"],
  ["to tear apart", "розривати / рознести на шматки", "💥"],
  ["it seems to be", "схоже що / здається це", "👀"],
  ["at least", "принаймні / хоча б", "1️⃣"],
  ["esophagus", "стравохід", "👄"],
  ["to store", "зберігати / запасати", "📦"],
  ["to power smth up", "запустити / увімкнути / зарядити щось", "🔌"],
  ["under the weather", "погано себе почувати", "🤒"],
  ["break the ice", "розтопити лід, почати розмову", "🤝"],
  ["He promises a lot", "all talk no walk — багато обіцяє, але нічого не робить", "🤥"],
  ["to lie in", "лежати в ліжку (валятися)", "🛏️"],
  ["to dream up (something)", "вигадувати щось", "💡"],
  ["to not sleep a wink", "не зімкнути очей", "👁️"],
  ["knackered", "виснажений", "😫"],
  ["prophetic dream", "віщий сон", "🔮"],
  ["recurring dream", "сон, що повторюється", "🔁"],
  ["snooze", "відкладати будильник", "⏰"],
  ["to give somebody/something a bad name", "зіпсувати репутацію", "👎"],
  ["you name it", "що завгодно / все, що хочеш", "📋"],
  ["to be named after", "бути названим на честь", "🏷️"],
  ["to call someone names", "обзивати когось", "🤬"],
  ["deprived", "неблагополучний, знедолений", "😔"],
  ["run-down", "занедбаний", "🏚️"],
  ["middle of nowhere", "глухомань", "🏜️"],
  ["shanty town", "нетрі", "🏚️"],
  ["wasteland", "пустир, занедбана територія", "🏜️"],
  ["hustle and bustle", "метушня, гамір", "🏙️"],
  ["Go Dutch", "платити кожен за себе", "🧾"],
  ["Excuse my French", "вибачте за грубе слово", "🤬"],
  ["It’s all Greek to me", "нічого не розумію", "🤷"],
  ["When in Rome, do as the Romans do", "роби як місцеві", "🌍"],
  ["Swiss Army knife", "універсальна річ", "🛠️"],
];

const generalizationCases: [string, string, string][] = [
  ["pertinent", "доречний", "🎯"],
  ["to stockpile", "запасать", "📦"],
  ["to switch the device on", "увімкнути пристрій", "🔌"],
  ["precaution", "запобіжний захід", "🛡️"],
  ["disease outbreak", "спалах хвороби", "🦠"],
  ["responsibility", "підзвітність", "⚖️"],
  ["to rip to pieces", "разорвать на части", "💥"],
  ["minimum", "щонайменше", "1️⃣"],
  ["to work extremely hard", "важко працювати", "🥵"],
  ["She's working her ass off", "вона дуже тяжко працює", "🥵"],
  ["for your sake", "заради тебе", "🙏"],
  ["the consequences caught up with him", "наслідки його наздогнали", "⏳"],
  ["to tear the document apart", "розірвати документ на шматки", "💥"],
  ["to power the computer up", "увімкнути комп’ютер", "🔌"],
  ["feeling under the weather", "нездужати", "🤒"],
  ["breaking the ice with new classmates", "почати дружню розмову", "🤝"],
  ["She dreamed a new product up", "вона вигадала новий продукт", "💡"],
  ["We didn't sleep a wink", "ми не зімкнули очей", "👁️"],
  ["giving the profession a bad name", "псувати репутацію професії", "👎"],
  ["named after her grandmother", "названа на честь бабусі", "🏷️"],
  ["They called him names", "вони його обзивали", "🤬"],
];

for (const [phrase, translation, expected] of semanticCases) {
  const actual = suggestVocabularyIcon(phrase, translation);
  if (actual !== expected) {
    throw new Error(`Для «${phrase}» ожидалась ${expected}, получена ${actual ?? "—"}`);
  }
  if (!isSafeAutomaticIcon(actual)) {
    throw new Error(`Для «${phrase}» выбрана неподдерживаемая иконка ${actual}`);
  }
}

for (const [phrase, translation, expected] of generalizationCases) {
  const actual = suggestVocabularyIcon(phrase, translation);
  if (actual !== expected) {
    throw new Error(
      `Обобщение для «${phrase}»: ожидалась ${expected}, получена ${actual ?? "—"}`,
    );
  }
}

if (suggestVocabularyIcon("irrelevant", "недоречний") !== "🚫") {
  throw new Error("Отрицательная форма irrelevant должна сохранять отдельный смысл");
}
if (suggestVocabularyIcon("appropriate", "доречний") === "🚫") {
  throw new Error("Положительная форма appropriate не должна совпадать с inappropriate");
}
if (
  suggestVocabularyIcon("It's all started when...", "Все почалося тоді, коли...") === "🤝"
) {
  throw new Error("Правило break the ice не должно влиять на обычное started");
}
if (suggestVocabularyIcon("weather", "погода") === "🤒") {
  throw new Error("Обычное weather не должно считаться идиомой under the weather");
}
if (suggestVocabularyIcon("to lie in the report", "лгать в отчёте") === "🛏️") {
  throw new Error("Lie in другой конструкции не должно означать лежать в кровати");
}
if (suggestVocabularyIcon("a phone call", "телефонный звонок") === "🤬") {
  throw new Error("Обычный call не должен считаться выражением call someone names");
}

if (suggestIcon("Phrases with make") !== "🔨") {
  throw new Error("Автоподбор не учёл полное название «Phrases with make»");
}

console.log("Семантический подбор по полному названию и переводу: ok");
