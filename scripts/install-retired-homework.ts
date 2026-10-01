import { and, eq, ilike } from "drizzle-orm";
import { db } from "../src/lib/db";
import { lessonAssignments, lessonUnits, lessonWords } from "../src/lib/db/schema";
import type {
  HomeworkExercise,
  HomeworkItem,
  InteractiveHomeworkPlan,
} from "../src/lib/lesson-homework";
import type { RuleBlock } from "../src/lib/rule-blocks";

const FILL: Record<string, string> = {
  "to wonder": "It is natural ___ what life will be like in ten years.",
  "to track down": "The police worked for weeks ___ the missing car.",
  "to retire": "My father plans ___ when he turns sixty-five.",
  "to face": "We need ___ the problem instead of ignoring it.",
  "to make a vow": "They decided ___ to support each other.",
  "to come out of retirement": "The old coach agreed ___ for one final season.",
  "to look for": "I need ___ my keys before we leave.",
  "to push somebody's buttons": "That comment was meant ___ and make him angry.",
  "to grab": "She reached down ___ the bag before it fell.",
  "to count": "Young children learn ___ from one to ten.",
  "to slap": "It is never acceptable ___ someone in the face.",
  "to draw a weapon": "The officer warned the man not ___ in the crowd.",
  "to disarm": "The guard managed ___ the attacker safely.",
  "to shoot": "The soldier refused ___ at an unarmed person.",
  "to wing": "The bullet did not kill him; it only managed ___ him.",
  "to injure": "A heavy fall can cause you ___ your back.",
  "to wound": "The knife was used ___ the attacker in the arm.",
  "to make a mistake": "It is easy ___ when you are tired.",
  "to insist": "I had ___ on checking the facts again.",
  "to concede": "After seeing the evidence, he had ___ that he was wrong.",
  "a threat": "The police treated the message as ___ to public safety.",
  "expertise": "We need her technical ___ to solve this problem.",
  "a human being": "A robot can look realistic, but it is not ___.",
  "retirement": "He plans to travel after his ___.",
  "son of a bitch (SOB)": "In the film, the angry man calls his enemy a rude name: ___.",
  "a high-stakes situation": "A rescue with many lives at risk is ___.",
  "a weapon": "The guard checked whether the visitor was carrying ___.",
  "an injury": "She could not play because of ___.",
  "a wound": "The doctor cleaned ___ on his shoulder.",
  "guts": "It takes ___ to admit a serious mistake.",
  "gut": "In slang, your stomach can be called your ___.",
  "a gutshot": "In the game, a shot to the stomach is called ___.",
  "a headshot": "In the game, a shot that hits the head is ___.",
  "during": "Please stay quiet ___ the exam.",
  "unlike": "___ his brother, Max is very patient.",
  "sly": "The fox in the story is clever, dishonest, and ___.",
  "supposed to": "You are ___ wear a seat belt in the car.",
  "That's all behind me now": "He no longer thinks about his difficult past: ‘___.’",
  "(have) got to": "I ___ finish this report before lunch.",
  "I'm in": "When everyone asked who wanted to join, I said, ‘___.’",
  "This is ridiculous": "The rule makes no sense. ___!",
  "I'd rather": "___ stay home than go out in this storm.",
  "Is that all you got?": "After an easy challenge, the fighter laughed: ‘___’",
  "to deflect": "He tried ___ attention away from the real problem.",
};

const idPart = (value: string) =>
  value
    .toLocaleLowerCase("en")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);

const vocabItem = (
  prefix: string,
  word: { word: string; description: string | null },
  kind: "fill" | "definition" | "describe",
): HomeworkItem => ({
  id: `${prefix}-${idPart(word.word)}`,
  ...(kind === "fill"
    ? { prompt: FILL[word.word] ?? `Complete the sentence with “${word.word}”: ___`, answer: word.word }
    : kind === "definition"
      ? { prompt: word.description || `What word means “${word.word}”?`, answer: word.word }
      : {
          prompt: "Explain this word or phrase in simple English. Add one short example if you can.",
          word: word.word,
        }),
});

