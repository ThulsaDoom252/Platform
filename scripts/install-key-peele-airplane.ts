import "dotenv/config";

import { randomUUID } from "node:crypto";
import { and, asc, eq, ilike, max } from "drizzle-orm";
import { db } from "../src/lib/db";
import {
  lessonAssignments,
  lessonFolders,
  lessonUnits,
  lessonWords,
  users,
} from "../src/lib/db/schema";
import { parseLexisDocuments } from "../src/lib/keyed-parser";
import type {
  HomeworkExercise,
  HomeworkItem,
  InteractiveHomeworkPlan,
} from "../src/lib/lesson-homework";

const LESSON_TITLE = "Key & Peele — Quarrel on the Airplane";
const FOLDER_NAME = "Key & Peele";
const VIDEO_URL = "https://www.youtube.com/watch?v=kH6QJzmLYtw&end=334";

type VocabularySeed = {
  category: string;
  icon: string;
  word: string;
  ipaUs: string;
  translation: string;
  description: string;
  fillPrompt: string;
  fillAnswer?: string;
  accepted?: string[];
  note?: string;
  examples: [string, string][];
};

const vocabulary: VocabularySeed[] = [
  {
    category: "🎨 Adjectives", icon: "🤢", word: "disgusting", ipaUs: "/dɪsˈɡʌstɪŋ/",
    translation: "огидний; гидкий", description: "extremely unpleasant and making you feel sick or strong dislike",
    fillPrompt: "The smell in the cabin was absolutely ___.",
    examples: [["That food looks disgusting.", "Ця їжа виглядає огидно."], ["His behavior was disgusting.", "Його поведінка була огидною."]],
  },
  {
    category: "🎨 Adjectives", icon: "⚖️", word: "lawful", ipaUs: "/ˈlɔːfəl/",
    translation: "законний; правомірний", description: "allowed by the law",
    fillPrompt: "The officer gave a ___ order.",
    examples: [["They made a lawful request.", "Вони висунули законну вимогу."], ["The action was completely lawful.", "Ця дія була цілком законною."]],
  },
  {
    category: "🎨 Adjectives", icon: "🚫", word: "illegal", ipaUs: "/ɪˈliːɡəl/",
    translation: "незаконний", description: "not allowed by law",
    fillPrompt: "It is ___ to smoke on a plane.",
    examples: [["Parking here is illegal.", "Паркуватися тут незаконно."], ["They denied doing anything illegal.", "Вони заперечили, що робили щось незаконне."]],
  },
  {
    category: "🎨 Adjectives", icon: "✅", word: "legal", ipaUs: "/ˈliːɡəl/",
    translation: "законний; юридичний", description: "allowed by law or connected with the law",
    fillPrompt: "Is it ___ to leave your seat while the sign is on?",
    examples: [["The decision is perfectly legal.", "Це рішення цілком законне."], ["She asked for legal advice.", "Вона попросила юридичної консультації."]],
  },
  {
    category: "📦 Nouns", icon: "💺", word: "the fasten seat belt sign", ipaUs: "/ðə ˈfæsən siːt belt saɪn/",
    translation: "табло «Пристебніть ремені безпеки»", description: "the illuminated airplane notice telling passengers to remain seated with their seat belts secured",
    fillPrompt: "Please remain seated while ___ is on.",
    examples: [["The fasten seat belt sign came on.", "Загорілося табло «Пристебніть ремені безпеки»."], ["Wait until the fasten seat belt sign is off.", "Зачекайте, поки табло «Пристебніть ремені безпеки» згасне."]],
    accepted: ["fasten seat belt sign", "the seat belt sign", "seat belt sign"],
  },
  {
    category: "📦 Nouns", icon: "🪧", word: "a sign", ipaUs: "/ə saɪn/",
    translation: "знак; табло; ознака", description: "a notice, symbol, or signal that gives information or instructions",
    fillPrompt: "The illuminated ___ told everyone to stay seated.", fillAnswer: "sign",
    examples: [["The sign says No Entry.", "На знаку написано «Вхід заборонено»."], ["Dark clouds are a sign of rain.", "Темні хмари — ознака дощу."]],
    accepted: ["a sign"],
  },
  {
    category: "📦 Nouns", icon: "🤝", word: "cooperation", ipaUs: "/koʊˌɑːpəˈreɪʃən/",
    translation: "співпраця; сприяння", description: "the act of working together or doing what someone reasonably asks",
    fillPrompt: "Thank you for your ___.",
    examples: [["We appreciate your cooperation.", "Ми вдячні за ваше сприяння."], ["The project requires close cooperation.", "Проєкт потребує тісної співпраці."]],
  },
  {
    category: "📦 Nouns", icon: "📈", word: "intensity", ipaUs: "/ɪnˈtensəti/",
    translation: "інтенсивність; сила", description: "the strength, force, or extreme degree of something",
    fillPrompt: "Please lower the ___ of your voice.",
    examples: [["The intensity of the argument increased.", "Інтенсивність суперечки зросла."], ["He spoke with surprising intensity.", "Він говорив із дивовижною силою."]],
  },
  {
    category: "📦 Nouns", icon: "👅", word: "a tongue trick", ipaUs: "/ə tʌŋ trɪk/",
    translation: "трюк язиком", description: "an unusual movement or sound made with the tongue, often for fun",
    fillPrompt: "That sound was not a word; it was ___.",
    examples: [["He showed us a tongue trick.", "Він показав нам трюк язиком."], ["Can you do that tongue trick again?", "Ти можеш повторити той трюк язиком?"]],
    accepted: ["tongue trick"],
  },
  {
    category: "⚡ Verbs", icon: "🔒", word: "to fasten", ipaUs: "/tə ˈfæsən/",
    translation: "застібати; пристібати", description: "to close or secure something so that it stays firmly in place",
    fillPrompt: "Please ___ your seat belt.", fillAnswer: "fasten",
    examples: [["Fasten your seat belt before takeoff.", "Пристебніть ремінь безпеки перед зльотом."], ["She fastened the buttons on her coat.", "Вона застебнула ґудзики на пальті."]],
    accepted: ["to fasten"],
  },
  {
    category: "⚡ Verbs", icon: "🚻", word: "to piss", ipaUs: "/tə pɪs/",
    translation: "пісяти (грубо)", description: "a vulgar way to say that someone needs to urinate",
    fillPrompt: "The angry passenger said he had to ___.", fillAnswer: "piss",
    note: "Neutral: to urinate. Polite everyday alternative: to use the bathroom.",
    examples: [["He used a vulgar word and said he had to piss.", "Він ужив грубе слово й сказав, що йому треба попісяти."], ["Polite: Excuse me, I need to use the bathroom.", "Ввічливо: Вибачте, мені потрібно до вбиральні."]],
    accepted: ["to piss"],
  },
  {
    category: "⚡ Verbs", icon: "🚽", word: "to shit", ipaUs: "/tə ʃɪt/",
    translation: "какати (дуже грубо)", description: "a very vulgar way to say that someone needs to defecate",
    fillPrompt: "The passenger crudely announced that he had to ___.", fillAnswer: "shit",
    note: "Neutral/formal: to defecate or to have a bowel movement. Polite everyday alternative: to use the bathroom.",
    examples: [["The sketch uses the vulgar phrase “I have to shit.”", "У скетчі використано грубу фразу «Мені треба покакати»."], ["Polite: I really need to use the bathroom.", "Ввічливо: Мені дуже потрібно до вбиральні."]],
    accepted: ["to shit"],
  },
  {
    category: "⚡ Verbs", icon: "🔉", word: "to lower one’s voice", ipaUs: "/tə ˈloʊər wʌnz vɔɪs/",
    translation: "говорити тихіше; знизити голос", description: "to speak more quietly",
    fillPrompt: "The flight attendant asked him ___ because everyone could hear him.", fillAnswer: "to lower his voice",
    examples: [["Please lower your voice.", "Будь ласка, говоріть тихіше."], ["She lowered her voice to a whisper.", "Вона знизила голос до шепоту."]],
    accepted: ["lower your voice", "lower his voice", "lower her voice", "to lower your voice"],
  },
  {
    category: "⚡ Verbs", icon: "📣", word: "to yell", ipaUs: "/tə jel/",
    translation: "кричати; волати", description: "to speak or shout very loudly, often because you are angry or excited",
    fillPrompt: "There is no need ___ at the crew.", fillAnswer: "to yell",
    examples: [["Do not yell at me.", "Не кричи на мене."], ["He yelled for help.", "Він закричав, кличучи на допомогу."]],
    accepted: ["yell", "yelling"],
  },
  {
    category: "⚡ Verbs", icon: "😱", word: "to scream", ipaUs: "/tə skriːm/",
    translation: "верещати; голосно кричати", description: "to make a very loud, high sound because of fear, pain, anger, or excitement",
    fillPrompt: "A frightened passenger began ___.", fillAnswer: "to scream",
    examples: [["She screamed when the plane dropped.", "Вона закричала, коли літак різко знизився."], ["They were screaming at each other.", "Вони кричали одне на одного."]],
    accepted: ["scream", "screaming"],
  },
  {
    category: "⚡ Verbs", icon: "🎚️", word: "to tone something down", ipaUs: "/tə toʊn ˈsʌmθɪŋ daʊn/",
    translation: "пом’якшити; зробити менш різким або гучним", description: "to make speech, behavior, color, or an effect less strong or offensive",
    fillPrompt: "The argument is getting too aggressive; please ___.", fillAnswer: "tone it down",
    examples: [["You need to tone it down.", "Тобі треба трохи зменшити запал."], ["We toned down the language in the email.", "Ми пом’якшили формулювання в листі."]],
    accepted: ["tone something down", "to tone it down", "tone it down"],
  },
  {
    category: "⚡ Verbs", icon: "🚶", word: "to move around something", ipaUs: "/tə muːv əˈraʊnd ˈsʌmθɪŋ/",
    translation: "пересуватися чимось; ходити по чомусь", description: "to change position freely within or around a place",
    fillPrompt: "When the sign is off, passengers may ___ the cabin.", fillAnswer: "move around",
    examples: [["Feel free to move around the cabin.", "Можете вільно пересуватися салоном."], ["It was difficult to move around the crowded room.", "Було важко пересуватися переповненою кімнатою."]],
    accepted: ["to move around", "move around the cabin"],
  },
  {
    category: "💬 Phrases", icon: "↩️", word: "I’ll be right back", ipaUs: "/aɪl bi raɪt bæk/",
    translation: "я зараз повернуся", description: "used to say that you are leaving for only a very short time",
    fillPrompt: "Wait here for a moment — ___.",
    examples: [["I'll be right back, okay?", "Я зараз повернуся, гаразд?"], ["Do not leave; I'll be right back.", "Не йди; я зараз повернуся."]],
    accepted: ["I'll be right back.", "I will be right back"],
  },
  {
    category: "💬 Phrases", icon: "🙏", word: "much appreciated", ipaUs: "/mʌtʃ əˈpriːʃieɪtɪd/",
    translation: "дуже вдячний; буду дуже вдячний", description: "an informal way to say that something is or would be greatly appreciated",
    fillPrompt: "If you could remain seated, that would be ___.",
    examples: [["Your help is much appreciated.", "Ми дуже вдячні за вашу допомогу."], ["That'd be much appreciated.", "Буду дуже вдячний."]],
  },
  {
    category: "💬 Phrases", icon: "↔️", word: "against", ipaUs: "/əˈɡenst/",
    translation: "проти; всупереч", description: "opposing something, or contrary to a rule, law, or belief",
    fillPrompt: "Is it ___ the law?",
    examples: [["That is against the law.", "Це суперечить закону."], ["They voted against the proposal.", "Вони проголосували проти пропозиції."]],
  },
  {
    category: "💬 Phrases", icon: "🟢", word: "feel free to…", ipaUs: "/fiːl friː tə/",
    translation: "можете сміливо…; не соромтеся…", description: "used to give someone permission or warmly invite them to do something",
    fillPrompt: "___ ask if you have any questions.", fillAnswer: "Feel free to",
    examples: [["Feel free to move around the cabin.", "Можете вільно пересуватися салоном."], ["Feel free to call me anytime.", "Можете сміливо телефонувати мені будь-коли."]],
    accepted: ["feel free", "feel free to"],
  },
];

