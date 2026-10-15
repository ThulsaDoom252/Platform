import type { InteractiveHomeworkPlan } from "../lesson-homework";
import type { LessonWord } from "../lesson-unit";

export type DailyRoutinesPracticeItem = {
  prompt: string;
  answer: string;
  accepted?: string[];
  explanation: string;
};

export type DailyRoutinesPracticeGroup = {
  id: string;
  title: string;
  instruction: string;
  items: DailyRoutinesPracticeItem[];
};

type WordSeed = {
  word: string;
  translation: string;
  icon: string;
  description: string;
  note: string;
  examples: { en: string; tr: string }[];
};

/** Original meanings and examples; no unverified pronunciation is supplied. */
const wordSeeds: WordSeed[] = [
  {
    word: "to hit the snooze button", translation: "натискати кнопку відкладення будильника", icon: "⏰",
    description: "To press the control that stops an alarm briefly so that it rings again a few minutes later.",
    note: "hit тут означає натиснути, а не вдарити. hit → hit → hit. the snooze button — кнопка, яка відкладає сигнал, а не вимикає будильник назавжди.",
    examples: [
      { en: "I used to hit the snooze button three times every morning.", tr: "Раніше я щоранку тричі натискав кнопку відкладення будильника." },
      { en: "If I hit the snooze button again, I will miss the bus.", tr: "Якщо я ще раз натисну кнопку відкладення будильника, то пропущу автобус." },
    ],
  },
  {
    word: "to have a shave", translation: "голитися", icon: "🪒",
    description: "To remove hair from your face or another part of your body with a razor.",
    note: "have a shave — поширений британський варіант; shave — також правильно. have → had → had. Після be/get used to: having a shave або shaving.",
    examples: [
      { en: "My brother has a shave before he leaves home.", tr: "Мій брат голиться перед тим, як вийти з дому." },
      { en: "He is used to having a shave in the evening, not in the morning.", tr: "Він звик голитися ввечері, а не вранці." },
    ],
  },
  {
    word: "to commute", translation: "регулярно їздити на роботу або навчання й назад", icon: "🚌",
    description: "To travel regularly between your home and the place where you work or study.",
    note: "(to school, to work, etc.) commute to work/school — без the; commute by bus/train або on foot. Це регулярна дорога туди й назад, а не будь-яка подорож.",
    examples: [
      { en: "I commute by train three days a week.", tr: "Я їжджу на роботу поїздом три дні на тиждень." },
      { en: "She is getting used to commuting to college.", tr: "Вона поступово звикає їздити до коледжу." },
    ],
  },
  {
    word: "to make one's own dinner", translation: "самостійно готувати собі вечерю", icon: "🍲",
    description: "To prepare the evening meal for yourself instead of having somebody else prepare it.",
    note: "one's замінюємо на my/your/his/her/our/their: I make my own dinner. own підкреслює самостійність. make → made → made.",
    examples: [
      { en: "I make my own dinner when I get home.", tr: "Я самостійно готую собі вечерю, коли повертаюся додому." },
      { en: "They are getting used to making their own dinner.", tr: "Вони поступово звикають самостійно готувати собі вечерю." },
    ],
  },
  {
    word: "to run errands", translation: "виконувати дрібні справи поза домом", icon: "🛍️",
    description: "To go out to do small practical jobs, such as collecting a parcel or buying something you need.",
    note: "run errands — сталий вираз: бігти не обов'язково. Однина: run an errand. run → ran → run. run errands for someone — виконувати чиїсь доручення.",
    examples: [
      { en: "We run errands on Saturday mornings.", tr: "У суботу вранці ми виконуємо дрібні справи поза домом." },
      { en: "I used to run errands for my neighbour.", tr: "Раніше я виконував дрібні доручення для свого сусіда." },
    ],
  },
  {
    word: "to set one's alarm", translation: "ставити будильник на певний час", icon: "🕖",
    description: "To choose the time when a clock or phone should make a sound to wake you up.",
    note: "one's → my/your/his/her/our/their: set my alarm for seven. set → set → set. set an alarm — поставити будильник; turn it off — вимкнути його.",
    examples: [
      { en: "I always set my alarm for seven o'clock.", tr: "Я завжди ставлю будильник на сьому годину." },
      { en: "She didn't use to set her alarm at weekends.", tr: "Раніше вона не ставила будильник на вихідних." },
    ],
  },
  {
    word: "to make one's own lunch", translation: "самостійно готувати собі обід", icon: "🥪",
    description: "To prepare your midday meal yourself instead of buying it ready-made or asking somebody else to prepare it.",
    note: "one's → my/your/his/her/our/their. make my own lunch не обов'язково означає гарячу страву: це можуть бути бутерброди або салат.",
    examples: [
      { en: "I make my own lunch and take it with me.", tr: "Я самостійно готую собі обід і беру його із собою." },
      { en: "Are you used to making your own lunch every day?", tr: "Ти звик щодня самостійно готувати собі обід?" },
    ],
  },
  {
    word: "to have an early night", translation: "лягати спати рано", icon: "🌙",
    description: "To go to bed earlier than usual, often because you want more rest.",
    note: "have an early night — лягти рано; не плутай з early evening. have → had → had. Протилежна звичка: stay up late.",
    examples: [
      { en: "Let's have an early night before the trip.", tr: "Давай ляжемо спати рано перед поїздкою." },
      { en: "I am getting used to having an early night during the week.", tr: "Я поступово звикаю рано лягати спати в будні." },
    ],
  },
  {
    word: "to feed the dog", translation: "годувати собаку", icon: "🐕",
    description: "To give a dog the food it needs, often by filling its bowl at regular times.",
    note: "feed → fed → fed. feed the dog / feed my dog / feed your dog. feed the dog — дати їжу; walk the dog — вигуляти.",
    examples: [
      { en: "We feed the dog after its morning walk.", tr: "Ми годуємо собаку після ранкової прогулянки." },
      { en: "My cousin is used to feeding the dog before breakfast.", tr: "Мій двоюрідний брат звик годувати собаку перед сніданком." },
    ],
  },
  {
    word: "to chill on the sofa", translation: "розслаблятися на дивані", icon: "🛋️",
    description: "To relax on a comfortable seat without doing anything demanding.",
    note: "chill — неформальне «розслаблятися». on the sofa, не in the sofa. chill out on the sofa — також природний варіант.",
    examples: [
      { en: "After dinner, I like to chill on the sofa with a book.", tr: "Після вечері я люблю розслабитися на дивані з книжкою." },
      { en: "We used to chill on the sofa and watch films on Fridays.", tr: "Раніше щоп'ятниці ми відпочивали на дивані й дивилися фільми." },
    ],
  },
  {
    word: "to walk the dog", translation: "вигулювати собаку", icon: "🦮",
    description: "To take a dog outside for exercise and a toilet break.",
    note: "walk the dog або take the dog for a walk. walk → walked. У walk літера l не вимовляється. the dog можна замінити на my/your dog.",
    examples: [
      { en: "I walk the dog before I leave home.", tr: "Я вигулюю собаку перед тим, як вийти з дому." },
      { en: "He is getting used to walking the dog in the rain.", tr: "Він поступово звикає вигулювати собаку під дощем." },
    ],
  },
  {
    word: "to check one's messages", translation: "перевіряти свої повідомлення", icon: "💬",
    description: "To look at the texts, emails or other messages that people have sent you.",
    note: "one's → my/your/his/her/our/their: check my messages. Це перевірка саме повідомлень; check my phone — ширше: також час, погода тощо.",
    examples: [
      { en: "I check my messages after breakfast.", tr: "Я перевіряю свої повідомлення після сніданку." },
      { en: "She didn't use to check her messages before bed.", tr: "Раніше вона не перевіряла свої повідомлення перед сном." },
    ],
  },
  {
    word: "to check one's phone", translation: "перевіряти свій телефон / дивитися в телефон", icon: "📱",
    description: "To look at your mobile device to see whether there is anything new or to find information.",
    note: "one's → my/your/his/her/our/their. check my phone — подивитися повідомлення, час, сповіщення тощо; не обов'язково перевіряти технічний стан телефона.",
    examples: [
      { en: "I try not to check my phone during meals.", tr: "Я намагаюся не дивитися в телефон під час їжі." },
      { en: "Are you used to checking your phone only at set times?", tr: "Ти звик перевіряти телефон лише у визначений час?" },
    ],
  },
  {
    word: "to have a nap", translation: "подрімати / трохи поспати вдень", icon: "😴",
    description: "To sleep for a short time during the day rather than for the whole night.",
    note: "have a nap або take a nap. have → had → had. Після be/get used to: having a nap. Не те саме, що sleep in — довше спати вранці.",
    examples: [
      { en: "I sometimes have a nap after lunch.", tr: "Іноді я трохи сплю після обіду." },
      { en: "My grandfather is used to having a nap in the afternoon.", tr: "Мій дідусь звик дрімати після обіду." },
    ],
  },
  {
    word: "to stay up late", translation: "довго не лягати спати / засиджуватися допізна", icon: "🌃",
    description: "To remain awake and go to bed later than usual or later than most people.",
    note: "stay up — не лягати спати; stay up late — засиджуватися допізна. stay → stayed. be used to staying up late — бути звиклим до пізнього засинання.",
    examples: [
      { en: "We stayed up late talking last night.", tr: "Учора ми допізна не спали й розмовляли." },
      { en: "I used to stay up late, but now I go to bed at ten.", tr: "Раніше я засиджувався допізна, але тепер лягаю спати о десятій." },
    ],
  },
  {
    word: "to feed the cat", translation: "годувати кота / кішку", icon: "🐈",
    description: "To give a cat the food it needs, often by filling its bowl at regular times.",
    note: "feed → fed → fed. feed the cat / feed my cat. Не плутай food (їжа) з feed (годувати). Після be/get used to: feeding.",
    examples: [
      { en: "Can you feed the cat while I am away?", tr: "Можеш годувати кота, поки мене не буде?" },
      { en: "They are used to feeding the cat at six.", tr: "Вони звикли годувати кота о шостій." },
    ],
  },
  {
    word: "to make one's own breakfast", translation: "самостійно готувати собі сніданок", icon: "🥣",
    description: "To prepare the first meal of the day for yourself.",
    note: "one's → my/your/his/her/our/their: make my own breakfast. make → made → made. Зі звичайними назвами прийомів їжі артикль зазвичай не потрібний.",
    examples: [
      { en: "I make my own breakfast before class.", tr: "Я самостійно готую собі сніданок перед заняттям." },
      { en: "My sister is getting used to making her own breakfast.", tr: "Моя сестра поступово звикає самостійно готувати собі сніданок." },
    ],
  },
  {
    word: "to sleep in", translation: "спати довше, ніж зазвичай, уранці", icon: "🛏️",
    description: "To stay asleep later in the morning than you usually do, often because you do not need to get up early.",
    note: "sleep → slept → slept; sleeping in. sleep in часто свідомий відпочинок. oversleep зазвичай означає проспати потрібний час ненавмисно.",
    examples: [
      { en: "On Sundays, I like to sleep in until nine.", tr: "У неділю я люблю поспати довше, до дев'ятої." },
      { en: "We didn't use to sleep in when we lived on the farm.", tr: "Раніше, коли ми жили на фермі, ми не спали довго вранці." },
    ],
  },
  {
    word: "to grab a coffee", translation: "швидко взяти або випити каву", icon: "☕",
    description: "To quickly get a cup of coffee, sometimes during a short break with another person.",
    note: "Неформальний вираз: grab a coffee — швидко взяти/випити каву; не буквально «схопити». grab → grabbed; grabbing — подвоюємо b.",
    examples: [
      { en: "Let's grab a coffee before the meeting.", tr: "Давай швидко вип'ємо кави перед зустріччю." },
      { en: "I used to grab a coffee at the station every morning.", tr: "Раніше я щоранку швидко брав каву на вокзалі." },
    ],
  },
];