const vocabExercise = (
  id: string,
  title: string,
  instruction: string,
  kind: "fill" | "definition" | "describe",
  words: { word: string; description: string | null }[],
  optional = false,
): HomeworkExercise => ({
  id,
  title,
  instruction,
  kind,
  optional,
  // Банк намеренно не повторяет порядок предложений: нельзя решать по позиции.
  wordBank: words.map((word) => word.word).sort((left, right) => left.localeCompare(right, "en")),
  items: words.map((word) => vocabItem(id, word, kind)),
});

const TRANSLATION_MAIN: HomeworkItem[] = [
  { id: "tr-main-though-1", prompt: "Хоча було пізно, ми продовжили працювати.", word: "though", hint: "though на початку" },
  { id: "tr-main-though-2", prompt: "Мені подобається ця робота, хоча вона важка.", word: "though", hint: "though у середині" },
  { id: "tr-main-rather-1", prompt: "Анна краще залишилася б удома сьогодні.", word: "Somebody'd rather", hint: "скорочення 'd" },
  { id: "tr-main-rather-2", prompt: "Він краще поговорив би з експертом.", word: "Somebody'd rather", hint: "скорочення 'd + дієслово" },
  { id: "tr-main-get-1", prompt: "Надворі темніє.", word: "get + adjective", hint: "про зміну стану" },
  { id: "tr-main-get-2", prompt: "Я дуже швидко втомлююся під час тренування.", word: "get + adjective", hint: "використай during" },
  { id: "tr-main-have-got-1", prompt: "Мені треба зараз іти.", word: "have got to", hint: "повна розмовна форма" },
  { id: "tr-main-have-got-2", prompt: "Їй треба знайти цю людину до вечора.", word: "have got to", hint: "використай track down" },
];

const TRANSLATION_BONUS_ONE: HomeworkItem[] = [
  { id: "tr-b1-even-1", prompt: "Попри те, що він був поранений, він продовжив місію.", word: "even though", hint: "сильне протиставлення" },
  { id: "tr-b1-even-2", prompt: "Вона прийшла, хоча почувалася втомленою.", word: "even though", hint: "even though у середині" },
  { id: "tr-b1-end-1", prompt: "Фільм був довгий. Проте він був хорошим.", word: "though", hint: "постав though у кінець" },
  { id: "tr-b1-end-2", prompt: "Це дорога машина. Гарна, щоправда.", word: "though", hint: "постав though у кінець" },
  { id: "tr-b1-as-1", prompt: "Він виглядає так, ніби він втомлений.", word: "as though", hint: "ніби" },
  { id: "tr-b1-as-2", prompt: "Вона говорить так, наче знає все.", word: "as though", hint: "наче" },
  { id: "tr-b1-gotta-1", prompt: "Мушу бігти, побачимося пізніше!", word: "gotta", hint: "використай сленг" },
  { id: "tr-b1-gotta-2", prompt: "Тобі треба побачити цього спеціаліста.", word: "gotta", hint: "дуже розмовно" },
  { id: "tr-b1-chance-1", prompt: "Мені пощастило зустріти відставного спеціаліста.", word: "got to + verb", hint: "минула можливість" },
  { id: "tr-b1-chance-2", prompt: "Нам випала нагода побачити його експертизу в дії.", word: "got to + verb", hint: "минула можливість" },
  { id: "tr-b1-place-1", prompt: "Ми дісталися бази о шостій.", word: "got to + place", hint: "минуле від get to" },
  { id: "tr-b1-place-2", prompt: "Вони дісталися лікарні під час бурі.", word: "got to + place", hint: "використай during" },
];

