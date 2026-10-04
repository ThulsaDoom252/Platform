import "dotenv/config";

import { eq, ilike } from "drizzle-orm";
import { db } from "../src/lib/db";
import { lessonAssignments, lessonUnits } from "../src/lib/db/schema";
import type {
  HomeworkExercise,
  HomeworkItem,
  InteractiveHomeworkPlan,
} from "../src/lib/lesson-homework";

const LESSON_TITLE = "Tucker & Mendel (part 8)";

const words = [
  "to make excuses for smth",
  "period",
  "to be frank",
  "aid",
  "to undermine",
  "to beg",
  "as long as",
  "a trap",
  "martial law",
  "a media outlet",
  "to assault",
  "rational",
  "to point fingers",
  "insistent",
  "GDP",
  "a supplier",
  "a drug dealer",
  "a drug user",
  "energized",
  "to sniff",
  "to spark",
  "spark",
] as const;

const fillItems: HomeworkItem[] = [
  { id: "tm8-fill-excuses", prompt: "It is easy ___ a friend, but facts still matter.", answer: "to make excuses for", accepted: ["make excuses for"] },
  { id: "tm8-fill-period", prompt: "I said no, ___.", answer: "period" },
  { id: "tm8-fill-frank", prompt: "___, I do not like this plan.", answer: "to be frank" },
  { id: "tm8-fill-aid", prompt: "The village received ___ after the flood.", answer: "aid" },
  { id: "tm8-fill-undermine", prompt: "His lies began ___ our trust.", answer: "to undermine", accepted: ["undermining"] },
  { id: "tm8-fill-beg", prompt: "The child began ___ for another chance.", answer: "to beg", accepted: ["begging"] },
  { id: "tm8-fill-as-long-as", prompt: "You can stay here ___ you are quiet.", answer: "as long as" },
  { id: "tm8-fill-trap", prompt: "The empty wallet was ___ set by the police.", answer: "a trap" },
  { id: "tm8-fill-martial-law", prompt: "The government declared ___ during the emergency.", answer: "martial law" },
  { id: "tm8-fill-media", prompt: "The newspaper is ___ based in London.", answer: "a media outlet" },
  { id: "tm8-fill-assault", prompt: "It is a crime ___ another person.", answer: "to assault" },
  { id: "tm8-fill-rational", prompt: "We need a calm and ___ decision.", answer: "rational" },
  { id: "tm8-fill-fingers", prompt: "We need a solution, not ___.", answer: "to point fingers", accepted: ["pointing fingers"] },
  { id: "tm8-fill-insistent", prompt: "She was ___ that we leave immediately.", answer: "insistent" },
  { id: "tm8-fill-gdp", prompt: "The country's ___ grew by three percent.", answer: "GDP" },
  { id: "tm8-fill-supplier", prompt: "We found ___ for the restaurant's vegetables.", answer: "a supplier" },
  { id: "tm8-fill-dealer", prompt: "Police arrested ___ near the station.", answer: "a drug dealer" },
  { id: "tm8-fill-user", prompt: "The clinic helps ___ recover safely.", answer: "a drug user" },
  { id: "tm8-fill-energized", prompt: "After a short walk, I felt ___.", answer: "energized" },
  { id: "tm8-fill-sniff", prompt: "The dog stopped ___ the bag.", answer: "to sniff", accepted: ["sniffing"] },
  { id: "tm8-fill-spark-verb", prompt: "The speech could ___ a public debate.", answer: "to spark", accepted: ["spark"] },
  { id: "tm8-fill-spark-noun", prompt: "Her idea was the ___ that started the project.", answer: "spark" },
];

