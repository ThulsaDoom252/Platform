import {
  homeworkAssignedAt,
  homeworkAssignedExercisesKey,
  homeworkPlanOverrideKey,
  homeworkRemovedAt,
  normalizeInteractiveHomework,
  type HomeworkExercise,
  type HomeworkStoredState,
  type InteractiveHomeworkPlan,
} from "../lesson-homework";

/** Stable IDs keep existing student answers intact when the lesson is updated. */
export const PART9_GRAMMAR_EXERCISES: HomeworkExercise[] = [
  {
    id: "tm9-grammar-who-whom-choice",
    title: "Grammar 1 — Choose who or whom",
    instruction: "Выбери who или whom. Who — подлежащее; после предлога перед местоимением (from / with / to) используй формальное whom.",
    kind: "fill",
    items: [
      { id: "tm9-who-whom-choice-1", prompt: "With ___ did the former artist develop this surreal project?", answer: "whom", choices: ["who", "whom"] },
      { id: "tm9-who-whom-choice-2", prompt: "___ made the security service drop the accusation of treason?", answer: "who", choices: ["who", "whom"] },
      { id: "tm9-who-whom-choice-3", prompt: "The adviser from ___ we received the feedback later demanded an apology.", answer: "whom", choices: ["who", "whom"] },
      { id: "tm9-who-whom-choice-4", prompt: "___ would dare to go against a bunch of people pushing through the same agenda?", answer: "who", choices: ["who", "whom"] },
      { id: "tm9-who-whom-choice-5", prompt: "To ___ should we send an account of the shelling?", answer: "whom", choices: ["who", "whom"] },
      { id: "tm9-who-whom-choice-6", prompt: "The journalist ___ exposed the illegal purchase was threatened the next day.", answer: "who", choices: ["who", "whom"] },
      { id: "tm9-who-whom-choice-7", prompt: "___ offered us an opportunity to solve this weird problem in a legal way?", answer: "who", choices: ["who", "whom"] },
      { id: "tm9-who-whom-choice-8", prompt: "The person to ___ she showed the missile fragment called her survival pure luck.", answer: "whom", choices: ["who", "whom"] },
    ],
  },
  {
    id: "tm9-grammar-who-whom-translation",
    title: "Grammar 2 — Translate into English: who / whom",
    instruction: "Переведи предложения на английский, используя who или whom и слова урока. В формальном варианте предлог стоит перед whom; в разговорном варианте с who — в конце вопроса или придаточного предложения. Оба варианта допустимы, если смысл сохранён.",
    kind: "translate",
    translationDirection: "to-english",
    translationLanguage: "RU",
    items: [
      { id: "tm9-who-whom-translation-1", prompt: "С кем ты обсуждал возможность приобрести этот сюрреалистичный портрет?", answer: "Who did you discuss the opportunity to purchase this surreal portrait with?" },
      { id: "tm9-who-whom-translation-2", prompt: "Бывший советник, от которого мы получили отзыв, потребовал объяснений.", answer: "The former adviser, from whom we received feedback, demanded an explanation." },
      { id: "tm9-who-whom-translation-3", prompt: "Кто заставил художника удалить его аккаунт?", answer: "Who made the artist get rid of his account?" },
      { id: "tm9-who-whom-translation-4", prompt: "Кому служба безопасности отправила предупреждение об угрозе?", answer: "To whom did the security service send a warning about the threat?" },
      { id: "tm9-who-whom-translation-5", prompt: "От кого ты узнал о странном запрете?", answer: "Who did you hear about the strange ban from?" },
      { id: "tm9-who-whom-translation-6", prompt: "Журналист, с которым она разговаривала, назвал её спасение чистым везением.", answer: "The journalist with whom she spoke called her survival pure luck." },
      { id: "tm9-who-whom-translation-7", prompt: "Кто помог им решить проблему законным путём, не идя против своих друзей?", answer: "Who helped them solve the problem in a legal way without going against their friends?" },
      { id: "tm9-who-whom-translation-8", prompt: "С кем ты хочешь построить крепкую дружбу?", answer: "Who do you want to develop a strong friendship with?" },
    ],
  },
  {
    id: "tm9-grammar-who-whom-rewrite",
    title: "Grammar 3 — Rewrite whom as who",
    instruction: "Перепиши каждое предложение в разговорном стиле: замени whom на who и перенеси from / with / to в конец вопроса или придаточного предложения. Сохрани остальные слова и смысл. Напиши полный вариант в поле под предложением.",
    kind: "question-text",
    items: [
      { id: "tm9-who-whom-rewrite-1", prompt: "From whom did you receive this strange feedback?", answer: "Who did you receive this strange feedback from?" },
      { id: "tm9-who-whom-rewrite-2", prompt: "The former adviser with whom she worked refused to push through the agenda.", answer: "The former adviser who she worked with refused to push through the agenda." },
      { id: "tm9-who-whom-rewrite-3", prompt: "To whom did the security service send an account of the shelling?", answer: "Who did the security service send an account of the shelling to?" },
      { id: "tm9-who-whom-rewrite-4", prompt: "The artist from whom I purchased this surreal painting was later accused of treason.", answer: "The artist who I purchased this surreal painting from was later accused of treason." },
      { id: "tm9-who-whom-rewrite-5", prompt: "With whom would you like to solve this weird problem?", answer: "Who would you like to solve this weird problem with?" },
      { id: "tm9-who-whom-rewrite-6", prompt: "The journalist to whom I spoke called our survival pure luck.", answer: "The journalist who I spoke to called our survival pure luck." },
      { id: "tm9-who-whom-rewrite-7", prompt: "From whom did she learn about the opportunity to develop the project?", answer: "Who did she learn about the opportunity to develop the project from?" },
      { id: "tm9-who-whom-rewrite-8", prompt: "The friend with whom he discussed the threat helped him work out a plan.", answer: "The friend who he discussed the threat with helped him work out a plan." },
    ],
  },
];