const TRANSLATION_BONUS_TWO: HomeworkItem[] = [
  { id: "tr-b2-said-1", prompt: "Він сказав, що вистежить загрозу.", word: "would after said", hint: "future in the past" },
  { id: "tr-b2-said-2", prompt: "Вона сказала мені, що роззброїть нападника.", word: "would after told", hint: "future in the past" },
  { id: "tr-b2-thought-1", prompt: "Я знав, що він наполягатиме.", word: "would after knew", hint: "future in the past" },
  { id: "tr-b2-thought-2", prompt: "Ми думали, що він визнає поразку.", word: "would after thought", hint: "future in the past" },
  { id: "tr-b2-short-1", prompt: "Я думав, що тобі сподобається його план.", word: "'d = would", hint: "використай скорочення" },
  { id: "tr-b2-short-2", prompt: "Вони сказали, що допоможуть нам.", word: "'d = would", hint: "використай скорочення" },
  { id: "tr-b2-wouldnt-1", prompt: "Я знав, що він не стрілятиме.", word: "wouldn't", hint: "заперечення" },
  { id: "tr-b2-wouldnt-2", prompt: "Двері ніяк не відчинялися.", word: "wouldn't", hint: "річ «не хотіла» працювати" },
  { id: "tr-b2-better-1", prompt: "Ситуація стає дедалі небезпечнішою.", word: "get + comparative", hint: "поступова зміна" },
  { id: "tr-b2-better-2", prompt: "Його стан стає кращим.", word: "get + comparative", hint: "getting better" },
  { id: "tr-b2-become-adj-1", prompt: "Після інциденту загроза стала очевидною.", word: "become + adjective", hint: "нейтральніше за get" },
  { id: "tr-b2-become-adj-2", prompt: "Він став відомим військовим експертом.", word: "become + adjective", hint: "нейтральний стиль" },
  { id: "tr-b2-become-noun-1", prompt: "Вона стала лікарем після служби.", word: "become + noun", hint: "не get" },
  { id: "tr-b2-become-noun-2", prompt: "Після місії вони стали друзями.", word: "become + noun", hint: "become + noun" },
  { id: "tr-b2-mistake-1", prompt: "Я припустився помилки, недооцінивши його.", word: "make a mistake + -ing", hint: "дія після mistake" },
  { id: "tr-b2-mistake-2", prompt: "Вони припустилися помилки, проігнорувавши загрозу.", word: "make the mistake of + -ing", hint: "конкретна помилкова дія" },
];

const dragPrompt = (word: string, sense: string | null, pattern: string | null) =>
  [sense, pattern ? `Форма: ${pattern}` : null].filter(Boolean).join(" · ") || `Choose ${word}`;

