import "dotenv/config";

import { eq } from "drizzle-orm";
import { db } from "../src/lib/db";
import { lessonAssignments, lessonUnits } from "../src/lib/db/schema";
import type {
  HomeworkExercise,
  HomeworkItem,
  InteractiveHomeworkPlan,
} from "../src/lib/lesson-homework";

const LESSON_TITLE = "Tucker and mendel";

const fillItems: HomeworkItem[] = [
  { id: "tm-fill-speech", prompt: "The law protects ___ in this country.", answer: "freedom of speech" },
  { id: "tm-fill-shape", prompt: "This old car is still ___.", answer: "in good shape" },
  { id: "tm-fill-despite", prompt: "___ the rain, we went for a walk.", answer: "despite" },
  { id: "tm-fill-support", prompt: "It is important ___ your friends in difficult times.", answer: "to support" },
  { id: "tm-fill-fireplace", prompt: "We sat by the ___ and talked.", answer: "fireplace" },
  { id: "tm-fill-figure", prompt: "She finally managed ___ the answer.", answer: "to figure out" },
  { id: "tm-fill-viral", prompt: "The short video began ___ online.", answer: "to go viral" },
  { id: "tm-fill-nonsense", prompt: "That story is complete ___.", answer: "nonsense" },
  { id: "tm-fill-conduct", prompt: "The police plan ___ a new investigation.", answer: "to conduct" },
  { id: "tm-fill-influence", prompt: "Advertising has the power ___ our choices.", answer: "to influence" },
  { id: "tm-fill-give-up", prompt: "It is too early ___.", answer: "to give up" },
  { id: "tm-fill-ceasefire", prompt: "Both sides agreed to a temporary ___.", answer: "ceasefire" },
];

const definitionItems: HomeworkItem[] = [
  { id: "tm-definition-imprison", prompt: "to put someone in prison", answer: "to imprison", accepted: ["imprison"] },
  { id: "tm-definition-autocracy", prompt: "a system where one person has all the power", answer: "autocracy", accepted: ["an autocracy"] },
  { id: "tm-definition-disabled", prompt: "a person whose physical or mental condition limits some activities", answer: "a disabled person", accepted: ["disabled person", "a person with a disability", "person with a disability"] },
  { id: "tm-definition-desperation", prompt: "the feeling of having no hope", answer: "desperation" },
  { id: "tm-definition-dark-humour", prompt: "jokes about serious or unpleasant things", answer: "dark humour", accepted: ["dark humor"] },
  { id: "tm-definition-parking", prompt: "an outdoor place where people leave their cars", answer: "parking lot", accepted: ["a parking lot", "car park", "a car park"] },
  { id: "tm-definition-come-up", prompt: "to appear or happen unexpectedly", answer: "to come up", accepted: ["come up"] },
  { id: "tm-definition-senseless", prompt: "having no meaning or purpose", answer: "senseless" },
  { id: "tm-definition-misinterpret", prompt: "to understand something in the wrong way", answer: "to misinterpret", accepted: ["misinterpret"] },
  { id: "tm-definition-multiple", prompt: "many, or more than one", answer: "multiple" },
  { id: "tm-definition-consistent", prompt: "always behaving or happening in the same way", answer: "consistent" },
  { id: "tm-definition-debt", prompt: "money that you owe to someone", answer: "debt", accepted: ["a debt"] },
];

const describeWords = [
  "to vote",
  "a person with an intellectual disability",
  "to suffer",
  "to come from",
  "to come close",
  "to push for",
  "to thrive",
  "furthermore",
  "capacity",
  "temporary",
] as const;

