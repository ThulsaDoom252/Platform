import "dotenv/config";
import { asc, eq } from "drizzle-orm";
import { db } from "../src/lib/db";
import { lessonUnits, lessonWords } from "../src/lib/db/schema";
import type { InteractiveHomeworkPlan } from "../src/lib/lesson-homework";

const words = [
  {
    category: "Meat", sectionColor: "#ef4444", icon: "🥩", word: "meat", ipaUs: "/miːt/", ipaUk: "/miːt/",
    translation: "м'ясо", description: "The flesh of an animal that people cook and eat.",
    note: "Незлічуване: much meat, a lot of meat — без артикля a.",
    examples: [{ en: "I don't eat much meat.", tr: "Я не їм багато м'яса." }, { en: "There is a lot of meat on the table.", tr: "На столі багато м'яса." }],
  },
  {
    category: "Meat", sectionColor: "#ef4444", icon: "🍗", word: "chicken", ipaUs: "/ˈtʃɪk.ɪn/", ipaUk: "/ˈtʃɪk.ɪn/",
    translation: "курятина / курка", description: "Meat from a chicken; it can also mean the bird itself.",
    note: "Chicken як їжа — незлічуване; a chicken — одна курка-птах.",
    examples: [{ en: "Chicken is my favourite meat.", tr: "Курятина — моє улюблене м'ясо." }, { en: "I usually have chicken for lunch.", tr: "Я зазвичай їм курятину на обід." }],
  },
  {
    category: "Meat", sectionColor: "#ef4444", icon: "🐖", word: "pork", ipaUs: "/pɔːrk/", ipaUk: "/pɔːk/",
    translation: "свинина", description: "Meat that comes from a pig.",
    note: "Незлічуване. Pork = meat from a pig.",
    examples: [{ en: "Pork is meat from a pig.", tr: "Свинина — це м'ясо свині." }, { en: "My dad loves pork.", tr: "Мій тато любить свинину." }],
  },
  {
    category: "Meat", sectionColor: "#ef4444", icon: "🐄", word: "beef", ipaUs: "/biːf/", ipaUk: "/biːf/",
    translation: "яловичина", description: "Meat that comes from a cow.",
    note: "Незлічуване. Beef = meat from a cow.",
    examples: [{ en: "Beef is meat from a cow.", tr: "Яловичина — це м'ясо корови." }, { en: "We often cook beef on Sunday.", tr: "Ми часто готуємо яловичину в неділю." }],
  },
  {
    category: "Meat", sectionColor: "#ef4444", icon: "🥩", word: "steak", ipaUs: "/steɪk/", ipaUk: "/steɪk/",
    translation: "стейк", description: "A thick, flat piece of meat, usually beef.",
    note: "Злічуване: a steak, two steaks.",
    examples: [{ en: "He has a big steak for dinner.", tr: "Він їсть великий стейк на вечерю." }, { en: "I seldom eat steak at home.", tr: "Я рідко їм стейк удома." }],
  },
  {
    category: "Meat", sectionColor: "#ef4444", icon: "🧆", word: "meatballs", ipaUs: "/ˈmiːt.bɔːlz/", ipaUk: "/ˈmiːt.bɔːlz/",
    translation: "фрикадельки / тефтелі", description: "Small round balls made from minced meat.",
    note: "Одна — a meatball; множина — meatballs.",
    examples: [{ en: "My mother makes meatballs every Friday.", tr: "Моя мама готує фрикадельки щоп'ятниці." }, { en: "Meatballs are small balls of minced meat.", tr: "Фрикадельки — це маленькі кульки з фаршу." }],
  },
  {
    category: "Meat", sectionColor: "#ef4444", icon: "🥓", word: "bacon", ipaUs: "/ˈbeɪ.kən/", ipaUk: "/ˈbeɪ.kən/",
    translation: "бекон", description: "Salted or smoked pork, often eaten for breakfast.",
    note: "Зазвичай незлічуване: some bacon, much bacon.",
    examples: [{ en: "I sometimes have bacon for breakfast.", tr: "Я інколи їм бекон на сніданок." }, { en: "Bacon is smoked pork.", tr: "Бекон — це копчена свинина." }],
  },
  {
    category: "Meat", sectionColor: "#ef4444", icon: "🫙", word: "minced meat (UK) / ground meat (US)", ipaUs: "/ɡraʊnd miːt/", ipaUk: "/mɪnst miːt/",
    translation: "фарш", description: "Meat cut into very small pieces by a machine.",
    note: "UK: minced meat; US: ground meat. Minced beef — яловичий фарш.",
    examples: [{ en: "We need minced meat for meatballs.", tr: "Нам потрібен фарш для фрикадельок." }, { en: "My mom buys minced beef on Saturday.", tr: "Моя мама купує яловичий фарш у суботу." }],
  },
  {
    category: "Meat", sectionColor: "#ef4444", icon: "🍔", word: "a patty → patties", ipaUs: "/ˈpæt̬.i/", ipaUk: "/ˈpæt.i/",
    translation: "котлета / биток", description: "A flat, round piece of minced meat.",
    note: "Множина змінює -y на -ies: a patty → patties.",
    examples: [{ en: "There is a beef patty in a burger.", tr: "У бургері є яловича котлета." }, { en: "My grandmother makes chicken patties.", tr: "Моя бабуся готує курячі котлети." }],
  },
  {
    category: "Fish", sectionColor: "#0ea5e9", icon: "🐟", word: "fish", ipaUs: "/fɪʃ/", ipaUk: "/fɪʃ/",
    translation: "риба", description: "An animal that lives in water; also food made from it.",
    note: "Звичайна множина теж fish: one fish, two fish.",
    examples: [{ en: "I eat fish on Fridays.", tr: "Я їм рибу по п'ятницях." }, { en: "Fish live in water.", tr: "Риби живуть у воді." }],
  },
  {
    category: "Fish", sectionColor: "#0ea5e9", icon: "🐟", word: "tuna", ipaUs: "/ˈtuː.nə/", ipaUk: "/ˈtjuː.nə/",
    translation: "тунець", description: "A large sea fish often used in salads and sandwiches.",
    note: "Як їжа tuna зазвичай незлічуване.",
    examples: [{ en: "I like a sandwich with tuna.", tr: "Мені подобається сендвіч із тунцем." }, { en: "Tuna is a very big fish.", tr: "Тунець — дуже велика риба." }],
  },
  {
    category: "Fish", sectionColor: "#0ea5e9", icon: "🍣", word: "salmon", ipaUs: "/ˈsæm.ən/", ipaUk: "/ˈsæm.ən/",
    translation: "лосось", description: "A pink-fleshed fish that can be raw, fried or smoked.",
    note: "Літера l не вимовляється: /ˈsæm.ən/.",
    examples: [{ en: "Salmon is my favourite fish.", tr: "Лосось — моя улюблена риба." }, { en: "People in Japan often eat raw salmon.", tr: "У Японії люди часто їдять сирого лосося." }],
  },
  {
    category: "Cooking", sectionColor: "#f59e0b", icon: "💨", word: "smoked", ipaUs: "/smoʊkt/", ipaUk: "/sməʊkt/",
    translation: "копчений", description: "Prepared and flavoured with smoke.",
    note: "Форма дієслова smoke; про їжу — копчений.",
    examples: [{ en: "I like smoked salmon.", tr: "Мені подобається копчений лосось." }, { en: "My grandparents make smoked bacon.", tr: "Мої дідусь і бабуся роблять копчений бекон." }],
  },
  {
    category: "Cooking", sectionColor: "#f59e0b", icon: "♨️", word: "boiled", ipaUs: "/bɔɪld/", ipaUk: "/bɔɪld/",
    translation: "варений", description: "Cooked in very hot water.",
    note: "Boil — варити; boiled — варений.",
    examples: [{ en: "Boiled chicken is good for children.", tr: "Варена курятина корисна для дітей." }, { en: "I don't like boiled fish.", tr: "Я не люблю варену рибу." }],
  },
  {
    category: "Cooking", sectionColor: "#f59e0b", icon: "🔪", word: "raw", ipaUs: "/rɔː/", ipaUk: "/rɔː/",
    translation: "сирий / неприготований", description: "Not cooked.",
    note: "Raw food не проходила термічну обробку.",
    examples: [{ en: "Don't eat raw chicken!", tr: "Не їж сиру курятину!" }, { en: "Sushi can contain raw fish.", tr: "Суші можуть містити сиру рибу." }],
  },
  {
    category: "Cooking", sectionColor: "#f59e0b", icon: "🍳", word: "fried", ipaUs: "/fraɪd/", ipaUk: "/fraɪd/",
    translation: "смажений", description: "Cooked in hot oil or fat.",
    note: "Fry — смажити; fried — смажений.",
    examples: [{ en: "I love fried fish.", tr: "Я люблю смажену рибу." }, { en: "Fried meat is not good every day.", tr: "Смажене м'ясо не варто їсти щодня." }],
  },
] as const;