const lexisSource = `TYPE: LEXIS
TITLE: Spoken English and temporary behaviour
INTRO: Three patterns from the sketch: informal reductions and be in the continuous form for behavior happening now.

ITEM: going to → gonna
ICON: 🗣️
TR: збиратися → gonna в неформальному мовленні
SENSE: Gonna is the common informal spoken reduction of going to before a verb.
PATTERN: be + gonna + base verb
EX: I'm gonna go to the bathroom. | Я збираюся піти до вбиральні.
EX: We're gonna be late. | Ми запізнимося.
NOTE: Use going to in careful or formal writing. Do not say “I'm gonna the bathroom” when go is the main verb.

ITEM: want to → wanna
ICON: 💬
TR: хотіти → wanna в неформальному мовленні
SENSE: Wanna is the common informal spoken reduction of want to.
PATTERN: subject + wanna + base verb
EX: I wanna go to the bathroom. | Я хочу піти до вбиральні.
EX: What do you wanna do? | Що ти хочеш зробити?
NOTE: Use want to in careful or formal writing.

ITEM: be + continuous for temporary behaviour
ICON: ⏱️
TR: тимчасова поведінка саме зараз
SENSE: Be can appear in a continuous form when we describe how someone is behaving at the moment, not their permanent character.
PATTERN: subject + am / is / are + being + adjective
EX: You're being very difficult. | Ти зараз поводишся дуже складно.
EX: He is being unusually polite today. | Сьогодні він поводиться незвично ввічливо.
NOTE: “You are difficult” describes a more general quality. “You are being difficult” means your behavior is difficult right now.

CONTRAST: you are difficult | you are being difficult | general characteristic | temporary behavior now
TRAP: ❌ You being difficult. ✅ You are being difficult.`;

