import type { LessonWord, TranscriptLine } from "../lesson-unit";

export const WALT_MEETS_GUS_TITLE = "Walt meets Gus";
export const BREAKING_BAD_FOLDER = "Breaking Bad";
export const WALT_MEETS_GUS_VIDEO_URL = "https://www.youtube.com/watch?v=L6G0VxscwqE";
export const WALT_MEETS_GUS_VIDEO_TITLE = "Walter White Meets Gustavo Fring | Mandala | Breaking Bad";
export const WALT_MEETS_GUS_DESCRIPTION =
  "Breaking Bad · Walt and Gustavo discuss trust, judgment and a possible business deal.";

export const WALT_MEETS_GUS_SPEAKERS = {
  0: "Gustavo",
  1: "Walter White",
} as const;

type VocabularySeed = {
  word: string;
  category: string;
  icon: string;
  ipaUs?: string;
  translation: string;
  description: string;
  note: string;
  examples: { en: string; tr: string }[];
  /** The actual, sometimes inflected wording in the supplied dialogue. */
  dialogueForms: string[];
};

export const WALT_MEETS_GUS_VOCABULARY = [
  {
    word: "Can I help you?", category: "Phrases", icon: "🙋",
    translation: "Чим можу вам допомогти?",
    description: "A polite question used to offer help or serve a customer.",
    note: "Звичайна фраза працівника закладу. May I help you? — ще формальніший варіант.",
    examples: [
      { en: "Can I help you find a table?", tr: "Можу допомогти вам знайти столик?" },
      { en: "Can I help you, sir?", tr: "Чим можу вам допомогти, сер?" },
    ],
    dialogueForms: ["Can I help you"],
  },
  {
    word: "Coke", category: "Nouns", icon: "🥤", ipaUs: "/koʊk/",
    translation: "кока-кола",
    description: "An informal name for Coca-Cola, a fizzy soft drink.",
    note: "Назва напою пишеться з великої літери: Coke. Diet Coke — дієтична кока-кола. У цьому діалозі йдеться про напій, не про наркотик.",
    examples: [
      { en: "I'd like a Coke, please.", tr: "Я хотів би кока-колу, будь ласка." },
      { en: "She ordered a Diet Coke.", tr: "Вона замовила дієтичну кока-колу." },
    ],
    dialogueForms: ["Coke"],
  },
  {
    word: "Have a seat.", category: "Phrases", icon: "🪑",
    translation: "Сідайте. / Присядьте.",
    description: "A polite invitation to sit down.",
    note: "Have a seat / Take a seat — ввічливе запрошення сісти. Sit down може звучати як наказ.",
    examples: [
      { en: "Please have a seat while you wait.", tr: "Будь ласка, присядьте, поки чекаєте." },
      { en: "Have a seat. We need to talk.", tr: "Сідайте. Нам потрібно поговорити." },
    ],
    dialogueForms: ["Have a seat"],
  },
  {
    word: "I'm not following.", category: "Phrases", icon: "🤔",
    translation: "Я не розумію, про що ви. / Я не вловлюю думку.",
    description: "Used to say that you do not understand what someone means.",
    note: "follow тут — розуміти хід думки, а не йти слідом. I don't follow — також природний варіант.",
    examples: [
      { en: "I'm not following. Could you explain that again?", tr: "Я не розумію. Можете пояснити це ще раз?" },
      { en: "Sorry, I'm not following your argument.", tr: "Вибачте, я не розумію вашу аргументацію." },
    ],
    dialogueForms: ["I'm not following"],
  },
  {
    word: "You're confusing me with someone else.", category: "Phrases", icon: "👥",
    translation: "Ви плутаєте мене з кимось іншим.",
    description: "Used when someone thinks you are a different person.",
    note: "Звичайна конструкція: confuse A with B. У вихідному діалозі Gustavo каже confusing me for someone else — цю репліку збережено дослівно. Інший природний варіант: You're mistaking me for someone else.",
    examples: [
      { en: "You're confusing me with someone else. I don't work here.", tr: "Ви плутаєте мене з кимось іншим. Я тут не працюю." },
      { en: "People often confuse me with my brother.", tr: "Люди часто плутають мене з моїм братом." },
    ],
    dialogueForms: ["you're confusing me for someone else"],
  },
  {
    word: "a complaint", category: "Nouns", icon: "📣", ipaUs: "/kəmˈpleɪnt/",
    translation: "скарга",
    description: "A statement that something is wrong or that you are unhappy with something.",
    note: "make a complaint / submit a complaint — поскаржитися / подати скаргу. complain — дієслово, complaint — іменник.",
    examples: [
      { en: "The customer made a complaint about the service.", tr: "Клієнт поскаржився на обслуговування." },
      { en: "We received a complaint yesterday.", tr: "Ми отримали скаргу вчора." },
    ],
    dialogueForms: ["complaint"],
  },
  {
    word: "to submit", category: "Verbs", icon: "📨", ipaUs: "/səbˈmɪt/",
    translation: "подавати; надсилати на розгляд",
    description: "To formally send a document, application or complaint for someone to consider.",
    note: "submit a complaint / an application / a report. submit → submitted → submitted; submitting: подвоюємо t.",
    examples: [
      { en: "Please submit your application by Friday.", tr: "Будь ласка, подайте заяву до п'ятниці." },
      { en: "He submitted a complaint to the manager.", tr: "Він подав скаргу менеджеру." },
    ],
    dialogueForms: ["submit"],
  },
  {
    word: "to submit something through an email system", category: "Phrases", icon: "📧",
    translation: "подати щось через систему електронної пошти",
    description: "To send something for consideration using an email system.",
    note: "through — через, though — хоча. У репліці: submit it through our email system. Коротший варіант: submit something by email.",
    examples: [
      { en: "You can submit your complaint through our email system.", tr: "Ви можете подати скаргу через нашу систему електронної пошти." },
      { en: "Please submit the form by email.", tr: "Будь ласка, надішліть форму електронною поштою." },
    ],
    dialogueForms: ["submit it through our email system"],
  },
  {
    word: "to be alike", category: "Phrases", icon: "🪞", ipaUs: "/əˈlaɪk/",
    translation: "бути схожими",
    description: "To be similar to each other.",
    note: "alike зазвичай стоїть після дієслова: We are alike / They look alike. Перед іменником: similar people, не alike people.",
    examples: [
      { en: "We are alike in many ways.", tr: "Ми схожі в багатьох відношеннях." },
      { en: "The two brothers look alike.", tr: "Два брати схожі зовні." },
    ],
    dialogueForms: ["we're alike"],
  },
  {
    word: "cautious", category: "Adjectives", icon: "⚠️", ipaUs: "/ˈkɔʃəs/",
    translation: "обережний; обачний",
    description: "Careful to avoid danger, problems or mistakes.",
    note: "cautious about something / cautious about doing something. a cautious person — обачна людина.",
    examples: [
      { en: "She's cautious about trusting strangers.", tr: "Вона обережно ставиться до того, щоб довіряти незнайомцям." },
      { en: "He is a cautious driver.", tr: "Він обережний водій." },
    ],
    dialogueForms: ["cautious"],
  },
  {
    word: "to be high", category: "Slang", icon: "😵",
    translation: "бути під дією наркотиків",
    description: "To be affected by a drug that changes how you feel or behave.",
    note: "У цій сцені high означає під дією наркотиків, а не високий. be high — стан; get high — вживати наркотики / переходити в такий стан.",
    examples: [
      { en: "He was high and couldn't think clearly.", tr: "Він був під дією наркотиків і не міг ясно мислити." },
      { en: "She refused to get in the car because the driver was high.", tr: "Вона відмовилася сідати в машину, бо водій був під дією наркотиків." },
    ],
    dialogueForms: ["was high", "He's high"],
  },
  {
    word: "to have poor judgment", category: "Phrases", icon: "⚖️",
    translation: "бути нерозсудливим; погано оцінювати ситуацію",
    description: "To make unwise decisions because you do not assess a situation well.",
    note: "judgment — звичайне американське написання; judgement — також вживане британське. have/show poor judgment — діяти нерозсудливо. Judgment тут — розсудливість, а не судовий вирок.",
    examples: [
      { en: "He showed poor judgment by trusting an unreliable partner.", tr: "Він виявив нерозсудливість, довірившись ненадійному партнеру." },
      { en: "You have poor judgment if you ignore every warning.", tr: "Ви дієте нерозсудливо, якщо ігноруєте всі застереження." },
    ],
    dialogueForms: ["have poor judgment", "poor judgment"],
  },
  {
    word: "impeccable", category: "Adjectives", icon: "✨", ipaUs: "/ɪmˈpekəbəl/",
    translation: "бездоганний",
    description: "So good or perfect that it has no faults.",
    note: "Написання: impeccable. impeccable quality / manners / taste. Слово підкреслює відсутність недоліків.",
    examples: [
      { en: "The hotel offered impeccable service.", tr: "Готель пропонував бездоганне обслуговування." },
      { en: "Her work was impeccable.", tr: "Її робота була бездоганною." },
    ],
    dialogueForms: ["impeccable"],
  },
  {
    word: "That is not the only factor.", category: "Phrases", icon: "🧩",
    translation: "Це не єдиний чинник.",
    description: "Used to say that other things also affect a decision or result.",
    note: "factor — чинник, не vector — вектор. That's not the only factor — скорочений варіант. Важлива не лише якість: Gustavo також оцінює надійність партнера.",
    examples: [
      { en: "Price is important, but it is not the only factor.", tr: "Ціна важлива, але це не єдиний чинник." },
      { en: "Experience is not the only factor in our decision.", tr: "Досвід — не єдиний чинник у нашому рішенні." },
    ],
    dialogueForms: ["That is not the only factor"],
  },
  {
    word: "hands down", category: "Idioms", icon: "🏆",
    translation: "без сумніву; беззаперечно; з легкістю",
    description: "Without any doubt; also used when someone wins very easily.",
    note: "У цій репліці: customers would pay it, hands down — клієнти без сумніву заплатили б. win hands down — перемогти з легкістю. Без дефіса як прислівниковий вираз.",
    examples: [
      { en: "This is hands down the best meal I've had all week.", tr: "Це беззаперечно найкраща страва, яку я куштував цього тижня." },
      { en: "Their team won hands down.", tr: "Їхня команда перемогла з легкістю." },
    ],
    dialogueForms: ["hands down"],
  },
  {
    word: "on somebody's end", category: "Phrases", icon: "🤝",
    translation: "з чийогось боку; у чиїйсь частині справи",
    description: "In the part of a situation or arrangement that a particular person is responsible for.",
    note: "on my end / on your end / on their end. У діалозі Walter говорить про партнерів зі свого боку угоди. somebody замінюємо потрібним займенником.",
    examples: [
      { en: "Everything is ready on my end.", tr: "З мого боку все готово." },
      { en: "Is there a problem on your end?", tr: "З вашого боку є проблема?" },
    ],
    dialogueForms: ["on my end"],
  },
  {
    word: "to interact with somebody", category: "Verbs", icon: "💬", ipaUs: "/ˌɪntərˈækt/",
    translation: "взаємодіяти; спілкуватися з кимось",
    description: "To communicate with or respond to another person.",
    note: "interact with somebody / something: потрібен with, коли називаємо співрозмовника. interaction — взаємодія.",
    examples: [
      { en: "You won't need to interact with him.", tr: "Вам не потрібно буде з ним взаємодіяти." },
      { en: "The job involves interacting with customers.", tr: "Робота передбачає спілкування з клієнтами." },
    ],
    dialogueForms: ["interact with him"],
  },
  {
    word: "at a moment's notice", category: "Idioms", icon: "⏱️",
    translation: "будь-якої миті; негайно, щойно знадобиться",
    description: "Immediately or with very little advance warning.",
    note: "Сталий вираз: at a moment's notice, не at the moment's notice. Апостроф у moment's. Також at short notice — за короткий термін попередження.",
    examples: [
      { en: "We can leave at a moment's notice.", tr: "Ми можемо вирушити будь-якої миті." },
      { en: "The team is ready to help at a moment's notice.", tr: "Команда готова негайно допомогти, щойно знадобиться." },
    ],
    dialogueForms: ["at a moment's notice"],
  },
  {
    word: "a drug addict", category: "Nouns", icon: "🚫", ipaUs: "/ˈdrʌɡ ˌædɪkt/",
    translation: "наркозалежна людина",
    description: "A person who is addicted to drugs and finds it very difficult to stop using them.",
    note: "a drug addict — іменник із діалогу. Нейтральніше про людину: a person with a drug addiction. be addicted to something — бути залежним від чогось.",
    examples: [
      { en: "The charity supports people with a drug addiction.", tr: "Благодійна організація підтримує людей із наркотичною залежністю." },
      { en: "He described his former partner as a drug addict.", tr: "Він назвав свого колишнього партнера наркозалежною людиною." },
    ],
    dialogueForms: ["a drug addict"],
  },
] satisfies VocabularySeed[];

