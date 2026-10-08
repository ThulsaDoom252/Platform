import type { InteractiveHomeworkPlan, HomeworkExercise } from "../lesson-homework";
import type { LessonWord } from "../lesson-unit";
import { addRegularLessonFocusIds, normalizeRegularLessonSections, type RegularLessonSection, type RegularLessonTone } from "../regular-lesson";
import { cleanScriptHtml } from "../script-html";
import { organizeVocabularyHomework } from "../vocabulary-homework";
import { vegetablesCardsFromHtml as vocabularyCardsFromHtml } from "./a2-vegetables-vocabulary";

type WordContent = Omit<LessonWord, "id">;
export const BERRIES_LESSON_TITLE = "A2 · Berries";

const details: Record<string, { ipaUs: string; description: string; note: string; example?: string }> = {
  fruit: { ipaUs: "/fruːt/", description: "Food such as apples, oranges and bananas that grows on plants and trees.", note: "Зазвичай незлічуване: some fruit / a lot of fruit / How much fruit? fruits — різні види фруктів. Fruit is good for you, не fruit are." },
  "a berry": { ipaUs: "/ˈber.i/", description: "A small soft fruit, such as a strawberry or a raspberry.", note: "a berry → berries: приголосна + y → -ies. Злічуване: one berry / many berries.", example: "This berry is sweet." },
  "an apple": { ipaUs: "/ˈæp.əl/", description: "A round red, green or yellow fruit that grows on a tree.", note: "an apple, не a apple: слово починається з голосного звука. Множина: apples. An apple a day keeps the doctor away — відома приказка." },
  "a pineapple": { ipaUs: "/ˈpaɪnˌæp.əl/", description: "A large tropical fruit with rough skin, yellow flesh and leaves on top.", note: "a pineapple → pineapples. У назві є apple, але це не яблуко! pineapple juice — ананасовий сік." },
  "an orange": { ipaUs: "/ˈɔːr.ɪndʒ/", description: "A round citrus fruit with a thick skin; its name is also a colour.", note: "an orange → oranges. orange — також помаранчевий колір. orange juice — апельсиновий сік. UK /ˈɒr.ɪndʒ/, US /ˈɔːr.ɪndʒ/." },
  "a banana": { ipaUs: "/bəˈnæn.ə/", description: "A long curved fruit with yellow skin that grows in hot countries.", note: "a banana → bananas. Наголос на другому складі. UK /bəˈnɑː.nə/, US /bəˈnæn.ə/. a banana for breakfast — банан на сніданок." },
  "a strawberry": { ipaUs: "/ˈstrɑːˌber.i/", description: "A red heart-shaped soft fruit with small seeds on the outside.", note: "a strawberry → strawberries: y → -ies. strawberry jam — полуничне варення; strawberries for dessert — полуниця на десерт.", example: "I put a strawberry in my smoothie." },
  "a raspberry": { ipaUs: "/ˈræz.ber.i/", description: "A small soft red fruit made of many tiny round parts, often used in jam.", note: "a raspberry → raspberries. Літера p не вимовляється! raspberry jam — малинове варення. UK /ˈrɑːz.bər.i/, US /ˈræz.ber.i/." },
  "a grape": { ipaUs: "/ɡreɪp/", description: "A small green or purple fruit that grows in bunches and can be used to make wine.", note: "a grape — одна виноградина; grapes — виноград (ягоди), не гроно. a bunch of grapes — гроно винограду. Зазвичай кажемо I like grapes.", example: "This grape is sweet." },
  "a watermelon": { ipaUs: "/ˈwɑː.t̬ɚˌmel.ən/", description: "A very large round fruit with green skin, red flesh and a lot of water inside.", note: "watermelon 🍉 — кавун; melon 🍈 — диня. a slice of watermelon — шматочок кавуна. water + melon допоможе запам'ятати назву." },
  "a melon": { ipaUs: "/ˈmel.ən/", description: "A large sweet fruit with yellow or green skin and pale orange or green flesh.", note: "a melon → melons. Не плутай: melon — диня, watermelon — кавун. a slice of melon — шматочок дині." },
};