const translationItems: HomeworkItem[] = [
  { id: "tm-translation-imprison", prompt: "Влада ув'язнила кількох журналістів.", answer: "The government imprisoned several journalists." },
  { id: "tm-translation-speech", prompt: "Свобода слова — основоположне право.", answer: "Freedom of speech is a basic right." },
  { id: "tm-translation-despite", prompt: "Попри втому, вона продовжила працювати.", answer: "Despite being tired, she kept working." },
  { id: "tm-translation-support", prompt: "Її друзі підтримали її під час кризи.", answer: "Her friends supported her during the crisis." },
  { id: "tm-translation-come-up", prompt: "Під час зустрічі виникла проблема.", answer: "A problem came up during the meeting." },
  { id: "tm-translation-viral", prompt: "Відео стало вірусним за одну ніч.", answer: "The video went viral overnight." },
  { id: "tm-translation-misinterpret", prompt: "Не тлумач моє мовчання неправильно.", answer: "Do not misinterpret my silence.", accepted: ["Don't misinterpret my silence."] },
  { id: "tm-translation-include", prompt: "Ціна включає сніданок.", answer: "The price includes breakfast." },
  { id: "tm-translation-consistency", prompt: "Послідовність важливіша за швидкість.", answer: "Consistency is more important than speed." },
  { id: "tm-translation-point", prompt: "У цьому й суть: нам треба діяти зараз.", answer: "That's the point: we need to act now." },
  { id: "tm-translation-negotiations", prompt: "Мирні переговори відновилися сьогодні.", answer: "Peace negotiations resumed today." },
  { id: "tm-translation-ceasefire", prompt: "Сторони погодилися на тимчасове припинення вогню.", answer: "Both sides agreed to a temporary ceasefire." },
];

const fillExercise: HomeworkExercise = {
  id: "tm-vocabulary-insertion",
  title: "Vocabulary 1 — Fill in the gaps",
  instruction: "Complete each sentence with a word or phrase from the list.",
  kind: "fill",
  wordBank: fillItems.map((item) => item.answer!).filter(Boolean).slice(1).concat(fillItems[0].answer!),
  items: fillItems,
};

const definitionExercise: HomeworkExercise = {
  id: "tm-vocabulary-definition",
  title: "Vocabulary 2 — Guess by description",
  instruction: "Read each description and write the exact word or phrase.",
  kind: "definition",
  items: definitionItems,
};

const describeExercise: HomeworkExercise = {
  id: "tm-vocabulary-describe",
  title: "Vocabulary 3 — Describe the words",
  instruction: "Explain every word or phrase in simple English.",
  kind: "describe",
  items: describeWords.map((word, index) => ({
    id: `tm-describe-${index + 1}`,
    prompt: word,
    word,
  })),
};

const translationExercise: HomeworkExercise = {
  id: "tm-vocabulary-translation",
  title: "Translation — Into English",
  instruction: "Translate every sentence from Ukrainian into English.",
  kind: "translate",
  translationDirection: "to-english",
  items: translationItems,
};

const plan: InteractiveHomeworkPlan = {
  kind: "INTERACTIVE_HOMEWORK_V1",
  title: "Tucker and Mendel — Homework",
  intro: "Vocabulary practice from the lesson. Written and voice questions will be added later.",
  exercises: [
    fillExercise,
    definitionExercise,
    describeExercise,
    translationExercise,
    {
      id: "tm-questions-written",
      title: "Questions — Written answers",
      instruction: "Write your answer below each question.",
      kind: "question-text",
      items: [],
    },
    {
      id: "tm-questions-voice",
      title: "Questions — Voice answers",
      instruction: "Record and publish a separate voice answer for every question.",
      kind: "question-audio",
      items: [],
    },
  ],
};

async function main() {
  const [unit] = await db
    .select({ id: lessonUnits.id, title: lessonUnits.title })
    .from(lessonUnits)
    .where(eq(lessonUnits.title, LESSON_TITLE))
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
    vocabularyTasks: fillItems.length + definitionItems.length + describeWords.length,
    translations: translationItems.length,
    emptyQuestionBlocks: plan.exercises.filter((exercise) =>
      exercise.kind === "question-text" || exercise.kind === "question-audio").length,
  }));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