const homework: InteractiveHomeworkPlan = {
  kind: "INTERACTIVE_HOMEWORK_V1",
  title: "Meat & Fish — compact review",
  intro: "A short review of the vocabulary, grammar, reading and speaking from the whole lesson.",
  exercises: [
    {
      id: "mf-vocab-fill",
      title: "Vocabulary — fill in the gaps",
      instruction: "Complete each sentence with one word or phrase from the list.",
      kind: "fill",
      wordBank: ["bacon", "boiled", "meatballs", "minced meat", "raw", "salmon", "steak", "tuna"],
      items: [
        { id: "mf-fill-1", prompt: "We need ___ to make burgers and meatballs.", answer: "minced meat", accepted: ["ground meat"] },
        { id: "mf-fill-2", prompt: "Do not eat ___ chicken.", answer: "raw" },
        { id: "mf-fill-3", prompt: "I ordered a beef ___ at the restaurant.", answer: "steak" },
        { id: "mf-fill-4", prompt: "My grandma cooked small ___ in tomato sauce.", answer: "meatballs" },
        { id: "mf-fill-5", prompt: "This fish was cooked in hot water, so it is ___.", answer: "boiled" },
        { id: "mf-fill-6", prompt: "I put ___ in my sandwich because I like this large sea fish.", answer: "tuna" },
        { id: "mf-fill-7", prompt: "We had eggs and ___ for breakfast.", answer: "bacon" },
        { id: "mf-fill-8", prompt: "People often eat smoked ___, and it is also popular raw in sushi.", answer: "salmon" },
      ],
    },
    {
      id: "mf-describe",
      title: "Vocabulary — describe it",
      instruction: "Explain each word in simple English and give one short example.",
      kind: "describe",
      items: [
        { id: "mf-describe-1", prompt: "", word: "pork" },
        { id: "mf-describe-2", prompt: "", word: "a patty" },
        { id: "mf-describe-3", prompt: "", word: "smoked" },
        { id: "mf-describe-4", prompt: "", word: "fried" },
        { id: "mf-describe-5", prompt: "", word: "beef" },
      ],
    },
    {
      id: "mf-grammar",
      title: "Grammar — mixed review",
      instruction: "Complete each real sentence with the correct form.",
      kind: "fill",
      items: [
        { id: "mf-grammar-1", prompt: "Lucy made the meatballs ___.", answer: "herself" },
        { id: "mf-grammar-2", prompt: "If it rains tomorrow, we ___ dinner at home.", answer: "will have", accepted: ["'ll have"] },
        { id: "mf-grammar-3", prompt: "If I ___ you, I would try the salmon.", answer: "were" },
        { id: "mf-grammar-4", prompt: "You look tired. You ___ go to bed early.", answer: "should" },
        { id: "mf-grammar-5", prompt: "I ___ raw fish before.", answer: "have never eaten", accepted: ["'ve never eaten"] },
        { id: "mf-grammar-6", prompt: "Look! Dad ___ steaks in the garden.", answer: "is cooking", accepted: ["'s cooking"] },
      ],
    },
    {
      id: "mf-translation",
      title: "Translation — into English",
      instruction: "Translate the sentences into English.",
      kind: "translate",
      translationDirection: "to-english",
      items: [
        { id: "mf-translate-1", prompt: "Я не їм багато м'яса.", answer: "I don't eat much meat." },
        { id: "mf-translate-2", prompt: "Моя бабуся сама готує курячі котлети.", answer: "My grandmother makes chicken patties herself." },
        { id: "mf-translate-3", prompt: "Якщо завтра буде сонячно, ми посмажимо стейки.", answer: "If it is sunny tomorrow, we will cook steaks." },
        { id: "mf-translate-4", prompt: "Якби я жив у Японії, я б часто їв сирого лосося.", answer: "If I lived in Japan, I would often eat raw salmon." },
        { id: "mf-translate-5", prompt: "Тобі не слід їсти стільки бекону щодня.", answer: "You shouldn't eat so much bacon every day." },
        { id: "mf-translate-6", prompt: "Ти коли-небудь куштував копченого тунця?", answer: "Have you ever tried smoked tuna?" },
      ],
    },
    {
      id: "mf-questions",
      title: "Reading & speaking",
      instruction: "Answer in two or three complete sentences.",
      kind: "question-text",
      items: [
        { id: "mf-question-1", prompt: "What food from the lesson do you eat most often?" },
        { id: "mf-question-2", prompt: "What did Lucy cook for her family, and why did she also cook fish?" },
        { id: "mf-question-3", prompt: "What would you cook if friends came to your home this weekend?" },
        { id: "mf-question-4", prompt: "Which is better for you: boiled, smoked or fried food? Why?" },
      ],
    },
  ],
};

async function main() {
  const units = await db
    .select({ id: lessonUnits.id, title: lessonUnits.title })
    .from(lessonUnits)
    .where(eq(lessonUnits.title, "Meat & Fish"))
    .orderBy(asc(lessonUnits.createdAt));
  if (units.length === 0) throw new Error("Meat & Fish lesson not found");

  for (const unit of units) {
    await db.transaction(async (tx) => {
      await tx.delete(lessonWords).where(eq(lessonWords.unitId, unit.id));
      await tx.insert(lessonWords).values(words.map((word, index) => ({
        unitId: unit.id,
        ...word,
        examples: [...word.examples],
        sortOrder: index + 1,
      })));
      await tx
        .update(lessonUnits)
        .set({ homework: [homework], updatedAt: new Date() })
        .where(eq(lessonUnits.id, unit.id));
    });
  }

  console.log(JSON.stringify({ lessons: units.length, words: words.length, exercises: homework.exercises.length }));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
