import type { SeedPage } from "./types";

const NOUNS = "Nouns & Phrases — Іменники та фрази";
const ADJ = "Adjectives & Patterns — Прикметники та конструкції";
const IDIOMS = "Phrases & Idioms — Фрази та ідіоми";
const VERBS = "Verbs & Phrasal Verbs — Дієслова та фразові дієслова";

export const mixPage: SeedPage = {
  name: "Mix",
  icon: "🧬",
  description:
    "Useful Mixed Vocabulary — сон і місця, відпочинок та повсякденні ситуації",
  phrases: [
    {
      section: NOUNS,
      icon: "🤝",
      phrase: "bond (noun)",
      transcription: "/bɒnd/",
      translation: "зв'язок / узи; облігація",
      examples: [
        { en: "There is a strong bond between them.", tr: "Між ними існує міцний зв'язок." },
        { en: "She bought a government bond.", tr: "Вона купила державну облігацію." },
      ],
    },
    {
      section: NOUNS,
      icon: "🎪",
      phrase: "fair (noun)",
      transcription: "/feə(r)/",
      translation: "ярмарок",
      examples: [
        { en: "We bought local honey at the fair.", tr: "Ми купили місцевий мед на ярмарку." },
        {
          en: "The town holds a craft fair every year.",
          tr: "Місто щороку проводить ярмарок ремесел.",
        },
      ],
    },
    {
      section: NOUNS,
      icon: "🪦",
      phrase: "graveyards",
      transcription: "/ˈɡreɪv.jɑːdz/",
      translation: "кладовища / цвинтарі",
      examples: [
        {
          en: "The old graveyards are protected as historical sites.",
          tr: "Старі кладовища охороняють як історичні пам'ятки.",
        },
        {
          en: "We walked past two graveyards on the way to the village.",
          tr: "Дорогою до села ми пройшли повз два кладовища.",
        },
      ],
    },
    {
      section: NOUNS,
      icon: "🥽",
      phrase: "immersiveness",
      transcription: "/ɪˈmɜː.sɪv.nəs/",
      translation: "ефект занурення / імерсивність",
      examples: [
        {
          en: "The game's immersiveness makes you forget about time.",
          tr: "Ефект занурення в грі змушує забути про час.",
        },
        {
          en: "Sound design greatly improves the immersiveness of virtual reality.",
          tr: "Звуковий дизайн значно посилює ефект занурення у віртуальній реальності.",
        },
      ],
    },
    {
      section: NOUNS,
      icon: "🚁",
      phrase: "a landing zone",
      translation: "зона приземлення / посадковий майданчик",
      examples: [
        {
          en: "The helicopter approached the landing zone.",
          tr: "Гелікоптер наближався до посадкового майданчика.",
        },
        { en: "Keep the landing zone clear.", tr: "Тримайте зону приземлення вільною." },
      ],
    },
    {
      section: NOUNS,
      icon: "✏️",
      phrase: "mark (noun)",
      transcription: "/mɑːk/",
      translation: "слід / позначка / пляма; оцінка",
      examples: [
        { en: "There is a small mark on the wall.", tr: "На стіні є невеликий слід." },
        { en: "She got a high mark on the test.", tr: "Вона отримала високу оцінку за тест." },
      ],
    },
    {
      section: NOUNS,
      icon: "🌉",
      phrase: "overpass",
      transcription: "/ˈəʊ.və.pɑːs/",
      translation: "шляхопровід / естакада",
      examples: [
        {
          en: "We crossed the railway on an overpass.",
          tr: "Ми перетнули залізницю по шляхопроводу.",
        },
        {
          en: "The new overpass reduced traffic in the city centre.",
          tr: "Новий шляхопровід зменшив затори в центрі міста.",
        },
      ],
    },
    {
      section: NOUNS,
      icon: "🏝️",
      phrase: "peninsula",
      transcription: "/pəˈnɪn.sjə.lə/",
      translation: "півострів",
      examples: [
        { en: "The village is on a peninsula.", tr: "Село розташоване на півострові." },
        {
          en: "We drove along the coast of the peninsula.",
          tr: "Ми їхали вздовж узбережжя півострова.",
        },
      ],
    },
    {
      section: NOUNS,
      icon: "🏦",
      phrase: "shell companies",
      translation: "компанії-оболонки / підставні компанії",
      examples: [
        {
          en: "Criminals sometimes use shell companies to hide the origin of money.",
          tr: "Злочинці іноді використовують компанії-оболонки, щоб приховати походження грошей.",
        },
        {
          en: "The investigation revealed several shell companies.",
          tr: "Розслідування виявило кілька компаній-оболонок.",
        },
      ],
    },
    {
      section: NOUNS,
      icon: "😴",
      phrase: "sleep quality",
      translation: "якість сну",
      examples: [
        {
          en: "Regular exercise can improve your sleep quality.",
          tr: "Регулярні фізичні вправи можуть покращити якість вашого сну.",
        },
        {
          en: "Stress has a negative effect on sleep quality.",
          tr: "Стрес негативно впливає на якість сну.",
        },
      ],
    },
    {
      section: NOUNS,
      icon: "⏰",
      phrase: "sleep schedule",
      translation: "режим сну / графік сну",
      examples: [
        {
          en: "I try to keep a regular sleep schedule.",
          tr: "Я намагаюся дотримуватися регулярного режиму сну.",
        },
        {
          en: "Working night shifts changed my sleep schedule.",
          tr: "Робота в нічні зміни змінила мій режим сну.",
        },
      ],
    },
    {
      section: NOUNS,
      icon: "☕",
      phrase: "stain (noun)",
      transcription: "/steɪn/",
      translation: "пляма від забруднення / забарвлена пляма",
      examples: [
        { en: "There is a coffee stain on my shirt.", tr: "На моїй сорочці є пляма від кави." },
        { en: "This cleaner removes grease stains.", tr: "Цей засіб видаляє жирні плями." },
      ],
    },
    {
      section: NOUNS,
      icon: "⛺",
      phrase: "tent",
      transcription: "/tent/",
      translation: "намет",
      examples: [
        { en: "We put up a tent near the lake.", tr: "Ми поставили намет біля озера." },
        {
          en: "The tent kept us dry during the rain.",
          tr: "Під час дощу намет захистив нас від вологи.",
        },
      ],
    },
    {
      section: NOUNS,
      kind: "NOTE",
      phrase: "Mark vs stain",
      translation:
        "Mark — загальна назва сліду або позначки, наприклад від удару, подряпини чи олівця. Stain — пляма від речовини, яка змінює колір поверхні, наприклад від кави, вина чи жиру. Stain — різновид mark.",
    },
    {
      section: NOUNS,
      kind: "NOTE",
      phrase: "Sleep quality vs sleep schedule",
      translation:
        "Sleep quality — якість сну; sleep schedule — режим сну, тобто коли ви лягаєте спати й прокидаєтеся.",
    },
    {
      section: NOUNS,
      kind: "NOTE",
      phrase: "Immersiveness",
      translation:
        "Це здатність гри, фільму чи середовища створювати відчуття занурення. Реалістичність може цьому сприяти, але не є точним синонімом.",
    },

    {
      section: ADJ,
      icon: "⚖️",
      phrase: "fair (adjective)",
      transcription: "/feə(r)/",
      translation: "справедливий / чесний",
      examples: [
        {
          en: "The teacher was fair to all the students.",
          tr: "Учитель справедливо ставився до всіх учнів.",
        },
        { en: "Everyone deserves a fair chance.", tr: "Кожен заслуговує на рівний шанс." },
      ],
    },
    {
      section: ADJ,
      icon: "⌛",
      phrase: "less time-consuming",
      translation: "такий, що потребує менше часу / менш затратний за часом",
      examples: [
        {
          en: "This method is less time-consuming than the old one.",
          tr: "Цей метод потребує менше часу, ніж старий.",
        },
        {
          en: "We need a less time-consuming way to check the data.",
          tr: "Нам потрібен спосіб перевірки даних, який займе менше часу.",
        },
      ],
    },
    {
      section: ADJ,
      icon: "🤷",
      phrase: "not likely",
      translation: "малоймовірно; навряд чи",
      examples: [
        {
          en: "He is not likely to arrive before six.",
          tr: "Він навряд чи прийде до шостої.",
        },
        {
          en: "It is not likely that they will agree.",
          tr: "Малоймовірно, що вони погодяться.",
        },
      ],
    },
    {
      section: ADJ,
      icon: "🙄",
      phrase: "unlikely",
      transcription: "/ʌnˈlaɪ.kli/",
      translation: "малоймовірний; навряд чи",
      examples: [
        { en: "Such an outcome is unlikely.", tr: "Такий результат малоймовірний." },
        {
          en: "She is unlikely to change her mind.",
          tr: "Вона навряд чи змінить свою думку.",
        },
      ],
    },
    {
      section: ADJ,
      kind: "NOTE",
      phrase: "Unlikely vs not likely",
      translation:
        "Обидва вирази означають «малоймовірно / навряд чи». Пишемо not likely без дефіса. Конструкції: be unlikely to do something; be not likely to do something; it is unlikely that…",
    },

    {
      section: IDIOMS,
      icon: "🎁",
      phrase: "in one piece",
      translation: "цілим і неушкодженим / у цілості",
      examples: [
        {
          en: "We arrived home in one piece after the storm.",
          tr: "Після бурі ми дісталися додому цілими й неушкодженими.",
        },
        {
          en: "The package reached me in one piece.",
          tr: "Посилка дійшла до мене цілою й неушкодженою.",
        },
      ],
    },
    {
      section: IDIOMS,
      icon: "💨",
      phrase: "in vain",
      translation: "марно / даремно / безрезультатно",
      examples: [
        { en: "We waited in vain for a reply.", tr: "Ми марно чекали на відповідь." },
        {
          en: "She tried in vain to open the door.",
          tr: "Вона безрезультатно намагалася відчинити двері.",
        },
      ],
    },
    {
      section: IDIOMS,
      icon: "🎯",
      phrase: "on purpose",
      translation: "навмисно / спеціально",
      examples: [
        { en: "I didn't break the glass on purpose.", tr: "Я не навмисно розбив склянку." },
        {
          en: "She left the door open on purpose.",
          tr: "Вона навмисно залишила двері відчиненими.",
        },
      ],
    },
    {
      section: IDIOMS,
      icon: "🏳️",
      phrase: "to throw in the towel",
      translation: "здатися / визнати поразку / припинити спроби",
      examples: [
        {
          en: "After several failed attempts, he threw in the towel.",
          tr: "Після кількох невдалих спроб він здався.",
        },
        {
          en: "Don't throw in the towel just because it is difficult.",
          tr: "Не здавайся лише тому, що це складно.",
        },
      ],
    },

    {
      section: VERBS,
      icon: "👀",
      phrase: "to be aware",
      translation: "бути обізнаним / знати про / усвідомлювати",
      examples: [
        { en: "You should be aware of the risks.", tr: "Тобі варто знати про ризики." },
        {
          en: "Are you aware that the rules have changed?",
          tr: "Ти знаєш, що правила змінилися?",
        },
      ],
    },
    {
      section: VERBS,
      icon: "🔗",
      phrase: "to bond",
      transcription: "/bɒnd/",
      translation: "зближуватися / налагоджувати зв'язок; склеювати / з'єднувати",
      examples: [
        { en: "Shared experiences helped us bond.", tr: "Спільні переживання допомогли нам зблизитися." },
        { en: "This glue bonds wood and metal.", tr: "Цей клей склеює деревину та метал." },
      ],
    },
    {
      section: VERBS,
      icon: "📚",
      phrase: "to brush up on something",
      translation: "освіжити знання / повторити / удосконалити навички",
      examples: [
        {
          en: "I need to brush up on my English before the trip.",
          tr: "Мені потрібно освіжити знання англійської перед поїздкою.",
        },
        {
          en: "She brushed up on her maths before the exam.",
          tr: "Вона повторила математику перед іспитом.",
        },
      ],
    },
    {
      section: VERBS,
      icon: "🏃",
      phrase: "to catch up",
      translation: "наздогнати / надолужити; поспілкуватися після перерви",
      examples: [
        {
          en: "I missed a week of classes and need to catch up.",
          tr: "Я пропустив тиждень занять і маю надолужити пропущене.",
        },
        {
          en: "Let's meet for coffee and catch up.",
          tr: "Зустріньмося на каву й розкажімо одне одному, що нового.",
        },
      ],
    },
    {
      section: VERBS,
      icon: "🔌",
      phrase: "to consume",
      transcription: "/kənˈsjuːm/",
      translation: "споживати / поглинати / витрачати",
      examples: [
        { en: "This task consumes a lot of time.", tr: "Це завдання забирає багато часу." },
        {
          en: "The machine consumes less energy than the old model.",
          tr: "Ця машина споживає менше енергії, ніж стара модель.",
        },
      ],
    },
    {
      section: VERBS,
      icon: "🖍️",
      phrase: "to mark",
      transcription: "/mɑːk/",
      translation: "позначати / відзначати / залишати слід; оцінювати роботу",
      examples: [
        { en: "Please mark the correct answer.", tr: "Будь ласка, познач правильну відповідь." },
        { en: "The teacher marked our tests.", tr: "Учитель перевірив і оцінив наші тести." },
      ],
    },
    {
      section: VERBS,
      icon: "✖️",
      phrase: "to multiply",
      transcription: "/ˈmʌl.tɪ.plaɪ/",
      translation: "множити / примножувати / розмножуватися",
      examples: [
        { en: "Multiply six by four.", tr: "Помнож шість на чотири." },
        {
          en: "Bacteria multiply quickly in warm conditions.",
          tr: "Бактерії швидко розмножуються в теплих умовах.",
        },
      ],
    },
    {
      section: VERBS,
      icon: "🍷",
      phrase: "to stain",
      transcription: "/steɪn/",
      translation: "забруднювати / залишати плями; забарвлювати",
      examples: [
        { en: "The wine stained the tablecloth.", tr: "Вино залишило пляму на скатертині." },
        {
          en: "He stained the wood a darker colour.",
          tr: "Він пофарбував деревину в темніший колір.",
        },
      ],
    },
    {
      section: VERBS,
      icon: "🧘",
      phrase: "to unwind",
      transcription: "/ʌnˈwaɪnd/",
      translation: "розслаблятися / відпочивати / розвіюватися",
      examples: [
        {
          en: "I listen to music to unwind after work.",
          tr: "Я слухаю музику, щоб розслабитися після роботи.",
        },
        {
          en: "We spent the weekend by the sea and finally unwound.",
          tr: "Ми провели вихідні біля моря й нарешті розслабилися.",
        },
      ],
    },
    {
      section: VERBS,
      kind: "NOTE",
      phrase: "Useful patterns",
      translation:
        "Be aware of something — знати про щось; brush up on something — освіжити знання чогось; catch up with someone — наздогнати когось; catch up on work — надолужити роботу; unwind — unwound — unwound.",
    },
  ],
};
