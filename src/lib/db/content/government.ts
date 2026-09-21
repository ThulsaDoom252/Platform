import type { SeedPage } from "./types";

const NOUNS = "Nouns & Phrases — Society, History & Public Policy";
const ADJ = "Adjectives & Participles — Conditions & Description";
const ADV = "Adverbs — Effects & Consequences";

export const governmentPage: SeedPage = {
  name: "Government & economics",
  icon: "🏛️",
  description:
    "Society, Government & Economy — лексика про соціальну політику, інституції та історичні зміни",
  phrases: [
    {
      section: NOUNS,
      icon: "🕯️",
      phrase: "commemorations",
      transcription: "/kəˌmem.əˈreɪ.ʃənz/",
      translation: "пам'ятні заходи / урочистості на вшанування",
      examples: [
        {
          en: "The city held commemorations for the victims of the war.",
          tr: "У місті провели пам'ятні заходи на честь жертв війни.",
        },
        {
          en: "Thousands attended the anniversary commemorations.",
          tr: "Тисячі людей відвідали ювілейні пам'ятні заходи.",
        },
      ],
    },
    {
      section: NOUNS,
      icon: "✂️",
      phrase: "cuts to public spending",
      translation: "скорочення державних видатків",
      examples: [
        {
          en: "The government announced cuts to public spending.",
          tr: "Уряд оголосив про скорочення державних видатків.",
        },
        {
          en: "Cuts to public spending affected local services.",
          tr: "Скорочення державних видатків позначилося на місцевих послугах.",
        },
      ],
    },
    {
      section: NOUNS,
      icon: "📉",
      phrase: "financial devastation",
      translation: "фінансове спустошення / нищівні фінансові наслідки",
      examples: [
        {
          en: "The crisis caused financial devastation across the region.",
          tr: "Криза спричинила фінансове спустошення в усьому регіоні.",
        },
        {
          en: "Many families faced financial devastation after the factory closed.",
          tr: "Після закриття фабрики багато родин зазнали нищівних фінансових наслідків.",
        },
      ],
    },
    {
      section: NOUNS,
      icon: "🌐",
      phrase: "international institutions",
      translation: "міжнародні установи / міжнародні інституції",
      examples: [
        {
          en: "International institutions provided emergency funding.",
          tr: "Міжнародні інституції надали екстрене фінансування.",
        },
        {
          en: "The country works closely with international institutions.",
          tr: "Країна тісно співпрацює з міжнародними установами.",
        },
      ],
    },
    {
      section: NOUNS,
      icon: "🔗",
      phrase: "joined-up systems",
      translation: "узгоджені / взаємопов'язані системи",
      examples: [
        {
          en: "Joined-up systems allow agencies to share information.",
          tr: "Взаємопов'язані системи дають установам змогу обмінюватися інформацією.",
        },
        {
          en: "The reform aims to create joined-up systems for health and social care.",
          tr: "Реформа має на меті створити узгоджені системи охорони здоров'я та соціальної допомоги.",
        },
      ],
    },
    {
      section: NOUNS,
      icon: "🏢",
      phrase: "modernist architecture",
      translation: "модерністська архітектура",
      examples: [
        {
          en: "The city is known for its modernist architecture.",
          tr: "Місто відоме своєю модерністською архітектурою.",
        },
        {
          en: "They are restoring a landmark of modernist architecture.",
          tr: "Вони реставрують пам'ятку модерністської архітектури.",
        },
      ],
    },
    {
      section: NOUNS,
      icon: "✊",
      phrase: "resistance movement",
      translation: "рух опору",
      examples: [
        {
          en: "She played an important role in the resistance movement.",
          tr: "Вона відігравала важливу роль у русі опору.",
        },
        {
          en: "The resistance movement grew during the occupation.",
          tr: "Під час окупації рух опору посилився.",
        },
      ],
    },
    {
      section: NOUNS,
      icon: "🏛️",
      phrase: "state intervention",
      translation: "державне втручання",
      examples: [
        {
          en: "The recession led to greater state intervention in the economy.",
          tr: "Рецесія призвела до посилення державного втручання в економіку.",
        },
        {
          en: "Some industries survived because of state intervention.",
          tr: "Деякі галузі вижили завдяки державному втручанню.",
        },
      ],
    },
    {
      section: NOUNS,
      icon: "🤲",
      phrase: "state-run social support",
      translation: "державна система соціальної підтримки",
      examples: [
        {
          en: "The country developed a system of state-run social support.",
          tr: "Країна розробила державну систему соціальної підтримки.",
        },
        {
          en: "State-run social support helped families during the crisis.",
          tr: "Державна соціальна підтримка допомогла родинам під час кризи.",
        },
      ],
    },
    {
      section: NOUNS,
      icon: "👷",
      phrase: "workforce",
      transcription: "/ˈwɜːk.fɔːs/",
      translation: "робоча сила / персонал / штат працівників",
      examples: [
        {
          en: "The company plans to expand its workforce.",
          tr: "Компанія планує збільшити штат працівників.",
        },
        {
          en: "A skilled workforce is essential for economic growth.",
          tr: "Кваліфікована робоча сила необхідна для економічного зростання.",
        },
      ],
    },

    {
      section: ADJ,
      icon: "📋",
      phrase: "comprehensive",
      transcription: "/ˌkɒm.prɪˈhen.sɪv/",
      translation: "всебічний / комплексний / повний",
      examples: [
        {
          en: "The report provides a comprehensive analysis of the problem.",
          tr: "Звіт містить всебічний аналіз проблеми.",
        },
        {
          en: "We need a comprehensive plan for social reform.",
          tr: "Нам потрібен комплексний план соціальної реформи.",
        },
      ],
    },
    {
      section: ADJ,
      icon: "🩼",
      phrase: "crippled",
      transcription: "/ˈkrɪp.əld/",
      translation: "паралізований / серйозно ослаблений",
      examples: [
        {
          en: "The country's economy was crippled by the war.",
          tr: "Економіка країни була серйозно ослаблена війною.",
        },
        {
          en: "The storm left the region with a crippled power system.",
          tr: "Після бурі регіон залишився з паралізованою енергосистемою.",
        },
      ],
    },
    {
      section: ADJ,
      icon: "🏭",
      phrase: "nationalised",
      transcription: "/ˈnæʃ.ən.əl.aɪzd/",
      translation: "націоналізований / переданий у державну власність",
      examples: [
        {
          en: "The railway was nationalised after the war.",
          tr: "Після війни залізницю націоналізували.",
        },
        {
          en: "Several nationalised industries received new investment.",
          tr: "Кілька націоналізованих галузей отримали нові інвестиції.",
        },
      ],
    },
    {
      section: ADJ,
      icon: "⚠️",
      phrase: "untenable",
      transcription: "/ʌnˈten.ə.bəl/",
      translation: "неприйнятний / нежиттєздатний / такий, що неможливо підтримувати",
      examples: [
        {
          en: "The government's position became untenable.",
          tr: "Позиція уряду стала неприйнятною.",
        },
        {
          en: "Rising costs made the project financially untenable.",
          tr: "Через зростання витрат проєкт став фінансово нежиттєздатним.",
        },
      ],
    },
    {
      section: ADJ,
      icon: "🖤",
      phrase: "widowed",
      transcription: "/ˈwɪd.əʊd/",
      translation: "овдовілий / той, хто втратив чоловіка або дружину",
      examples: [
        { en: "She was widowed at the age of forty.", tr: "Вона овдовіла у сорок років." },
        {
          en: "The programme offers support to widowed parents.",
          tr: "Програма надає підтримку овдовілим батькам.",
        },
      ],
    },

    {
      section: ADV,
      icon: "↘️",
      phrase: "adversely",
      transcription: "/ˈæd.vɜːs.li/",
      translation: "негативно / несприятливо",
      examples: [
        {
          en: "The new policy adversely affected low-income families.",
          tr: "Нова політика негативно вплинула на малозабезпечені родини.",
        },
        {
          en: "Delays may adversely affect the final result.",
          tr: "Затримки можуть несприятливо вплинути на кінцевий результат.",
        },
      ],
    },
  ],
};
