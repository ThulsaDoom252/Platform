import type { SeedPage } from "./types";

const NOUNS = "Nouns — Events & Politics";
const VERBS = "Verbs & Forms — Actions & Changes";

export const changesPage: SeedPage = {
  name: "Changes",
  icon: "↔️",
  description: "History & Change — лексика про події, політику та зміни",
  phrases: [
    {
      section: NOUNS,
      icon: "💔",
      phrase: "break-up",
      transcription: "/ˈbreɪk.ʌp/",
      translation: "розпад / розрив стосунків",
      examples: [
        {
          en: "The break-up of the alliance changed the political situation.",
          tr: "Розпад союзу змінив політичну ситуацію.",
        },
        {
          en: "She needed time to recover after the break-up.",
          tr: "Їй знадобився час, щоб оговтатися після розриву стосунків.",
        },
      ],
    },
    {
      section: NOUNS,
      icon: "📜",
      phrase: "declaration",
      transcription: "/ˌdek.ləˈreɪ.ʃən/",
      translation: "декларація / проголошення / заява",
      examples: [
        {
          en: "The declaration of independence marked a new beginning.",
          tr: "Проголошення незалежності стало початком нового етапу.",
        },
        {
          en: "The leaders signed a joint declaration.",
          tr: "Лідери підписали спільну декларацію.",
        },
      ],
    },
    {
      section: NOUNS,
      icon: "🗳️",
      phrase: "election",
      transcription: "/ɪˈlek.ʃən/",
      translation: "вибори",
      examples: [
        { en: "The country held an election in May.", tr: "У країні провели вибори в травні." },
        {
          en: "The election result surprised many voters.",
          tr: "Результат виборів здивував багатьох виборців.",
        },
      ],
    },
    {
      section: NOUNS,
      icon: "📘",
      phrase: "introduction",
      transcription: "/ˌɪn.trəˈdʌk.ʃən/",
      translation: "запровадження / введення; вступ / знайомство",
      examples: [
        {
          en: "The introduction of new rules improved safety.",
          tr: "Запровадження нових правил покращило безпеку.",
        },
        {
          en: "Read the introduction before the first chapter.",
          tr: "Прочитай вступ перед першим розділом.",
        },
      ],
    },
    {
      section: NOUNS,
      icon: "🕯️",
      phrase: "massacre",
      transcription: "/ˈmæs.ə.kə(r)/",
      translation: "масова різанина / масове вбивство",
      examples: [
        {
          en: "The memorial honours the victims of the massacre.",
          tr: "Меморіал ушановує жертв масового вбивства.",
        },
        {
          en: "Survivors gave evidence about the massacre.",
          tr: "Ті, хто вижив, дали свідчення про масову різанину.",
        },
      ],
    },
    {
      section: NOUNS,
      icon: "👑",
      phrase: "overthrow",
      transcription: "/ˈəʊ.və.θrəʊ/",
      translation: "повалення влади / усунення правителя",
      examples: [
        {
          en: "The overthrow of the regime led to political uncertainty.",
          tr: "Повалення режиму призвело до політичної невизначеності.",
        },
        {
          en: "The book describes the overthrow of the king.",
          tr: "У книжці описано повалення короля.",
        },
      ],
    },
    {
      section: NOUNS,
      icon: "🖊️",
      phrase: "reforms",
      transcription: "/rɪˈfɔːmz/",
      translation: "реформи / перетворення",
      examples: [
        {
          en: "The government introduced economic reforms.",
          tr: "Уряд запровадив економічні реформи.",
        },
        {
          en: "These reforms strengthened public institutions.",
          tr: "Ці реформи зміцнили державні установи.",
        },
      ],
    },
    {
      section: NOUNS,
      icon: "🔍",
      phrase: "revelations",
      transcription: "/ˌrev.əˈleɪ.ʃənz/",
      translation: "викриття / нові приголомшливі відомості; одкровення",
      examples: [
        {
          en: "The revelations about corruption shocked the public.",
          tr: "Викриття корупції шокувало громадськість.",
        },
        {
          en: "Her memoir contains surprising revelations about her childhood.",
          tr: "Її мемуари містять несподівані відомості про її дитинство.",
        },
      ],
    },
    {
      section: NOUNS,
      icon: "🏆",
      phrase: "success",
      transcription: "/səkˈses/",
      translation: "успіх",
      examples: [
        { en: "The project was a great success.", tr: "Проєкт мав великий успіх." },
        {
          en: "Their success depended on careful planning.",
          tr: "Їхній успіх залежав від ретельного планування.",
        },
      ],
    },
    {
      section: NOUNS,
      icon: "🥇",
      phrase: "victory",
      transcription: "/ˈvɪk.tər.i/",
      translation: "перемога",
      examples: [
        { en: "The team celebrated its victory.", tr: "Команда святкувала свою перемогу." },
        {
          en: "The election victory gave the party a clear mandate.",
          tr: "Перемога на виборах дала партії чіткий мандат.",
        },
      ],
    },

    {
      section: VERBS,
      icon: "💔",
      phrase: "to break up",
      translation: "розпадатися / розривати стосунки / розганяти",
      examples: [
        {
          en: "The coalition broke up after the election.",
          tr: "Коаліція розпалася після виборів.",
        },
        { en: "Police broke up the fight.", tr: "Поліція припинила бійку." },
      ],
    },
    {
      section: VERBS,
      icon: "🚪",
      phrase: "entered (to enter)",
      transcription: "/ˈen.təd/",
      translation: "увійшов / вступив / ввів",
      examples: [
        { en: "The army entered the city at dawn.", tr: "Армія увійшла до міста на світанку." },
        {
          en: "She entered the web address in the browser.",
          tr: "Вона ввела вебадресу в браузері.",
        },
      ],
    },
    {
      section: VERBS,
      icon: "🏛️",
      phrase: "established (to establish)",
      transcription: "/ɪˈstæb.lɪʃt/",
      translation: "заснував / установив; заснований / усталений / визнаний",
      examples: [
        { en: "They established a new organisation.", tr: "Вони заснували нову організацію." },
        { en: "She is an established writer.", tr: "Вона визнана письменниця." },
      ],
    },
    {
      section: VERBS,
      icon: "🏃",
      phrase: "fled (to flee)",
      transcription: "/fled/",
      translation: "утік / утекла / утекли",
      examples: [
        {
          en: "Many families fled the country during the war.",
          tr: "Під час війни багато родин утекли з країни.",
        },
        {
          en: "The suspect fled before the police arrived.",
          tr: "Підозрюваний утік до прибуття поліції.",
        },
      ],
    },
    {
      section: VERBS,
      icon: "📍",
      phrase: "marked (to mark)",
      transcription: "/mɑːkt/",
      translation: "позначив / відзначив / ознаменував; помітний / виражений",
      examples: [
        {
          en: "The agreement marked the end of the conflict.",
          tr: "Угода ознаменувала завершення конфлікту.",
        },
        {
          en: "There was a marked improvement in his health.",
          tr: "У його здоров'ї відбулося помітне покращення.",
        },
      ],
    },
    {
      section: VERBS,
      icon: "⚔️",
      phrase: "to massacre",
      transcription: "/ˈmæs.ə.kə(r)/",
      translation: "вчиняти масове вбивство / масово винищувати",
      examples: [
        {
          en: "The report says that civilians were massacred.",
          tr: "У звіті зазначено, що мирних жителів масово вбили.",
        },
        {
          en: "The court investigated claims that prisoners had been massacred.",
          tr: "Суд розглядав повідомлення про масове вбивство полонених.",
        },
      ],
    },
    {
      section: VERBS,
      icon: "👑",
      phrase: "to overthrow",
      transcription: "/ˌəʊ.vəˈθrəʊ/",
      translation: "повалити / скинути владу або правителя",
      examples: [
        {
          en: "The rebels tried to overthrow the government.",
          tr: "Повстанці намагалися повалити уряд.",
        },
        {
          en: "The regime was overthrown after months of protests.",
          tr: "Режим повалили після кількох місяців протестів.",
        },
      ],
    },
    {
      section: VERBS,
      icon: "👉",
      phrase: "pointed (to point)",
      transcription: "/ˈpɔɪn.tɪd/",
      translation: "указав / показав / спрямував; загострений / гострий",
      examples: [
        { en: "She pointed to the place on the map.", tr: "Вона вказала на місце на карті." },
        {
          en: "He asked a pointed question about the missing money.",
          tr: "Він поставив гостре запитання про зниклі гроші.",
        },
      ],
    },
    {
      section: VERBS,
      icon: "🖊️",
      phrase: "to reform",
      transcription: "/rɪˈfɔːm/",
      translation: "реформувати / перетворювати / удосконалювати",
      examples: [
        {
          en: "The government plans to reform the education system.",
          tr: "Уряд планує реформувати систему освіти.",
        },
        {
          en: "The new law reformed the tax system.",
          tr: "Новий закон реформував податкову систему.",
        },
      ],
    },
    {
      section: VERBS,
      icon: "🚫",
      phrase: "to restrict",
      transcription: "/rɪˈstrɪkt/",
      translation: "обмежувати / забороняти",
      examples: [
        {
          en: "The rules restrict access to this building.",
          tr: "Правила обмежують доступ до цієї будівлі.",
        },
        {
          en: "The government restricted public spending.",
          tr: "Уряд обмежив державні видатки.",
        },
      ],
    },
    {
      section: VERBS,
      icon: "🌾",
      phrase: "sowed (to sow)",
      transcription: "/səʊd/",
      translation: "посіяв / засіяв / сіяв",
      examples: [
        {
          en: "The farmers sowed wheat in the spring.",
          tr: "Навесні фермери посіяли пшеницю.",
        },
        {
          en: "The rumours sowed doubt among the voters.",
          tr: "Чутки посіяли сумніви серед виборців.",
        },
      ],
    },
    {
      section: VERBS,
      icon: "💪",
      phrase: "strengthened (to strengthen)",
      transcription: "/ˈstreŋ.θənd/",
      translation: "зміцнив / посилив; зміцнений / посилений",
      examples: [
        { en: "The reforms strengthened the economy.", tr: "Реформи зміцнили економіку." },
        {
          en: "Working together strengthened their friendship.",
          tr: "Спільна робота зміцнила їхню дружбу.",
        },
      ],
    },
    {
      section: VERBS,
      icon: "📉",
      phrase: "undermined (to undermine)",
      transcription: "/ˌʌn.dəˈmaɪnd/",
      translation: "підірвав / послабив; підірваний / послаблений",
      examples: [],
    },
  ],
};
