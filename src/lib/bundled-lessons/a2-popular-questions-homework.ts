import { normalizeInteractiveHomework, type InteractiveHomeworkPlan } from "../lesson-homework";

const POPULAR_QUESTIONS_HOMEWORK: InteractiveHomeworkPlan = {
  kind: "INTERACTIVE_HOMEWORK_V1",
  title: "Popular questions · Homework",
  intro: "A short review of getting to know people: questions, useful expressions, advice and conditionals. About 15–20 minutes. Written answers can be short. Never share a real phone number: invent one if you need it.",
  exercises: [
    {
      id: "pq-recall-questions", title: "1 · Find the question", kind: "definition",
      instruction: "Read the reply and write the matching question from the lesson. Write the whole question.",
      items: [
        { id: "pq-recall-01", prompt: "‘I'm from Poland.’ Ask about the speaker's country of origin.", answer: "Where are you from?" },
        { id: "pq-recall-02", prompt: "‘Ukrainian, English and a little German.’ Ask about languages.", answer: "What languages do you speak?", accepted: ["Which languages do you speak?"] },
        { id: "pq-recall-03", prompt: "‘It's oh-seven, double five, two-one.’ Ask for the phone number.", answer: "What is your phone number?", accepted: ["What's your phone number?"] },
      ],
    },
    {
      id: "pq-repair-sentences", title: "2 · Repair the sentence", kind: "fill",
      instruction: "Rewrite each sentence or question correctly. Keep the same meaning and all the information. Write the whole sentence, not just the changed word.",
      items: [
        { id: "pq-repair-01", prompt: "I have twenty-nine years.", answer: "I am twenty-nine years old.", accepted: ["I'm twenty-nine years old.", "I am twenty-nine.", "I'm twenty-nine.", "I am 29 years old.", "I'm 29 years old.", "I am 29.", "I'm 29."] },
        { id: "pq-repair-02", prompt: "What is your hobbies?", answer: "What are your hobbies?" },
        { id: "pq-repair-03", prompt: "Where you live?", answer: "Where do you live?" },
      ],
    },
    {
      id: "pq-grammar-mix", title: "3 · A little grammar", kind: "fill",
      instruction: "Write only the missing words. In 1–3, use the expression named in brackets. In 4–6, use the verb in brackets in the correct form. The examples practise zero, first and second conditionals.",
      items: [
        { id: "pq-grammar-01", prompt: "Ability (use can): I ___ speak English and a little Polish.", answer: "can" },
        { id: "pq-grammar-02", prompt: "Friendly advice (use should): You ___ practise a little every day.", answer: "should" },
        { id: "pq-grammar-03", prompt: "Urgent advice (use had better): The train leaves in five minutes! We ___ go now.", answer: "had better", accepted: ["'d better"] },
        { id: "pq-grammar-04", prompt: "General habit: If I ___ a new English word, I write it in my notebook. (learn)", answer: "learn" },
        { id: "pq-grammar-05", prompt: "A real plan for tomorrow: If I finish work early, I ___ you tomorrow. (call; use will)", answer: "will call", accepted: ["'ll call"] },
        { id: "pq-grammar-06", prompt: "An imaginary situation: If I ___ a chef, I would cook for my friends every weekend. (be)", answer: "were", accepted: ["was"] },
      ],
    },
    {
      id: "pq-translate-phrases", title: "4 · Say it in English", kind: "translate",
      instruction: "Translate the three phrases into English using the language from the lesson. Contractions are welcome.",
      translationDirection: "to-english", translationLanguage: "UK",
      items: [
        { id: "pq-translate-01", prompt: "Яка твоя улюблена їжа?", answer: "What is your favourite food?", accepted: ["What's your favourite food?", "What is your favorite food?", "What's your favorite food?"] },
        { id: "pq-translate-02", prompt: "У тебе є робота?", answer: "Do you have a job?", accepted: ["Have you got a job?"] },
        { id: "pq-translate-03", prompt: "Я хотіла б працювати шеф-кухарем.", answer: "I would like to work as a chef.", accepted: ["I'd like to work as a chef.", "I would like to be a chef.", "I'd like to be a chef."] },
      ],
    },
    {
      id: "pq-read-mini-dialogue", title: "5 · Meet a new neighbour", kind: "question-text",
      instruction: "Read the short dialogue and answer the three questions in English. One short sentence per answer is enough; use only the information in the dialogue.",
      referenceTitle: "Mia and her new neighbour",
      referenceText: "Mia: Hi, I'm Mia. Are you our new neighbour?\nAlex: Yes! I'm Alex. I'm from Poland, but now I live here in Lviv.\nMia: What languages do you speak?\nAlex: Polish, English and a little Ukrainian.\nMia: Do you have a job?\nAlex: Yes, I work in a café, but I'd like to be a chef. My hobbies are cooking and drawing.\nMia: You should meet my friends. If you're free on Saturday, we'll make dinner together.\nAlex: Thanks! If I were a chef, I'd cook something special for everyone!",
      items: [
        { id: "pq-read-01", prompt: "Where is Alex from, and where does he live now?" },
        { id: "pq-read-02", prompt: "Where does Alex work, and what job would he like to have?" },
        { id: "pq-read-03", prompt: "What will Mia and Alex do if Alex is free on Saturday?" },
      ],
    },
    {
      id: "pq-write-questions", title: "6 · Ask your teacher", kind: "question-text",
      instruction: "Write two different questions for your teacher in one field. You do not need to answer them.",
      items: [
        { id: "pq-write-01", prompt: "Ask one question about your teacher's hobbies or languages. Then ask one imaginary question using ‘What … would you … if …?’ and a past form after if. For example, choose a new place to live or a different job, but write your own question." },
      ],
    },
    {
      id: "pq-speak-about-you", title: "7 · Your mini-introduction", kind: "question-audio",
      instruction: "Record one relaxed 30–45-second introduction. Short, simple sentences are fine; do not read a long script.",
      items: [
        { id: "pq-speak-01", prompt: "Say where you are from and where you live. Mention the languages you speak, your favourite food and one hobby. Add what job you would like to have and one thing you can do well. Do not include your phone number or exact address." },
      ],
    },
  ],
};

/** A fresh, portable native plan; installing it never assigns work to a student. */
export function buildPopularQuestionsHomework(): InteractiveHomeworkPlan {
  const plan = normalizeInteractiveHomework(POPULAR_QUESTIONS_HOMEWORK);
  if (!plan || plan.exercises.length !== 7 || plan.exercises.reduce((sum, exercise) => sum + exercise.items.length, 0) !== 20) {
    throw new Error("Popular questions homework requires seven short exercises and twenty items");
  }
  return JSON.parse(JSON.stringify(plan)) as InteractiveHomeworkPlan;
}