const [parsedLexis] = parseLexisDocuments(lexisSource);
if (!parsedLexis) throw new Error("Could not parse Key & Peele lexis");

const transcript = [
  { speaker: "Mark", text: "He's **disgusting**. Bernard, he's **disgusting**. He doesn't like this. He's an airplane technician. I mean, come on. That's... And he talks too much. That's why I like you. You don't talk, you just listen. It's good. Oh. Okay." },
  { speaker: "Mark", text: "And the captain has turned on **the fasten seat belt sign**. Got a little turbulence coming up, should be no problem. Just remain in your seat until **the sign** is turned off. Thank you for your **cooperation**. Okay." },
  { speaker: "The passenger", text: "Excuse me, **I'm gonna** go to the bathroom." },
  { speaker: "Mark", text: "Hi, excuse me." },
  { speaker: "The passenger", text: "Yeah?" },
  { speaker: "Mark", text: "Yeah. I'm gonna need you to take your seat. **The fasten seat belt sign** is on." },
  { speaker: "The passenger", text: "Yeah, **I'm just gonna** go to the bathroom for a second. **I'll be right back**, okay?" },
  { speaker: "Mark", text: "I understand what **you wanna** do. Unfortunately, I'm gonna need you to observe **the fasten seat belt sign**. That'd be **much appreciated**." },
  { speaker: "The passenger", text: "Right. It's just, I, I read on the internet that it's not **against** the law for me to go to the bathroom while **the fasten seat belt sign** is on, so..." },
  { speaker: "Mark", text: "**Seat belt sign** is on." },
  { speaker: "The passenger", text: "But is it **against** the law, though?" },
  { speaker: "Mark", text: "The light is on." },
  { speaker: "The passenger", text: "Is it **against** the law?" },
  { speaker: "Mark", text: "You see that there's a picture of a seat belt on that **sign**?" },
  { speaker: "The passenger", text: "I know, but is it **against** the law, though?" },
  { speaker: "Mark", text: "**The fasten seat belt sign** is on." },
  { speaker: "The passenger", text: "But is it **against** the law, though?" },
  { speaker: "Mark", text: "Sir, **seat belt sign** is on." },
  { speaker: "The passenger", text: "But is it **against** the law?" },
  { speaker: "Mark", text: "**Seat belt sign** is on." },
  { speaker: "The passenger", text: "But is it **against** the law?" },
  { speaker: "Mark", text: "**Seat belt sign**." },
  { speaker: "The passenger", text: "But is it **against** the law?" },
  { speaker: "Mark", text: "It's on." },
  { speaker: "The passenger", text: "Law." },
  { speaker: "Mark", text: "The **seat belt sign** is on." },
  { speaker: "The passenger", text: "**Lawful**." },
  { speaker: "Mark", text: "**Seat belt sign** is on." },
  { speaker: "The passenger", text: "**Lawful**." },
  { speaker: "Mark", text: "**Seat belt sign** is on. Sir, **you're being**—" },
  { speaker: "The passenger", text: "Law." },
  { speaker: "Mark", text: "... difficult. **You're being very difficult.**" },
  { speaker: "The passenger", text: "Law, law, law." },
  { speaker: "Mark", text: "Seat belt, seat belt, seat belt." },
  { speaker: "The passenger", text: "Not **illegal**, not **illegal**, not **illegal**." },
  { speaker: "Mark", text: "Okay." },
  { speaker: "The passenger", text: "**Illegal**." },
  { speaker: "Mark", text: "**Fasten** your seat—" },
  { speaker: "The passenger", text: "**Illegal**." },
  { speaker: "Mark", text: "**Fasten** your seat—" },
  { speaker: "The passenger", text: "Llllegal." },
  { speaker: "Mark", text: "Sir." },
  { speaker: "The passenger", text: "I have to **piss** and I have to **shit**—" },
  { speaker: "Mark", text: "Sir, can you **lower your voice**?" },
  { speaker: "The passenger", text: "... in the toilet." },
  { speaker: "Mark", text: "Can you **lower your voice**?" },
  { speaker: "The passenger", text: "I have to **piss** and I have to **shit**." },
  { speaker: "Mark", text: "Okay, lower your **intensity**." },
  { speaker: "The passenger", text: "You're louder than me." },
  { speaker: "Mark", text: "You're **yelling**—" },
  { speaker: "The passenger", text: "You are—" },
  { speaker: "Mark", text: "... in my face." },
  { speaker: "The passenger", text: "Sir, you're the one who I think needs to **tone it down** right now." },
  { speaker: "Mark", text: "The fasten—" },
  { speaker: "The passenger", text: "You are **screaming** at me." },
  { speaker: "Mark", text: "You're hurting my eardrums. That wasn't a word. You're not saying a word there." },
  { speaker: "The passenger", text: "This is a word." },
  { speaker: "Mark", text: "That's not—" },
  { speaker: "The passenger", text: "It's a word." },
  { speaker: "Mark", text: "That's not a word. That's **a tongue trick**. Okay, sir, sir, sir, if you would like to—" },
  { speaker: "The passenger", text: "I would not like to. I would not like to sit down. What I'd like to do is go take a **shit** in the bathroom, because it's not **against** the law. So **I'm gonna** go to the bathroom, okay? Mark with a K." },
  { speaker: "Mark", text: "And your captain has turned off **the fasten seat belt sign**. **Feel free to move around the cabin**. Thank you for your **cooperation**." },
] satisfies Array<{ speaker: string; text: string }>;