export const DAILY_ROUTINES_WORDS: Omit<LessonWord, "id">[] = wordSeeds.map(seed => ({
  ...seed,
  translationLang: "UK",
  category: "More daily routines",
  ipaUs: null,
  ipaUk: null,
  sectionColor: null,
  imageUrl: null,
}));

function infinitiveVariants(answer: string): string[] {
  const variants = new Set([answer.replace(/^to /, "")]);
  if (answer.includes("one's")) {
    for (const possessive of ["my", "your", "his", "her", "our", "their"]) {
      const natural = answer.replace("one's", possessive);
      variants.add(natural);
      variants.add(natural.replace(/^to /, ""));
    }
  }
  return [...variants];
}

export const DAILY_ROUTINES_GUESSING: DailyRoutinesPracticeItem[] = wordSeeds.map(seed => ({
  prompt: seed.description,
  answer: seed.word,
  accepted: [
    ...infinitiveVariants(seed.word),
    ...(seed.word === "to have a shave" ? ["to shave", "shave"] : []),
    ...(seed.word === "to chill on the sofa" ? ["to chill out on the sofa", "chill out on the sofa"] : []),
    ...(seed.word === "to have a nap" ? ["to take a nap", "take a nap"] : []),
  ],
  explanation: `${seed.word} — ${seed.translation}. ${seed.note}`,
}));