export const PART9_GRAMMAR_IDS = PART9_GRAMMAR_EXERCISES.map((exercise) => exercise.id);

/** Append only missing exercises; never replace a teacher's edited copy. */
export function addPart9Grammar(plan: InteractiveHomeworkPlan): InteractiveHomeworkPlan {
  const present = new Set(plan.exercises.map((exercise) => exercise.id));
  const missing = PART9_GRAMMAR_EXERCISES.filter((exercise) => !present.has(exercise.id));
  if (!missing.length) return plan;
  const questionsAt = plan.exercises.findIndex((exercise) =>
    exercise.id === "tm9-written-questions" || exercise.id === "tm9-voice-questions",
  );
  const insertAt = questionsAt < 0 ? plan.exercises.length : questionsAt;
  return {
    ...plan,
    exercises: [
      ...plan.exercises.slice(0, insertAt),
      ...structuredClone(missing),
      ...plan.exercises.slice(insertAt),
    ],
  };
}

/** Preserve every answer, attempt, note, reaction and review timestamp. */
export function addPart9GrammarToState(state: HomeworkStoredState): HomeworkStoredState {
  const next = { ...state };
  const overrideKey = homeworkPlanOverrideKey();
  if (state[overrideKey]) {
    const raw = JSON.parse(state[overrideKey]);
    if (!normalizeInteractiveHomework(raw, { allowEmpty: true, organizeVocabulary: false })) {
      throw new Error("Invalid Part 9 homework override");
    }
    const revised = addPart9Grammar(raw as InteractiveHomeworkPlan);
    if (revised !== raw) next[overrideKey] = JSON.stringify(revised);
  }
  if (homeworkAssignedAt(state) && !homeworkRemovedAt(state)) {
    const key = homeworkAssignedExercisesKey();
    const selected: unknown = JSON.parse(state[key] ?? "[]");
    if (!Array.isArray(selected) || selected.some((id) => typeof id !== "string")) {
      throw new Error("Invalid Part 9 exercise selection");
    }
    if (PART9_GRAMMAR_IDS.some((id) => !selected.includes(id))) {
      next[key] = JSON.stringify([...new Set([...selected, ...PART9_GRAMMAR_IDS])]);
    }
  }
  return next;
}