async function main() {
  const [unit] = await db
    .select()
    .from(lessonUnits)
    .where(ilike(lessonUnits.title, "Retired Military Specialist"))
    .limit(1);
  if (!unit) throw new Error("Retired Military Specialist not found");

  const words = await db
    .select({ word: lessonWords.word, description: lessonWords.description })
    .from(lessonWords)
    .where(eq(lessonWords.unitId, unit.id))
    .orderBy(lessonWords.sortOrder);
  if (words.length === 0) throw new Error("Lesson vocabulary is empty");

  // 44 записи дают честные 15 / 15 / 14: все слова входят в обязательную часть один раз.
  const third = Math.floor(words.length / 3);
  const extra = words.length % 3;
  const aEnd = third + (extra > 0 ? 1 : 0);
  const bEnd = aEnd + third + (extra > 1 ? 1 : 0);
  const groups = [words.slice(0, aEnd), words.slice(aEnd, bEnd), words.slice(bEnd)];

  const lexisEntries = (Array.isArray(unit.lexis) ? unit.lexis : unit.lexis ? [unit.lexis] : [])
    .flatMap((group) => {
      if (!group || typeof group !== "object") return [];
      const blocks = Array.isArray((group as { blocks?: RuleBlock[] }).blocks)
        ? (group as { blocks: RuleBlock[] }).blocks
        : [];
      return blocks.flatMap((block) => block.type === "word"
        ? [{ word: block.word, sense: block.sense, pattern: block.pattern }]
        : []);
    });
  const lexisMiddle = Math.ceil(lexisEntries.length / 2);
  const dragGroups = [lexisEntries.slice(0, lexisMiddle), lexisEntries.slice(lexisMiddle)];

  const exercises: HomeworkExercise[] = [
    vocabExercise("vocab-fill-main", "Vocabulary 1 — Fill in the gaps", "Вставь подходящее слово или фразу. Слова в заданиях идут не в порядке списка.", "fill", groups[0]),
    vocabExercise("vocab-fill-bonus-1", "Vocabulary 1 — Bonus A", "Дополнительные предложения со второй частью словаря.", "fill", groups[1], true),
    vocabExercise("vocab-fill-bonus-2", "Vocabulary 1 — Bonus B", "Дополнительные предложения с третьей частью словаря.", "fill", groups[2], true),
    vocabExercise("vocab-definition-main", "Vocabulary 2 — Guess by description", "Прочитай простое описание и напиши точное слово или фразу.", "definition", groups[1]),
    vocabExercise("vocab-definition-bonus-1", "Vocabulary 2 — Bonus A", "Угадай слова из третьей части словаря.", "definition", groups[2], true),
    vocabExercise("vocab-definition-bonus-2", "Vocabulary 2 — Bonus B", "Угадай слова из первой части словаря.", "definition", groups[0], true),
    vocabExercise("vocab-describe-main", "Vocabulary 3 — Explain it yourself", "Опиши слово или фразу простым английским. Здесь нет автоматической проверки — ответ проверит учитель.", "describe", groups[2]),
    vocabExercise("vocab-describe-bonus-1", "Vocabulary 3 — Bonus A", "Опиши слова из первой части словаря.", "describe", groups[0], true),
    vocabExercise("vocab-describe-bonus-2", "Vocabulary 3 — Bonus B", "Опиши слова из второй части словаря.", "describe", groups[1], true),
    ...dragGroups.map((entries, at): HomeworkExercise => ({
      id: `lexis-drag-${at + 1}`,
      title: `Lexis — Drag & drop, part ${at + 1}`,
      instruction: "Перетащи конструкцию к её значению. После трёх ошибок появится правильный ответ.",
      kind: "drag",
      wordBank: [...entries.map((entry) => entry.word)].sort(() => 0.5 - Math.random()),
      items: entries.map((entry) => ({
        id: `drag-${at + 1}-${idPart(entry.word)}`,
        prompt: dragPrompt(entry.word, entry.sense ?? null, entry.pattern ?? null),
        answer: entry.word,
      })),
    })),
    {
      id: "translation-main",
      title: "Translation — Main cases",
      instruction: "Переведи предложения на английский. Используй указанную конструкцию и лексику урока.",
      kind: "translate",
      items: TRANSLATION_MAIN,
    },
    {
      id: "translation-bonus-1",
      title: "Translation — Bonus A",
      instruction: "Дополнительные случаи though и got to. Следуй пометке в скобках.",
      kind: "translate",
      optional: true,
      items: TRANSLATION_BONUS_ONE,
    },
    {
      id: "translation-bonus-2",
      title: "Translation — Bonus B",
      instruction: "Future in the past, become/get и make a mistake. Следуй пометке в скобках.",
      kind: "translate",
      optional: true,
      items: TRANSLATION_BONUS_TWO,
    },
    {
      id: "questions-written",
      title: "Questions — Written answers",
      instruction: "Напиши развёрнутый ответ под каждым вопросом.",
      kind: "question-text",
      items: [],
    },
    {
      id: "questions-audio",
      title: "Questions — Voice answers",
      instruction: "Открой Vocaroo, запиши ответ и вставь полученную ссылку.",
      kind: "question-audio",
      items: [],
    },
  ];

  const plan: InteractiveHomeworkPlan = {
    kind: "INTERACTIVE_HOMEWORK_V1",
    title: "Retired Military Specialist — Homework",
    intro: "Обязательные блоки охватывают весь словарь и основную лексику. Bonus-блоки свернуты и выполняются по желанию. Ответы сохраняются автоматически.",
    exercises,
  };

  await db.transaction(async (tx) => {
    await tx
      .update(lessonUnits)
      .set({ homework: [plan], updatedAt: new Date() })
      .where(eq(lessonUnits.id, unit.id));

    const assignments = await tx
      .select({ id: lessonAssignments.id, openSections: lessonAssignments.openSections })
      .from(lessonAssignments)
      .where(eq(lessonAssignments.unitId, unit.id));
    for (const assignment of assignments) {
      const open = new Set(assignment.openSections ?? []);
      open.add("homework");
      await tx
        .update(lessonAssignments)
        .set({ openSections: [...open], updatedAt: new Date() })
        .where(and(
          eq(lessonAssignments.id, assignment.id),
          eq(lessonAssignments.unitId, unit.id),
        ));
    }
  });

  console.log(JSON.stringify({
    lessonId: unit.id,
    vocabulary: words.length,
    vocabularyGroups: groups.map((group) => group.length),
    lexis: lexisEntries.length,
    exercises: exercises.length,
  }));
}

void main().then(() => process.exit(0));