/** Every question allows an alternative when the real-life situation does not apply. */
export const DAILY_ROUTINES_PERSONAL_QUESTIONS: string[] = [
  "Do you ever hit the snooze button? If not, what helps you get up without it?",
  "If you have a shave, when does it fit into your routine? If not, which morning activity usually takes you a few minutes?",
  "Do you commute anywhere regularly? If not, how do you usually get to places you need to visit?",
  "Do you make your own dinner? If someone else usually prepares it, what would you like to learn to make?",
  "When do you prefer to run errands? If you rarely do this yourself, which small job could you help with?",
  "Do you set your alarm at the same time every day? If you do not use one, how do you know when to get up?",
  "How often do you make your own lunch? If you do not, what would be an easy lunch to prepare?",
  "When would you choose to have an early night? If you rarely do, what usually keeps you awake?",
  "If you had to feed the dog for a friend, how would you remember the feeding times? If you already do this, what is your routine?",
  "Do you like to chill on the sofa? If that is not your favourite place, where and how do you relax?",
  "If you had to walk the dog, which time of day would you choose? If you already do this, what do you enjoy or dislike about it?",
  "When do you usually check your messages? If you receive very few, when would you prefer people to contact you?",
  "In which situations do you avoid checking your phone? If you do not use a phone, think about another device.",
  "Do you ever have a nap? If not, what helps you rest during a busy day?",
  "What might make you stay up late? If you always go to bed early, what helps you keep that routine?",
  "If you had to feed the cat for a neighbour, what instructions would you ask for? If you already do this, what do you need to remember?",
  "Do you make your own breakfast? If not, what simple breakfast would you choose to prepare?",
  "When can you sleep in? If you prefer getting up early even on free days, why does that suit you?",
  "Where would you choose to grab a coffee with a friend? If you do not drink coffee, what would you order instead?",
];