function stableHash(value: string) {
  let hash = 2166136261;
  for (const char of value) {
    hash ^= char.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function shuffled<T extends VocabularySeed>(items: readonly T[], seed: string): T[] {
  return [...items].sort((a, b) => stableHash(`${seed}:${a.word}`) - stableHash(`${seed}:${b.word}`));
}

function itemId(prefix: string, entry: VocabularySeed) {
  return `${prefix}-${vocabulary.indexOf(entry) + 1}`;
}

function acceptedFor(entry: VocabularySeed) {
  const variants = new Set(entry.accepted ?? []);
  const answer = entry.fillAnswer ?? entry.word;
  if (/^to /.test(answer)) variants.add(answer.slice(3));
  if (/^(?:a|an|the) /.test(answer)) variants.add(answer.replace(/^(?:a|an|the) /, ""));
  return [...variants];
}

function fillExercise(): HomeworkExercise {
  const entries = shuffled(vocabulary, "kp-airplane-fill-items");
  return {
    id: "kp-airplane-fill",
    title: "Vocabulary 1 — Fill in the gaps",
    instruction: "Complete each sentence with a word or phrase from the shuffled list.",
    kind: "fill",
    wordBank: shuffled(vocabulary, "kp-airplane-fill-bank").map((entry) => entry.fillAnswer ?? entry.word),
    items: entries.map((entry): HomeworkItem => ({
      id: itemId("kp-airplane-fill", entry),
      prompt: entry.fillPrompt,
      answer: entry.fillAnswer ?? entry.word,
      accepted: acceptedFor(entry),
    })),
  };
}

function definitionExercise(): HomeworkExercise {
  return {
    id: "kp-airplane-definition",
    title: "Vocabulary 2 — Guess by description",
    instruction: "Read each description and write the exact word or phrase.",
    kind: "definition",
    wordBank: shuffled(vocabulary, "kp-airplane-definition-bank").map((entry) => entry.word),
    items: shuffled(vocabulary, "kp-airplane-definition-items").map((entry): HomeworkItem => ({
      id: itemId("kp-airplane-definition", entry),
      prompt: entry.description,
      answer: entry.word,
      accepted: acceptedFor(entry),
    })),
  };
}

function describeExercise(): HomeworkExercise {
  return {
    id: "kp-airplane-describe",
    title: "Vocabulary 3 — Describe the words",
    instruction: "Explain each word or phrase in your own English and add an example.",
    kind: "describe",
    items: shuffled(vocabulary, "kp-airplane-describe-items").map((entry): HomeworkItem => ({
      id: itemId("kp-airplane-describe", entry),
      prompt: entry.word,
      word: entry.word,
    })),
  };
}

const translationItems: HomeworkItem[] = [
  ...shuffled(vocabulary, "kp-airplane-translation-vocab").map((entry) => ({
    id: `kp-airplane-translate-${vocabulary.indexOf(entry) + 1}`,
    prompt: entry.translation,
    answer: entry.word,
    accepted: acceptedFor(entry),
  })),
  {
    id: "kp-airplane-translate-lexis-1",
    prompt: "Я збираюся піти до вбиральні. (informal spoken English)",
    answer: "I'm gonna go to the bathroom.",
    accepted: ["I am gonna go to the bathroom", "I'm going to go to the bathroom"],
  },
  {
    id: "kp-airplane-translate-lexis-2",
    prompt: "Я хочу піти до вбиральні. (informal spoken English)",
    answer: "I wanna go to the bathroom.",
    accepted: ["I want to go to the bathroom"],
  },
  {
    id: "kp-airplane-translate-lexis-3",
    prompt: "Ти зараз поводишся дуже складно.",
    answer: "You're being very difficult.",
    accepted: ["You are being very difficult"],
  },
];

const homework: InteractiveHomeworkPlan = {
  kind: "INTERACTIVE_HOMEWORK_V1",
  title: "Key & Peele — Quarrel on the Airplane — Homework",
  intro: "Complete all vocabulary formats, translate the vocabulary and lexis, and answer the discussion questions in writing.",
  exercises: [
    fillExercise(),
    definitionExercise(),
    describeExercise(),
    {
      id: "kp-airplane-translation",
      title: "Translation — Vocabulary and lexis",
      instruction: "Translate each item into English. Use the vocabulary and spoken patterns from the lesson.",
      kind: "translate",
      translationDirection: "to-english",
      translationLanguage: "UK",
      items: translationItems,
    },
    {
      id: "kp-airplane-questions",
      title: "Questions — Written answers",
      instruction: "Answer in complete sentences and explain your opinion.",
      kind: "question-text",
      items: [
        {
          id: "kp-airplane-question-1",
          prompt: "What would you do if you had to go to the bathroom while the fasten seat belt sign was on?",
        },
        {
          id: "kp-airplane-question-2",
          prompt: "Is it acceptable for airline staff to argue with passengers without a lawful reason? Why or why not?",
        },
        {
          id: "kp-airplane-question-3",
          prompt: "Have you ever experienced turbulence? Why can it be dangerous?",
        },
      ],
    },
  ],
};

function validateContent() {
  if (vocabulary.length !== 21) throw new Error(`Expected 21 vocabulary entries, got ${vocabulary.length}`);
  if (new Set(vocabulary.map((entry) => entry.word.toLowerCase())).size !== vocabulary.length) {
    throw new Error("Vocabulary contains duplicate headwords");
  }
  for (const line of transcript) {
    const markers = line.text.match(/\*\*/g)?.length ?? 0;
    if (markers % 2 !== 0) throw new Error(`Broken transcript highlight in: ${line.text.slice(0, 80)}`);
  }
  if (homework.exercises.length !== 5) throw new Error("Homework plan is incomplete");
}

async function main() {
  validateContent();

  const [author] = await db
    .select({ id: users.id, name: users.name })
    .from(users)
    .where(eq(users.role, "TEACHER"))
    .orderBy(asc(users.createdAt))
    .limit(1);
  if (!author) throw new Error("No teacher account found");

  let [folder] = await db
    .select({ id: lessonFolders.id })
    .from(lessonFolders)
    .where(and(eq(lessonFolders.authorId, author.id), ilike(lessonFolders.name, FOLDER_NAME)))
    .limit(1);
  if (!folder) {
    [folder] = await db
      .insert(lessonFolders)
      .values({ authorId: author.id, name: FOLDER_NAME })
      .returning({ id: lessonFolders.id });
  }
  if (!folder) throw new Error("Could not find or create the lesson folder");

  const [existing] = await db
    .select({ id: lessonUnits.id, sortOrder: lessonUnits.sortOrder })
    .from(lessonUnits)
    .where(and(eq(lessonUnits.authorId, author.id), ilike(lessonUnits.title, LESSON_TITLE)))
    .limit(1);
  const [lastOrder] = await db
    .select({ value: max(lessonUnits.sortOrder) })
    .from(lessonUnits)
    .where(and(eq(lessonUnits.authorId, author.id), eq(lessonUnits.folderId, folder.id)));
  const sortOrder = existing?.sortOrder ?? Number(lastOrder?.value ?? 0) + 10;

  const unitValues = {
    kind: "ACTIVITY" as const,
    title: LESSON_TITLE,
    description: "Comedy sketch activity · airplane rules, arguments and spoken English · video through 5:34",
    folderId: folder.id,
    sortOrder,
    vocabNodeId: null,
    lexis: [{
      id: "kp-airplane-lexis",
      source: lexisSource,
      title: parsedLexis.title || "Spoken English and temporary behaviour",
      intro: parsedLexis.subtitle || null,
      blocks: parsedLexis.blocks,
      warnings: parsedLexis.warnings,
      sourceNodeId: null,
    }],
    videoUrl: VIDEO_URL,
    videoTitle: "Key & Peele · Airplane argument · through 5:34",
    transcript,
    questions: {
      afterVideo: [
        "What is the flight attendant’s name?",
        "Why did they start arguing in the first place?",
        "True or false: It is against the law to go to the bathroom while the fasten seat belt sign is on.",
        "Who was yelling at whom?",
        "Did the passenger eventually complete his mission successfully?",
        "Why was he wet from head to toe after leaving the bathroom?",
        "What happened after he finally managed to fasten his seat belt?",
      ],
      afterReading: [],
    },
    homework: [homework],
    activityIds: [],
    sections: [],
    updatedAt: new Date(),
  };

  const unitId = await db.transaction(async (tx) => {
    const id = existing?.id
      ? (await tx
          .update(lessonUnits)
          .set(unitValues)
          .where(eq(lessonUnits.id, existing.id))
          .returning({ id: lessonUnits.id }))[0]?.id
      : (await tx
          .insert(lessonUnits)
          .values({ id: randomUUID(), authorId: author.id, ...unitValues })
          .returning({ id: lessonUnits.id }))[0]?.id;
    if (!id) throw new Error("Could not save Key & Peele lesson");

    await tx.delete(lessonWords).where(eq(lessonWords.unitId, id));
    await tx.insert(lessonWords).values(vocabulary.map((entry, index) => ({
      id: randomUUID(),
      unitId: id,
      category: entry.category,
      icon: entry.icon,
      word: entry.word,
      ipaUs: entry.ipaUs,
      ipaUk: null,
      translation: entry.translation,
      description: entry.description,
      note: entry.note ?? null,
      examples: entry.examples.map(([en, tr]) => ({ en, tr })),
      sectionColor: null,
      imageUrl: null,
      sortOrder: index + 1,
    })));

    const assignments = await tx
      .select({ id: lessonAssignments.id })
      .from(lessonAssignments)
      .where(eq(lessonAssignments.unitId, id));
    for (const assignment of assignments) {
      await tx
        .update(lessonAssignments)
        .set({ updatedAt: new Date() })
        .where(eq(lessonAssignments.id, assignment.id));
    }
    return id;
  });

  console.log(JSON.stringify({
    id: unitId,
    title: LESSON_TITLE,
    folder: FOLDER_NAME,
    author: author.name,
    words: vocabulary.length,
    lexisItems: parsedLexis.blocks.filter((block) => block.type === "word").length,
    transcriptLines: transcript.length,
    questions: unitValues.questions.afterVideo.length,
    video: VIDEO_URL,
    homeworkExercises: homework.exercises.length,
    homeworkItems: homework.exercises.reduce((total, exercise) => total + exercise.items.length, 0),
  }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