export function waltMeetsGusVocabulary(): Omit<LessonWord, "id">[] {
  return WALT_MEETS_GUS_VOCABULARY.map((entry) => ({
    category: entry.category,
    icon: entry.icon,
    word: entry.word,
    ipaUs: entry.ipaUs ?? null,
    ipaUk: null,
    translation: entry.translation,
    description: entry.description,
    note: entry.note,
    examples: entry.examples.map((example) => ({ ...example })),
    sectionColor: null,
    imageUrl: null,
  }));
}

/** Source wording is unchanged; only vocabulary bold markers are added. */
export const WALT_MEETS_GUS_TRANSCRIPT: TranscriptLine[] = [
  { speaker: "Gustavo", text: "**Can I help you**, sir?" },
  { speaker: "Walter White", text: "Diet **Coke**, please." },
  { speaker: "Walter White", text: "And five minutes of your time." },
  { speaker: "Gustavo", text: "What can I do for you?" },
  { speaker: "Walter White", text: "**Have a seat**." },
  { speaker: "Walter White", text: "Please." },
  { speaker: "Walter White", text: "I would like to know why you wouldn't meet with me yesterday." },
  { speaker: "Gustavo", text: "I'm sorry, **I'm not following**." },
  { speaker: "Walter White", text: "I sat here yesterday waiting to meet with someone." },
  { speaker: "Walter White", text: "I believe that person was you." },
  { speaker: "Gustavo", text: "I think that **you're confusing me for someone else**." },
  { speaker: "Walter White", text: "I don't think I am." },
  { speaker: "Gustavo", text: "Sir, if you have a **complaint**, I suggest you **submit it through our email system**. I would be happy to refer you to our website." },
  { speaker: "Walter White", text: "I was told that the man I would be meeting with is very careful," },
  { speaker: "Walter White", text: "a **cautious** man." },
  { speaker: "Walter White", text: "I believe **we're alike** in that way." },
  { speaker: "Walter White", text: "If you are who I think you are," },
  { speaker: "Walter White", text: "you should give me another chance." },
  { speaker: "Gustavo", text: "I don't think **we're alike** at all, Mr. White." },
  { speaker: "Gustavo", text: "You are not a **cautious** man at all. Your partner was late, and he **was high**." },
  { speaker: "Walter White", text: "Yes." },
  { speaker: "Walter White", text: "Yes, he was." },
  { speaker: "Gustavo", text: "**He's high** often, isn't he?" },
  { speaker: "Gustavo", text: "You **have poor judgment**." },
  { speaker: "Gustavo", text: "I can't work with someone with **poor judgment**." },
  { speaker: "Walter White", text: "Are you familiar with my product?" },
  { speaker: "Gustavo", text: "I've been told it's excellent." },
  { speaker: "Walter White", text: "It is **impeccable**." },
  { speaker: "Walter White", text: "It is the purest, most chemically sound product on the market anywhere." },
  { speaker: "Gustavo", text: "**That is not the only factor**." },
  { speaker: "Walter White", text: "You could charge twice the current rate for what I provide, and your customers would pay it," },
  { speaker: "Walter White", text: "**hands down**." },
  { speaker: "Walter White", text: "Now, who I choose to do business with **on my end**" },
  { speaker: "Walter White", text: "is not your problem." },
  { speaker: "Walter White", text: "You won't see him. You won't **interact with him**." },
  { speaker: "Walter White", text: "Forget he exists." },
  { speaker: "Gustavo", text: "I have to ask," },
  { speaker: "Gustavo", text: "why? Why him?" },
  { speaker: "Walter White", text: "Because he does what I say." },
  { speaker: "Walter White", text: "Because I can trust him." },
  { speaker: "Gustavo", text: "How much product do you have on hand?" },
  { speaker: "Walter White", text: "Thirty-eight pounds," },
  { speaker: "Walter White", text: "ready to go **at a moment's notice**." },
  { speaker: "Walter White", text: "W- will I hear from you?" },
  { speaker: "Gustavo", text: "I have your numbers." },
  { speaker: "Gustavo", text: "You can never trust **a drug addict**." },
];

