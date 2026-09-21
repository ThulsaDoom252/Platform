import type { SeedPage } from "./types";

const ADJ = "Adjectives — Language & Attitudes";
const NOUNS = "Nouns — Wordplay & Language";
const PHRASES = "Phrases & Expressions — Фрази та вирази";

export const wordplayPage: SeedPage = {
  name: "Game of words",
  icon: "🎰",
  description:
    "Language & Wordplay — лексика про словесні ігри, мову та спілкування",
  phrases: [
    {
      section: ADJ,
      icon: "📖",
      phrase: "avid",
      transcription: "/ˈæv.ɪd/",
      translation: "завзятий / пристрасний",
      examples: [
        {
          en: "She is an avid reader of historical novels.",
          tr: "Вона — завзята читачка історичних романів.",
        },
        {
          en: "He is an avid traveller who visits a new country every year.",
          tr: "Він — пристрасний мандрівник, який щороку відвідує нову країну.",
        },
      ],
    },
    {
      section: ADJ,
      icon: "🌫️",
      phrase: "obscure",
      transcription: "/əbˈskjʊə(r)/",
      translation: "маловідомий / незрозумілий",
      examples: [
        {
          en: "The game uses several obscure English words.",
          tr: "У грі використовують кілька маловідомих англійських слів.",
        },
        {
          en: "The meaning of this old idiom is obscure.",
          tr: "Значення цієї старої ідіоми незрозуміле.",
        },
      ],
    },
    {
      section: ADJ,
      icon: "🚫",
      phrase: "sexist",
      transcription: "/ˈsek.sɪst/",
      translation: "сексистський / дискримінаційний за ознакою статі",
      examples: [
        {
          en: "The advertisement was criticized for its sexist message.",
          tr: "Рекламу розкритикували за сексистський зміст.",
        },
        {
          en: "That joke sounds sexist and offensive.",
          tr: "Цей жарт звучить сексистськи й образливо.",
        },
      ],
    },
    {
      section: ADJ,
      icon: "✅",
      phrase: "ship-shape",
      transcription: "/ˌʃɪpˈʃeɪp/",
      translation: "у повному порядку / охайний і впорядкований",
      examples: [
        {
          en: "Everything is ship-shape before the guests arrive.",
          tr: "Перед приходом гостей усе в повному порядку.",
        },
        {
          en: "She keeps her office neat and ship-shape.",
          tr: "Вона тримає свій кабінет охайним і впорядкованим.",
        },
      ],
    },
    {
      section: ADJ,
      icon: "🌍",
      phrase: "universal",
      transcription: "/ˌjuː.nɪˈvɜː.səl/",
      translation: "універсальний / загальний / властивий усім",
      examples: [
        {
          en: "The desire to play with language is universal.",
          tr: "Бажання гратися з мовою притаманне всім.",
        },
        {
          en: "Music is often called a universal language.",
          tr: "Музику часто називають універсальною мовою.",
        },
      ],
    },

    {
      section: NOUNS,
      icon: "🔤",
      phrase: "alliteration",
      transcription: "/əˌlɪt.əˈreɪ.ʃən/",
      translation: "алітерація / повторення однакових початкових звуків",
      examples: [
        {
          en: "'She sells seashells' is an example of alliteration.",
          tr: "«She sells seashells» — приклад алітерації.",
        },
        {
          en: "Alliteration can make a phrase easier to remember.",
          tr: "Алітерація може зробити фразу легшою для запам'ятовування.",
        },
      ],
    },
    {
      section: NOUNS,
      icon: "🈶",
      phrase: "character",
      transcription: "/ˈkær.ək.tə(r)/",
      translation: "символ / знак; ієрогліф",
      examples: [
        {
          en: "Each Chinese character can carry a meaning.",
          tr: "Кожен китайський ієрогліф може мати певне значення.",
        },
        {
          en: "Type the special character into the box.",
          tr: "Введіть спеціальний символ у поле.",
        },
      ],
    },
    {
      section: NOUNS,
      icon: "🏆",
      phrase: "competitiveness",
      transcription: "/kəmˈpet.ə.tɪv.nəs/",
      translation: "змагальність / схильність до суперництва",
      examples: [
        {
          en: "His competitiveness makes every game feel serious.",
          tr: "Через його схильність до суперництва кожна гра здається серйозною.",
        },
        {
          en: "A little competitiveness can motivate the team.",
          tr: "Трохи змагальності може мотивувати команду.",
        },
      ],
    },
    {
      section: NOUNS,
      icon: "🧩",
      phrase: "crossword",
      transcription: "/ˈkrɒs.wɜːd/",
      translation: "кросворд",
      examples: [
        {
          en: "I do a crossword on the train every morning.",
          tr: "Щоранку в потязі я розгадую кросворд.",
        },
        {
          en: "This crossword is based on idioms and sayings.",
          tr: "Цей кросворд побудований на ідіомах і приказках.",
        },
      ],
    },
    {
      section: NOUNS,
      icon: "💬",
      phrase: "idiom",
      transcription: "/ˈɪd.i.əm/",
      translation: "ідіома / сталий вислів",
      examples: [
        {
          en: "'Call it a day' is a common English idiom.",
          tr: "«Call it a day» — поширена англійська ідіома.",
        },
        {
          en: "This idiom cannot be translated word for word.",
          tr: "Цю ідіому не можна перекладати дослівно.",
        },
      ],
    },
    {
      section: NOUNS,
      icon: "😜",
      phrase: "pun",
      transcription: "/pʌn/",
      translation: "каламбур / гра слів",
      examples: [
        { en: "The joke is based on a pun.", tr: "Цей жарт побудований на каламбурі." },
        {
          en: "Puns are difficult to translate into another language.",
          tr: "Гру слів важко перекладати іншою мовою.",
        },
      ],
    },

    {
      section: PHRASES,
      icon: "🛑",
      phrase: "call it a day",
      translation: "закінчити на сьогодні / завершити роботу",
      examples: [
        {
          en: "We've finished the main task, so let's call it a day.",
          tr: "Ми виконали головне завдання, тож закінчімо на сьогодні.",
        },
        {
          en: "I'm tired. I think it's time to call it a day.",
          tr: "Я втомився. Думаю, час завершувати роботу.",
        },
      ],
    },
    {
      section: PHRASES,
      icon: "🗨️",
      phrase: "drop into casual conversation",
      translation: "ужити в невимушеній розмові / вставити в повсякденну розмову",
      examples: [
        {
          en: "This is not a word you would drop into casual conversation.",
          tr: "Це не те слово, яке вживатимеш у невимушеній розмові.",
        },
        {
          en: "She likes to drop literary quotes into casual conversation.",
          tr: "Вона любить вставляти літературні цитати в повсякденну розмову.",
        },
      ],
    },
    {
      section: PHRASES,
      icon: "☘️",
      phrase: "exception that proves the rule",
      translation: "виняток, що підтверджує правило",
      examples: [
        {
          en: "He is the only quiet person in the family — the exception that proves the rule.",
          tr: "Він єдина тиха людина в родині — виняток, що підтверджує правило.",
        },
        {
          en: "People call her the exception that proves the rule.",
          tr: "Її називають винятком, що підтверджує правило.",
        },
      ],
    },
    {
      section: PHRASES,
      icon: "📍",
      phrase: "here and there",
      translation: "тут і там / подекуди",
      examples: [
        {
          en: "We saw small cafés here and there along the road.",
          tr: "Уздовж дороги нам тут і там траплялися маленькі кав'ярні.",
        },
        {
          en: "There are a few mistakes here and there.",
          tr: "Подекуди є кілька помилок.",
        },
      ],
    },
    {
      section: PHRASES,
      icon: "🗣️",
      phrase: "oral tradition",
      translation: "усна традиція",
      examples: [
        {
          en: "The language has a strong oral tradition.",
          tr: "Ця мова має багату усну традицію.",
        },
        {
          en: "The stories survived through oral tradition.",
          tr: "Ці історії збереглися завдяки усній традиції.",
        },
      ],
    },
    {
      section: PHRASES,
      icon: "🌱",
      phrase: "spun off",
      translation: "переросло в / дало початок / відокремилося",
      examples: [
        {
          en: "Our chat spun off into a discussion about travel.",
          tr: "Наша розмова переросла в обговорення подорожей.",
        },
        {
          en: "The successful podcast spun off into a television series.",
          tr: "Успішний подкаст дав початок телесеріалу.",
        },
      ],
    },
    {
      section: PHRASES,
      icon: "👅",
      phrase: "tongue twister",
      translation: "скоромовка",
      examples: [
        {
          en: "We practised a Spanish tongue twister in class.",
          tr: "На уроці ми тренували іспанську скоромовку.",
        },
        {
          en: "This tongue twister is difficult to say quickly.",
          tr: "Цю скоромовку важко швидко вимовити.",
        },
      ],
    },
  ],
};