type SupportSeed = [string, string, string, string, string, string, string, string, string];
const support: SupportSeed[] = [
  ["sweet", "солодкий", "Adjectives", "🍯", "/swiːt/", "/swiːt/", "With a taste like sugar or honey.", "sweet ↔ sour. sweet fruit — солодкі фрукти; sweeter — солодший. Прикметник перед іменником: sweet berries.", "These berries are sweet."],
  ["sour", "кислий", "Adjectives", "🍋", "/saʊr/", "/saʊə/", "With a sharp taste like a lemon, not like sugar.", "sour fruit — кислі фрукти. sweet and sour — кисло-солодкий. Не плутай з sore — болючий.", "This orange is sour."],
  ["juice", "сік", "Nouns", "🧃", "/dʒuːs/", "/dʒuːs/", "A drink made from the liquid inside fruit or vegetables.", "Зазвичай незлічуване: some juice / How much juice? a glass of juice — склянка соку; orange juice — апельсиновий сік.", "I drink orange juice every morning."],
  ["jam", "варення / джем", "Nouns", "🫙", "/dʒæm/", "/dʒæm/", "A sweet thick food made by cooking fruit with sugar, often put on bread.", "Незлічуване: some jam. a jar of jam — банка варення. raspberry jam / strawberry jam — малинове / полуничне варення.", "My grandma makes raspberry jam."],
  ["healthy", "здоровий / корисний для здоров'я", "Adjectives", "💚", "/ˈhel.θi/", "/ˈhel.θi/", "Good for your body, or in good physical condition.", "healthy food — корисна їжа; a healthy person — здорова людина. healthy ↔ unhealthy. healthier — корисніший / здоровіший.", "Fruit is healthy."],
  ["a tree", "дерево", "Nouns", "🌳", "/triː/", "/triː/", "A tall plant with a strong wooden trunk and branches.", "a tree → trees. Apples grow on trees — яблука ростуть на деревах. an apple tree — яблуня.", "There is an apple tree in our garden."],
  ["to pick", "збирати / зривати (ягоди, фрукти)", "Verbs", "🧺", "/pɪk/", "/pɪk/", "To take fruit or flowers off a plant by hand.", "pick → picked. to pick berries — збирати ягоди; to pick apples — зривати яблука. picking — без подвоєння k.", "We like to pick berries in the garden."],
  ["to listen (to)", "слухати", "Verbs", "👂", "/ˈlɪs.ən/", "/ˈlɪs.ən/", "To pay attention to sounds or to what somebody says.", "listen to somebody / something: listen to your grandma. t не вимовляється. listen → listened. hear — чути, listen — слухати уважно.", "You should listen to your grandma."],
  ["late", "пізній / пізно / із запізненням", "Adjectives & Adverbs", "⏰", "/leɪt/", "/leɪt/", "After the usual or expected time.", "be late for work / the bus — запізнюватися на роботу / автобус. go to bed late — пізно лягати спати. late ↔ early.", "We'd better go now, or we'll be late."],
  ["a smoothie", "смузі", "Nouns", "🥤", "/ˈsmuː.ði/", "/ˈsmuː.ði/", "A thick drink made by mixing fruit, sometimes with milk or yoghurt.", "a smoothie → smoothies. a raspberry smoothie — малинове смузі. make a smoothie — приготувати смузі. smoothie густіше за juice.", "Let's make a raspberry smoothie."],
  ["to give", "давати", "Verbs", "🎁", "/ɡɪv/", "/ɡɪv/", "To pass something to somebody so they can have it.", "give → gave → given. У тексті: Grandma gave Kate apples — бабуся дала Кейт яблука. give somebody something / give something to somebody.", "I give my friend an apple."],
];

/** Keep the supplied headwords and examples; adapt only their vocabulary presentation. */
export function berriesVocabulary(html: string): WordContent[] {
  const cards = vocabularyCardsFromHtml(html);
  if (cards.length !== 11 || new Set(cards.map(card => card.word)).size !== 11 || cards.some(card => !details[card.word])) {
    throw new Error("Unexpected Berries vocabulary; refusing an incomplete lesson");
  }
  return [
    ...cards.map(card => {
      const { example, ...detail } = details[card.word];
      return {
        ...card, ...detail,
        ...(card.word === "a grape" ? { translation: "виноградина / виноград" } : {}),
        examples: [...card.examples, ...(example ? [{ en: example, tr: "" }] : [])],
      };
    }),
    ...support.map(([word, translation, category, icon, ipaUs, ipaUk, description, note, en]) => ({
      word, translation, category: `Support · ${category}`, icon, ipaUs, ipaUk, description, note,
      examples: [{ en, tr: "" }, ...(word === "to give" ? [{ en: "Grandma gave Kate a lot of apples.", tr: "Бабуся дала Кейт багато яблук." }] : [])],
      sectionColor: null, imageUrl: null,
    })),
  ];
}