const translationItems: HomeworkItem[] = [
  { id: "tm8-tr-excuses", prompt: "Перестань оправдывать его ошибку.", answer: "Stop making excuses for his mistake." },
  { id: "tm8-tr-period", prompt: "Я сказал нет, и точка.", answer: "I said no, period." },
  { id: "tm8-tr-frank", prompt: "Откровенно говоря, я ему не доверяю.", answer: "To be frank, I do not trust him." },
  { id: "tm8-tr-aid", prompt: "Городу нужна продовольственная помощь.", answer: "The town needs food aid." },
  { id: "tm8-tr-undermine", prompt: "Скандал может подорвать доверие людей.", answer: "The scandal could undermine public trust." },
  { id: "tm8-tr-beg", prompt: "Ему пришлось просить о помощи.", answer: "He had to beg for help." },
  { id: "tm8-tr-as-long-as", prompt: "Ты можешь остаться, пока ведёшь себя тихо.", answer: "You can stay as long as you are quiet." },
  { id: "tm8-tr-trap", prompt: "Это предложение было ловушкой.", answer: "The offer was a trap." },
  { id: "tm8-tr-martial-law", prompt: "Страна ввела военное положение.", answer: "The country introduced martial law." },
  { id: "tm8-tr-media", prompt: "Она работает в местном СМИ.", answer: "She works for a local media outlet." },
  { id: "tm8-tr-assault", prompt: "Его арестовали за нападение на полицейского.", answer: "He was arrested for assaulting a police officer." },
  { id: "tm8-tr-rational", prompt: "Нам нужен рациональный ответ.", answer: "We need a rational answer." },
  { id: "tm8-tr-fingers", prompt: "Не обвиняй других людей.", answer: "Do not point fingers at other people." },
  { id: "tm8-tr-insistent", prompt: "Она настаивала, чтобы мы действовали сейчас.", answer: "She was insistent that we act now." },
  { id: "tm8-tr-gdp", prompt: "ВВП страны вырос в прошлом году.", answer: "The country's GDP grew last year." },
  { id: "tm8-tr-supplier", prompt: "Магазин сменил основного поставщика.", answer: "The shop changed its main supplier." },
  { id: "tm8-tr-dealer", prompt: "Полиция арестовала наркодилера.", answer: "The police arrested a drug dealer." },
  { id: "tm8-tr-user", prompt: "Клиника помогает каждому человеку, употребляющему наркотики.", answer: "The clinic helps every drug user." },
  { id: "tm8-tr-energized", prompt: "Музыка наполнила меня энергией.", answer: "The music made me feel energized." },
  { id: "tm8-tr-sniff", prompt: "Собака начала нюхать сумку.", answer: "The dog began to sniff the bag." },
  { id: "tm8-tr-spark-verb", prompt: "Его слова вызвали долгие дебаты.", answer: "His words sparked a long debate." },
  { id: "tm8-tr-spark-noun", prompt: "Одна маленькая идея стала искрой для проекта.", answer: "One small idea was the spark for the project." },
];

const MAIN_SIZE = 14;
const mainWords = words.slice(0, MAIN_SIZE);
const bonusWords = words.slice(MAIN_SIZE);

const fillExercise = (
  id: string,
  title: string,
  items: HomeworkItem[],
  optional = false,
): HomeworkExercise => ({
  id,
  title,
  instruction: "Complete each sentence with a word or phrase from the list.",
  kind: "fill",
  optional,
  wordBank: items
    .map((item) => item.answer!)
    .filter(Boolean)
    .slice(1)
    .concat(items[0]?.answer ? [items[0].answer] : []),
  items,
});

const describeExercise = (
  id: string,
  title: string,
  selectedWords: readonly string[],
  optional = false,
): HomeworkExercise => ({
  id,
  title,
  instruction: "Explain each word or phrase in simple English.",
  kind: "describe",
  optional,
  items: selectedWords.map((word, index) => ({
    id: `${id}-${index + 1}`,
    prompt: word,
    word,
  })),
});

const translationExercise = (
  id: string,
  title: string,
  items: HomeworkItem[],
  optional = false,
): HomeworkExercise => ({
  id,
  title,
  instruction: "Translate each sentence into English.",
  kind: "translate",
  translationDirection: "to-english",
  optional,
  items,
});

const plan: InteractiveHomeworkPlan = {
  kind: "INTERACTIVE_HOMEWORK_V1",
  title: "Tucker & Mendel (part 8) — Homework",
  exercises: [
    fillExercise("tm8-fill-main", "Vocabulary 1 — Fill in the gaps", fillItems.slice(0, MAIN_SIZE)),
    fillExercise("tm8-fill-bonus", "Vocabulary 1 — Bonus A", fillItems.slice(MAIN_SIZE), true),
    describeExercise("tm8-describe-main", "Vocabulary 2 — Describe the words", mainWords),
    describeExercise("tm8-describe-bonus", "Vocabulary 2 — Bonus A", bonusWords, true),
    translationExercise("tm8-translation-main", "Translation — Into English", translationItems.slice(0, MAIN_SIZE)),
    translationExercise("tm8-translation-bonus", "Translation — Bonus A", translationItems.slice(MAIN_SIZE), true),
    {
      id: "tm8-questions-main",
      title: "Questions — Written answers",
      instruction: "Write your answer below each question.",
      kind: "question-text",
      items: [],
    },
    {
      id: "tm8-questions-bonus",
      title: "Questions — Bonus A",
      instruction: "Write your answer below each question.",
      kind: "question-text",
      optional: true,
      items: [],
    },
  ],
};

async function main() {
  const [unit] = await db
    .select({ id: lessonUnits.id, title: lessonUnits.title })
    .from(lessonUnits)
    .where(ilike(lessonUnits.title, LESSON_TITLE))
    .limit(1);
  if (!unit) throw new Error(`Lesson not found: ${LESSON_TITLE}`);

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
      const openSections = new Set(assignment.openSections ?? []);
      openSections.add("homework");
      await tx
        .update(lessonAssignments)
        .set({ openSections: [...openSections], updatedAt: new Date() })
        .where(eq(lessonAssignments.id, assignment.id));
    }
  });

  console.log(JSON.stringify({
    id: unit.id,
    title: unit.title,
    exercises: plan.exercises.length,
    required: plan.exercises.filter((exercise) => !exercise.optional).length,
    bonuses: plan.exercises.filter((exercise) => exercise.optional).length,
    vocabulary: words.length,
  }));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
