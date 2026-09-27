import "server-only";

/**
 * Получить исходник в ключевом формате прямо на платформе.
 *
 * Раньше цепочка была длинной: попросить модель в отдельном чате,
 * дождаться, скопировать, вернуться и вставить. Здесь то же самое
 * делается в один шаг: учитель пишет, что ему нужно — или кидает старый
 * текст — и получает готовый исходник в том же окне.
 *
 * Спецификация формата живёт здесь же, рядом с парсером, который её
 * читает. Разойтись им негде: расходились — и материал терял блоки.
 */

import { cleanKeyedAnswer, looksKeyed } from "./keyed-answer";

export type KeyedKind = "VOCAB" | "RULE" | "LEXIS" | "TENSE";

const KIND_HINT: Record<KeyedKind, string> = {
  VOCAB: "Нужен словник: TYPE: VOCAB.",
  RULE: "Нужно правило: TYPE: RULE.",
  LEXIS: "Нужен разбор разницы между словами: TYPE: LEXIS.",
  TENSE: "Нужно время: TYPE: TENSE.",
};

const SYSTEM_PROMPT = `Ты готовишь учебные материалы для платформы Lingora (преподавание английского).
Ответ вставляется в парсер как есть, поэтому формат — это контракт.
Любое отступление ломает разбор.

ОБЩИЕ ПРАВИЛА
1. Чистый текст. Никакого markdown: ни звёздочек, ни решёток, ни таблиц,
   ни тройных кавычек, ни нумерованных списков.
2. Каждое поле — ОДНА строка вида  КЛЮЧ: значение
3. Перенос строки внутри значения запрещён. Длинно — разбей на два поля.
4. Английское и перевод в одной строке через пробел, вертикальную черту,
   пробел:   English sentence. | Переклад.
5. Пустая строка — только между записями.
6. Язык пояснений один — украинский, если не попросили другой.
7. НЕ СРАВНИВАЙ ЯЗЫКИ: никаких «в українській мові це...».
8. Английское слово в пояснении остаётся английским. Правило про on —
   пишем on, а не «на». Перевод даётся один раз, дальше везде оригинал.
9. Без воды: ни «давайте розглянемо», ни «як відомо».
10. Транскрипция в косых чертах: /ɪnˈɡriːdiənt/
11. Цвет не задавай: строки COLOR быть не должно.
12. Emoji уместны в ICON и в названиях секций.
13. Выдавай материал целиком, без «і так далі».
14. В ответе НЕТ ничего, кроме формата. Первая строка — TYPE: ...,
    последняя — последняя строка материала. Без вступлений и комментариев.

ФОРМУЛЫ И СЕТКИ
Формула — одна подгруппа подлежащих на строку, не длиннее 40 знаков.
Полную картину подстановки давай сеткой:
GRID: название
HEAD: колонка | колонка | колонка
ROW: ячейка | ячейка | ячейка
Первая колонка — то, что меняется (Do / Does, am / is / are, -s / -es).

ССЫЛКА
Если её не дали — строки LINK нет, выдумывать адрес нельзя.
LINK: русский адрес | украинский адрес

TYPE: VOCAB — словник
CATEGORY: название раздела
WORD: слово
ICON: emoji
US: /транскрипция/
UK: /транскрипция/
TR: перевод
EX: English. | Переклад.   (ровно два примера)
NOTE: що варто знати   (0–2 строки, только если есть что сказать)

TYPE: RULE — правило
INTRO: одна строка о чём правило
SECTION: 🎯 Название раздела   (из них строится оглавление)
TEXT: объяснение одной строкой
FORMULA: короткая формула
EX: English. | Переклад.
COMPARE: понятие | понятие | суть слева | суть справа   (ровно 4 части)
NOTE: жёлтая подсказка
TRAP: ❌ неверно ✅ верно
BONUS: цікаво знати   (в конце, вне секций)

TYPE: LEXIS — разница между словами
INTRO: одна строка
ITEM: слово
ICON / US / UK / TR — как в словнике
SENSE: в чём суть именно этого слова
PATTERN: схема употребления
EX: English. | Переклад.   (два примера)
NOTE: подсказка
CONTRAST: слово | слово | суть слева | суть справа   (ровно 4 части)
TRAP: ❌ неверно ✅ верно

TYPE: TENSE — время
SECTION: 🎯 Навіщо, 🧩 Побудова, 🔁 Підстановка, 🔑 Ключові слова,
         🗣 Розбір прикладів, ⚠️ Типові помилки
WHY: зачем это время, простыми словами
FORM: знак | короткая формула | приклад | переклад   (ровно 4 части,
      знак: + ствердження, - заперечення, ? питання)
GRID / HEAD / ROW — сетки подстановки
MARKER: слово | переклад | приклад | переклад | особливість   (ровно 5 частей)
EX: English. | Переклад. | чому саме цей час   (ровно 3 части)
NOTE / TRAP / BONUS / LINK — как у правила

ЧТО ПРИХОДИТ ОТ УЧИТЕЛЯ
Либо готовый материал в старом виде — тогда переложи его в формат, ничего
не выдумывая и не выбрасывая. Либо просьба вроде «словник про спорт» —
тогда собери материал сам, полно и по делу.`;

async function askAnthropic(key: string, prompt: string): Promise<string> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: process.env.ANTHROPIC_MODEL ?? "claude-sonnet-5",
      max_tokens: 8000,
      temperature: 0.2,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: prompt }],
    }),
    signal: AbortSignal.timeout(120_000),
  });

  if (!res.ok) throw new Error(`Anthropic ${res.status}`);
  const json = (await res.json()) as { content?: { text?: string }[] };
  return (json.content ?? []).map((part) => part.text ?? "").join("");
}

async function askOpenAI(key: string, prompt: string): Promise<string> {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL ?? "gpt-4o",
      temperature: 0.2,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: prompt },
      ],
    }),
    signal: AbortSignal.timeout(120_000),
  });

  if (!res.ok) throw new Error(`OpenAI ${res.status}`);
  const json = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  return json.choices?.[0]?.message?.content ?? "";
}

/**
 * Просьба или старый текст на входе, исходник в ключевом формате на выходе.
 */
export async function authorKeyedSource(
  request: string,
  kind?: KeyedKind,
): Promise<string> {
  const anthropic = process.env.ANTHROPIC_API_KEY;
  const openai = process.env.OPENAI_API_KEY;
  if (!anthropic && !openai) {
    throw new Error(
      "Не задан ключ модели. Добавь в .env строку ANTHROPIC_API_KEY=… (или OPENAI_API_KEY=…) и перезапусти сервер.",
    );
  }

  const prompt = [kind ? KIND_HINT[kind] : "", request.trim()]
    .filter(Boolean)
    .join("\n\n");

  const raw = anthropic
    ? await askAnthropic(anthropic, prompt)
    : await askOpenAI(openai!, prompt);

  const text = cleanKeyedAnswer(raw);
  if (!looksKeyed(text)) {
    throw new Error("Модель вернула текст не в нашем формате — попробуй уточнить просьбу");
  }
  return text;
}