export function berriesHomework(words: WordContent[]): InteractiveHomeworkPlan {
  const vocabulary: HomeworkExercise[] = (["fill", "definition", "describe"] as const).map(kind => ({
    id: `berries-vocab-${kind}`, title: `Vocabulary — ${kind}`, instruction: "", kind, items: [],
  }));
  const translation: HomeworkExercise = {
    id: "berries-translation", title: "Translation — Fruit, advice & Past Continuous", kind: "translate", optional: false,
    instruction: "Переведи предложения на английский. Используй слова урока, should / had better и Past Continuous.",
    translationDirection: "to-english", translationLanguage: "RU",
    items: [
      ["Тебе стоит есть больше фруктов.", "You should eat more fruit."],
      ["Тебе лучше не есть эти ягоды — они не мытые.", "You'd better not eat these berries — they aren't washed."],
      ["Нам лучше уйти сейчас, иначе мы опоздаем.", "We'd better go now, or we'll be late."],
      ["Пока я мыла клубнику, Том ел банан.", "While I was washing the strawberries, Tom was eating a banana."],
      ["Когда бабушка позвонила, я покупала виноград.", "When Grandma called, I was buying grapes."],
      ["Стоит ли мне купить арбуз?", "Should I buy a watermelon?"],
      ["Вчера в семь вечера бабушка делала малиновое варенье.", "At seven yesterday evening Grandma was making raspberry jam."],
      ["Тебе стоит слушать бабушку и мыть фрукты перед едой.", "You should listen to your grandma and wash fruit before you eat it."],
    ].map(([prompt, answer], index) => ({ id: `berries-translation-${index + 1}`, prompt, answer })),
  };
  const questions: HomeworkExercise = {
    id: "berries-personal", title: "Personal questions — Write your answer", kind: "question-text", optional: false,
    instruction: "Ответь на английском: 2–3 предложения на каждый вопрос. Используй новые слова.",
    items: [
      "What fruit or berries do you usually have for breakfast? Why?",
      "Do you prefer sweet or sour fruit? Give two examples.",
      "What should a friend buy to make a fruit salad?",
      "Your friend is late for the bus. What had they better do now?",
      "What were you doing at seven yesterday evening?",
      "Tell us about a time when you were cooking or buying food and somebody called you.",
    ].map((prompt, index) => ({ id: `berries-personal-${index + 1}`, prompt })),
  };
  const advice: HomeworkExercise = {
    id: "berries-grammar-advice-bonus", title: "Bonus — should / had better", kind: "fill", optional: true,
    instruction: "Use should / shouldn't for general advice; had better / had better not for an urgent warning.",
    items: [
      ["General advice: You ___ wash fruit before you eat it.", "should"],
      ["The bus leaves in two minutes! We ___ go now, or we'll miss it.", "had better", "'d better"],
      ["General advice: Children ___ drink a lot of coffee.", "shouldn't", "should not"],
      ["Those berries aren't washed! You ___ eat them now, or you could get ill.", "had better not", "'d better not"],
      ["Asking for advice: ___ I buy a melon or a watermelon?", "Should"],
      ["Your lesson starts in five minutes! You ___ stop making that smoothie and join now.", "had better", "'d better"],
      ["My opinion: You ___ try raspberry jam — it's delicious.", "should"],
      ["Grandma needs these strawberries for dinner! You ___ eat them all, or she'll have none left.", "had better not", "'d better not"],
    ].map(([prompt, answer, alternative], index) => ({ id: `berries-advice-${index + 1}`, prompt, answer, ...(alternative ? { accepted: [alternative] } : {}) })),
  };
  const past: HomeworkExercise = {
    id: "berries-grammar-past-bonus", title: "Bonus — Past Simple / Past Continuous", kind: "fill", optional: true,
    instruction: "Put the verb in brackets into Past Simple or Past Continuous.",
    items: [
      ["At seven yesterday morning, Mark ___ watermelon in the kitchen. (eat)", "was eating"],
      ["While Grandma was picking raspberries, Tom ___ strawberries. (eat)", "was eating"],
      ["Emily ___ me while I was buying grapes. (call)", "called"],
      ["Lucy was making a smoothie when Mark ___ home. (come)", "came"],
      ["Yesterday I ___ a pineapple at the market. (buy)", "bought"],
      ["We ___ board games at nine last night. (play)", "were playing"],
      ["Grandma ___ Kate some apples last Saturday. (give)", "gave"],
      ["While I ___ the strawberries, Tom was eating a banana. (wash)", "was washing"],
    ].map(([prompt, answer], index) => ({ id: `berries-past-${index + 1}`, prompt, answer })),
  };
  return organizeVocabularyHomework({
    kind: "INTERACTIVE_HOMEWORK_V1", title: `${BERRIES_LESSON_TITLE} — Homework`,
    intro: "Vocabulary in three separate groups, translation and personal answers. Bonus tasks are optional.",
    exercises: [...vocabulary, translation, questions, advice, past],
  }, words, { includeAllWords: true });
}