export const DAILY_ROUTINES_GRAMMAR_GROUPS: DailyRoutinesPracticeGroup[] = [
  {
    id: "dr-past-habits",
    title: "Past routines: used to + infinitive",
    instruction: "Complete each gap with used to and the verb in brackets. These routines belonged to the past and are different now. In negatives and questions, use didn't use to / Did … use to. Write only the missing words.",
    items: [
      {
        prompt: "I ___ (hit) the snooze button every morning, but now I get up at the first alarm.",
        answer: "used to hit",
        explanation: "A repeated past habit which is no longer true: used to + base verb. Hit stays in its base form after to.",
      },
      {
        prompt: "When I lived with my parents, I ___ (not / make) my own dinner, but now I cook every evening.",
        answer: "didn't use to make", accepted: ["did not use to make"],
        explanation: "Didn't already marks the past, so write use, not used: didn't use to make. The habit is different now.",
      },
      {
        prompt: "___ stay up late when you were younger? (you; make a past-habit question)",
        answer: "Did you use to",
        explanation: "Question order is Did + subject + use to + base verb. The printed verb stay completes the structure.",
      },
      {
        prompt: "Before the café closed, we ___ (grab) a coffee there on Fridays. Now we meet at home.",
        answer: "used to grab",
        explanation: "The Friday visits were a repeated past routine, not a current process of adapting. Use used to grab, not used to grabbing.",
      },
      {
        prompt: "She ___ (not / sleep) in at weekends when she worked on a farm, but now she often gets up at ten.",
        answer: "didn't use to sleep", accepted: ["did not use to sleep"],
        explanation: "The negative past routine is didn't use to + base verb. The phrasal-verb particle in is already printed after the gap.",
      },
      {
        prompt: "What time ___ your alarm before you changed your timetable? (you / set; make a past-habit question)",
        answer: "did you use to set",
        explanation: "After the question phrase What time, use did you use to set. Set is the base verb; it does not take an -ing ending here.",
      },
    ],
  },
  {
    id: "dr-familiar-routines",
    title: "Already familiar: be used to + -ing",
    instruction: "Describe something already normal or familiar, not a past habit or a new learning process. Complete each gap with the present-simple form of be used to and the -ing form of the verb. Write only the missing words.",
    items: [
      {
        prompt: "The long journey feels normal now. I ___ (be used to / commute) by train.",
        answer: "am used to commuting", accepted: ["'m used to commuting"],
        explanation: "Am used to describes a familiar present situation. Here to is a preposition, so commute becomes commuting.",
      },
      {
        prompt: "Her early shift no longer feels unusual. She ___ (be used to / make) her own breakfast at five.",
        answer: "is used to making", accepted: ["'s used to making"],
        explanation: "The habit is already familiar: is used to + making. Compare she used to make, which would describe a former routine.",
      },
      {
        prompt: "___ (be / you / used to / feed) the dog every morning now, or does it still feel strange?",
        answer: "Are you used to feeding",
        explanation: "A present question about familiarity uses Are you used to + -ing. Do not add did, and do not write to feed after used to here.",
      },
      {
        prompt: "Checking my messages only once a day still feels strange. I ___ (not / be used to / check) them so rarely.",
        answer: "am not used to checking", accepted: ["'m not used to checking"],
        explanation: "Am not used to describes a lack of familiarity now. It does not mean that the speaker never checked messages in the past.",
      },
      {
        prompt: "They have looked after animals for years. They ___ (be used to / feed) the cat before they eat.",
        answer: "are used to feeding", accepted: ["'re used to feeding"],
        explanation: "Their experience means this is already normal: are used to feeding. Feed becomes feeding after the preposition to.",
      },
      {
        prompt: "My brother has done it for years, so he ___ (be used to / have) a shave every evening.",
        answer: "is used to having", accepted: ["'s used to having"],
        explanation: "This established routine feels normal to him. Use is used to having, not is used to have; have loses its final e before -ing.",
      },
    ],
  },
  {
    id: "dr-adjusting-routines",
    title: "Becoming familiar: get used to + -ing",
    instruction: "Describe the process of adapting. Use get used to with an -ing form, following the tense specified in each item. This process is different from the already familiar state described by be used to.",
    items: [
      {
        prompt: "It is still a little difficult, but I improve every week. I ___ (get used to / walk) the dog before breakfast. Use the present continuous.",
        answer: "am getting used to walking", accepted: ["'m getting used to walking"],
        explanation: "Am getting used to describes an adaptation happening now. Walking is the -ing form after to.",
      },
      {
        prompt: "You find cooking difficult now, but with practice you ___ (get used to / make) your own lunch. Use will.",
        answer: "will get used to making", accepted: ["'ll get used to making"],
        explanation: "Will get used to predicts future adaptation. Get stays in the base form after will, and make becomes making after to.",
      },
      {
        prompt: "It took Nina a month, but eventually she ___ (get used to / run) errands on her own. Use the past simple.",
        answer: "got used to running",
        explanation: "Got used to describes a completed process of adapting. Run doubles its final n in running.",
      },
      {
        prompt: "The new bedtime is still difficult for us. We ___ (not / get used to / have) an early night yet. Use the present perfect.",
        answer: "have not got used to having", accepted: ["haven't got used to having", "have not gotten used to having", "haven't gotten used to having"],
        explanation: "The adaptation has not happened up to now: have not got used to having (British English), or have not gotten used to having (American English).",
      },
      {
        prompt: "___ (you / get used to / make) your own dinner when you move away next year? Make a question with will.",
        answer: "Will you get used to making",
        explanation: "Will + subject + get used to + -ing asks about future adaptation. The question is about learning to manage the routine, not whether it was a past habit.",
      },
      {
        prompt: "He tried the late timetable for a month, but he ___ (not / get used to / stay) up late; it still felt unnatural when he stopped. Use the past simple.",
        answer: "didn't get used to staying", accepted: ["did not get used to staying"],
        explanation: "He did not adapt during that past period. After didn't, get is the base form; after used to, stay becomes staying.",
      },
    ],
  },
];