export const WALT_MEETS_GUS_QUESTIONS = [
  "Why did Walt want five minutes of Gus's time?",
  "What were they talking about?",
  "Why didn't Gus want to work with Walter?",
  "Did they reach a deal by the end of the conversation?",
];

/** Read only the supplied timed Speaker 0/1 format; reject missing/unknown lines. */
export function parseWaltMeetsGusSource(source: string): TranscriptLine[] {
  const blocks = source.replace(/^\uFEFF/, "").trim().split(/\r?\n\s*\r?\n/);
  return blocks.map((block, index) => {
    const [header, ...textLines] = block.split(/\r?\n/);
    const match = header.match(/^\d{2}:\d{2}:\d{2},\d{3}\s+-->\s+\d{2}:\d{2}:\d{2},\d{3}\s+\[Speaker ([01])\]\s*$/);
    const text = textLines.map((line) => line.trim()).join(" ").trim();
    if (!match || !text) throw new Error(`Invalid transcript block ${index + 1}`);
    return { speaker: WALT_MEETS_GUS_SPEAKERS[Number(match[1]) as 0 | 1], text };
  });
}

export function validateWaltMeetsGusSource(source: string): void {
  const parsed = parseWaltMeetsGusSource(source);
  if (parsed.length !== WALT_MEETS_GUS_TRANSCRIPT.length) {
    throw new Error(`Expected ${WALT_MEETS_GUS_TRANSCRIPT.length} source lines, found ${parsed.length}`);
  }
  for (const [index, line] of WALT_MEETS_GUS_TRANSCRIPT.entries()) {
    if (line.speaker !== parsed[index].speaker || line.text.replace(/\*\*/g, "") !== parsed[index].text) {
      throw new Error(`Source wording or speaker differs at line ${index + 1}`);
    }
  }
}