const plain = (value: string) => value.replace(/<[^>]*>/g, " ").replace(/&amp;/gi, "&").replace(/&nbsp;/gi, " ")
  .replace(/&#39;|&apos;/gi, "'").replace(/&quot;/gi, '"').replace(/\s+/g, " ").trim();

function tone(className: string): RegularLessonTone {
  if (/\bwarm\b/.test(className)) return "warm";
  if (/\bvocab\b/.test(className)) return "vocab";
  if (/\bgram\b/.test(className)) return "grammar";
  if (/\bread\b/.test(className)) return "reading";
  if (/\bdlg\b/.test(className)) return "dialogue";
  if (/teacher-note/.test(className)) return "teacher";
  return "exercise";
}

function parseSections(source: string) {
  return [...source.matchAll(/<section\b[^>]*class=["']([^"']*)["'][^>]*>([\s\S]*?)<\/section>/gi)].map(match => {
    const heading = match[2].match(/<h2[^>]*>([\s\S]*?)<\/h2>/i);
    return { className: match[1], title: plain(heading?.[1] ?? "Teacher notes"), html: heading ? match[2].replace(heading[0], "") : match[2] };
  });
}

const sectionId = (title: string, index: number) => `${String(index + 1).padStart(2, "0")}-${plain(title).toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 52) || "section"}`;
const safeHtml = (html: string) => cleanScriptHtml(addRegularLessonFocusIds(
  html.replace(/<a\b[^>]*class=["'][^"']*\bsnd\b[^"']*["'][^>]*>[\s\S]*?<\/a>/gi, ""),
));

/** Student content and teacher keys are paired, never inferred from each other. */
export function berriesLessonFromHtml(studentSource: string, teacherSource: string) {
  const student = parseSections(studentSource);
  const teacher = parseSections(teacherSource);
  if (student.length !== 9 || teacher.length !== 10 || student.some(section => tone(section.className) === "teacher")) {
    throw new Error("Berries requires nine student sections and separate teacher notes");
  }
  const sections: RegularLessonSection[] = student.map((section, index) => {
    const answer = teacher[index];
    if (answer.title !== section.title || tone(answer.className) !== tone(section.className)) {
      throw new Error(`Berries section mismatch at ${index + 1}`);
    }
    if (/class=["'][^"']*\b(?:ans|key|key-wrap)\b/i.test(section.html)) {
      throw new Error("Teacher answers found in student content");
    }
    return {
      id: sectionId(section.title, index), title: section.title, tone: tone(section.className),
      studentHtml: safeHtml(section.html), teacherHtml: safeHtml(answer.html),
      defaultOpen: tone(section.className) === "vocab",
    };
  });
  for (const note of teacher.slice(student.length)) {
    if (tone(note.className) !== "teacher") throw new Error("Unexpected student section in teacher notes");
    sections.push({ id: sectionId(note.title, sections.length), title: note.title, tone: "teacher", studentHtml: "", teacherHtml: safeHtml(note.html), defaultOpen: false, teacherOnly: true });
  }
  if (sections.filter(section => section.tone === "vocab").length !== 1 || sections.filter(section => section.tone === "dialogue").length !== 2 || sections.filter(section => section.tone === "reading").length !== 1) {
    throw new Error("Berries vocabulary, reading or dialogues missing");
  }
  const words = berriesVocabulary(sections.find(section => section.tone === "vocab")!.studentHtml);
  return {
    title: BERRIES_LESSON_TITLE,
    description: "Fruit & Berries · 11 main words + 11 helper words · should / had better · Past Continuous revision · reading, two dialogues & interactive homework.",
    sections: normalizeRegularLessonSections(sections), words, homework: [berriesHomework(words)],
  };
}