export const DAILY_ROUTINES_CREATIVE = {
  title: "A routine swap: the seven-day experiment",
  instruction: "Work alone or with your teacher. Choose an imaginary person whose timetable changes for one week. Invent a realistic before-and-after routine, then explain what becomes easier and what still feels strange. There is no single correct answer.",
  prompts: [
    "Choose the change: a new class, a new home, helping a friend with pets, or a different daily timetable. Do not use private information.",
    "Plan morning, daytime and evening using at least eight expressions from this lesson. Include rest as well as practical jobs.",
    "Write two sentences with used to / didn't use to about the person's old routine; two with be used to + -ing about familiar activities; and two with get used to + -ing about adapting.",
    "Present your experiment in about one minute. Your partner asks two practical questions; agree on one habit the person will keep after the week.",
  ],
  teacherNotes: "Accept plausible original routines. Check that used to describes the past, be used to expresses familiarity and get used to expresses adaptation. Require a base verb after used to for past habits and -ing after be/get used to. One's must become the appropriate possessive in a sentence. Give feedback on meaning and realistic detail, not only on form.",
};

/** Compact optional-to-assign review. Neutral lexical labels avoid automatic vocabulary expansion. */
export const DAILY_ROUTINES_HOMEWORK: InteractiveHomeworkPlan = {
  kind: "INTERACTIVE_HOMEWORK_V1",
  title: "More daily routines · Homework",
  intro: "A relaxed review of useful routines and used to / be used to / get used to. About 20–25 minutes, plus an optional tiny creative task. Written answers can be short. Use imaginary examples if you prefer.",
  exercises: [
    {
      id: "dr-hw-recall", title: "1 · Find the expression", kind: "definition", optional: false,
      instruction: "Read each description and write the expression from the lesson. An infinitive with or without to is accepted. Where needed, replace one's with my or your.",
      items: [
        { id: "dr-hw-recall-01", prompt: "Press the alarm control so that it rings again a few minutes later.", answer: "to hit the snooze button", accepted: ["hit the snooze button"] },
        { id: "dr-hw-recall-02", prompt: "Go out to collect a parcel, buy a few things or do other small practical jobs.", answer: "to run errands", accepted: ["run errands"] },
        { id: "dr-hw-recall-03", prompt: "Travel regularly between your home and your place of work or study.", answer: "to commute", accepted: ["commute"] },
        { id: "dr-hw-recall-04", prompt: "Remain asleep later than usual in the morning when you do not have to get up early.", answer: "to sleep in", accepted: ["sleep in"] },
      ],
    },
    {
      id: "dr-hw-context", title: "2 · Finish the routine", kind: "fill", optional: false,
      instruction: "Write only the missing expression in its base form. Use the expressions from the lesson and the possessive printed or required in the sentence.",
      items: [
        { id: "dr-hw-context-01", prompt: "I need to wake up at seven, so before bed I ___ for seven o'clock.", answer: "set my alarm" },
        { id: "dr-hw-context-02", prompt: "The dog is hungry, so before we eat I need to ___.", answer: "feed the dog", accepted: ["feed my dog", "feed our dog"] },
        { id: "dr-hw-context-03", prompt: "I am tired after lunch. I don't need a whole night's sleep; I just want to ___ for twenty minutes.", answer: "have a nap", accepted: ["take a nap"] },
        { id: "dr-hw-context-04", prompt: "I don't want to buy a meal at midday, so before I leave home I ___ and put it in a lunch box.", answer: "make my own lunch" },
      ],
    },
    {
      id: "dr-hw-grammar", title: "3 · Past habit, familiar state or adaptation?", kind: "fill", optional: false,
      instruction: "Complete each gap with the requested form of used to, be used to or get used to and the verb. Write only the missing words. Pay attention to the meaning and the stated tense.",
      items: [
        { id: "dr-hw-grammar-01", prompt: "Past habit: I ___ (stay) up late, but now I go to bed at ten. Use used to.", answer: "used to stay" },
        { id: "dr-hw-grammar-02", prompt: "Past habit, negative: I ___ (make) my own breakfast as a child, but now I do. Use didn't use to.", answer: "didn't use to make", accepted: ["did not use to make"] },
        { id: "dr-hw-grammar-03", prompt: "Past-habit question: ___ a coffee at the station when you lived there? (you / grab; use did … use to)", answer: "Did you use to grab" },
        { id: "dr-hw-grammar-04", prompt: "Already familiar: I ___ (check) my messages only after breakfast; it feels completely normal now. Use present-simple be used to.", answer: "am used to checking", accepted: ["'m used to checking"] },
        { id: "dr-hw-grammar-05", prompt: "Adapting now: she ___ (walk) the dog before breakfast. It is still new, but it gets easier each day. Use present-continuous get used to.", answer: "is getting used to walking", accepted: ["'s getting used to walking"] },
        { id: "dr-hw-grammar-06", prompt: "Future adaptation: with practice, they ___ (make) their own dinner. Use will + get used to.", answer: "will get used to making", accepted: ["'ll get used to making"] },
      ],
    },
    {
      id: "dr-hw-translate", title: "4 · Say it in English", kind: "translate", optional: false,
      instruction: "Translate into English using the lesson expressions. For 1, use used to; for 2, present-simple be used to; for 3, present-continuous get used to. In 4, use should and have an early night.",
      translationDirection: "to-english", translationLanguage: "UK",
      items: [
        { id: "dr-hw-translate-01", prompt: "Раніше я перевіряв свій телефон перед сном.", answer: "I used to check my phone before bed.", accepted: ["I used to check my phone before going to bed."] },
        { id: "dr-hw-translate-02", prompt: "Я звик годувати кота вранці.", answer: "I am used to feeding the cat in the morning.", accepted: ["I'm used to feeding the cat in the morning."] },
        { id: "dr-hw-translate-03", prompt: "Ми поступово звикаємо самостійно готувати собі обід.", answer: "We are getting used to making our own lunch.", accepted: ["We're getting used to making our own lunch.", "We are gradually getting used to making our own lunch.", "We're gradually getting used to making our own lunch."] },
        { id: "dr-hw-translate-04", prompt: "Тобі варто рано лягти спати сьогодні.", answer: "You should have an early night tonight.", accepted: ["You should have an early night today."] },
      ],
    },
    {
      id: "dr-hw-write", title: "5 · Two small changes", kind: "question-text", optional: false,
      instruction: "For 1, write three short sentences. For 2, write one question. Use an imaginary routine if you prefer. Include at least two expressions from the lesson overall.",
      items: [
        { id: "dr-hw-write-01", prompt: "Describe one past routine with used to / didn't use to, one activity that feels normal with be used to + -ing, and one new activity you are adapting to with get used to + -ing. You may use have a shave, chill on the sofa or make your own breakfast, but choose only situations that suit your example." },
        { id: "dr-hw-write-02", prompt: "Ask your teacher one original question with Did you use to …? or Are you used to …? Include one expression from the lesson, for example run errands or commute. Do not answer the question yourself." },
      ],
    },
    {
      id: "dr-hw-speak", title: "6 · A better morning", kind: "question-audio", optional: false,
      instruction: "Record one relaxed 40–60-second answer. A few clear sentences are enough; you do not need a full written script.",
      items: [
        { id: "dr-hw-speak-01", prompt: "Plan a comfortable morning for yourself or an imaginary person. Use at least four expressions from the lesson. Include something you used to do, something you are used to doing, and something you would need to get used to doing. Would you set your alarm, sleep in, grab a coffee, or make your own breakfast? Explain one choice." },
      ],
    },
    {
      id: "dr-hw-bonus", title: "7 · Bonus: swap one habit", kind: "question-text", optional: true,
      instruction: "Optional: invent a simple routine swap. Three short sentences are enough.",
      items: [
        { id: "dr-hw-bonus-01", prompt: "Imagine that two friends swap one daily habit for a week. One used to stay up late; the other used to have an early night. Say what each person is getting used to and what will probably feel normal by the end. Add any two other expressions from the lesson." },
      ],
    },
  ],
};
