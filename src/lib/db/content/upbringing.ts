import type { SeedPage } from "./types";

const ADJ = "Adjectives — People & Relationships";
const NOUNS = "Nouns & Noun Phrases — Background, Family & History";
const CHANGES = "Phrases & Actions — Life Changes";

export const upbringingPage: SeedPage = {
  name: "Upbringing",
  icon: "🧒",
  description: "Life Stories — лексика про походження, сім'ю та життєві зміни",
  phrases: [
    {
      section: ADJ,
      icon: "🤝",
      phrase: "close-knit / tight-knit",
      transcription: "/ˈkləʊs.nɪt/",
      translation: "згуртований / тісно пов'язаний",
      examples: [
        { en: "She grew up in a close-knit family.", tr: "Вона виросла у згуртованій родині." },
        { en: "The village is a close-knit community.", tr: "Село — це тісно згуртована громада." },
      ],
    },
    {
      section: ADJ,
      icon: "🧸",
      phrase: "orphaned",
      transcription: "/ˈɔː.fənd/",
      translation: "осиротілий / той, хто втратив батьків",
      examples: [
        { en: "He was orphaned at the age of ten.", tr: "Він осиротів у десять років." },
        {
          en: "The charity supports orphaned children.",
          tr: "Благодійна організація підтримує дітей-сиріт.",
        },
      ],
    },
    {
      section: ADJ,
      icon: "⚡",
      phrase: "radical",
      transcription: "/ˈræd.ɪ.kəl/",
      translation: "радикальний / докорінний",
      examples: [
        {
          en: "The new government introduced radical reforms.",
          tr: "Новий уряд запровадив радикальні реформи.",
        },
        {
          en: "She made a radical change to her lifestyle.",
          tr: "Вона докорінно змінила свій спосіб життя.",
        },
      ],
    },

    {
      section: NOUNS,
      icon: "🎖️",
      phrase: "active service",
      translation: "дійсна військова служба / служба в зоні бойових дій",
      examples: [
        {
          en: "He spent two years on active service.",
          tr: "Він провів два роки на дійсній військовій службі.",
        },
        {
          en: "Soldiers on active service may be sent abroad.",
          tr: "Військовослужбовців на дійсній службі можуть направити за кордон.",
        },
      ],
    },
    {
      section: NOUNS,
      icon: "🏚️",
      phrase: "a broken home",
      translation: "сім'я, що розпалася / неповна сім'я",
      examples: [
        { en: "He grew up in a broken home.", tr: "Він виріс у сім'ї, що розпалася." },
        {
          en: "Coming from a broken home affected her childhood.",
          tr: "Те, що вона росла в неповній сім'ї, вплинуло на її дитинство.",
        },
      ],
    },
    {
      section: NOUNS,
      icon: "📉",
      phrase: "deprived background",
      translation: "походження з бідної родини / незаможне середовище",
      examples: [
        { en: "She came from a deprived background.", tr: "Вона походила з бідної родини." },
        {
          en: "Children from deprived backgrounds need more support.",
          tr: "Діти з малозабезпечених сімей потребують більшої підтримки.",
        },
      ],
    },
    {
      section: NOUNS,
      icon: "🪖",
      phrase: "military coup",
      translation: "військовий переворот",
      examples: [
        {
          en: "The president was removed in a military coup.",
          tr: "Президента усунули внаслідок військового перевороту.",
        },
        {
          en: "Many people fled the country after the military coup.",
          tr: "Після військового перевороту багато людей втекли з країни.",
        },
      ],
    },
    {
      section: NOUNS,
      icon: "🌾",
      phrase: "peasant",
      transcription: "/ˈpez.ənt/",
      translation: "селянин / селянка",
      examples: [
        {
          en: "His grandfather was a peasant farmer.",
          tr: "Його дід був селянином-землеробом.",
        },
        {
          en: "The novel tells the story of a poor peasant.",
          tr: "Роман розповідає історію бідного селянина.",
        },
      ],
    },
    {
      section: NOUNS,
      icon: "🏛️",
      phrase: "privileged background",
      translation: "привілейоване походження / походження із заможної родини",
      examples: [
        {
          en: "He comes from a privileged background.",
          tr: "Він походить із привілейованої родини.",
        },
        {
          en: "A privileged background gave her many opportunities.",
          tr: "Привілейоване походження дало їй багато можливостей.",
        },
      ],
    },
    {
      section: NOUNS,
      icon: "🎓",
      phrase: "scholarship",
      transcription: "/ˈskɒl.ə.ʃɪp/",
      translation: "стипендія / грант на навчання",
      examples: [
        {
          en: "She won a scholarship to study abroad.",
          tr: "Вона отримала стипендію для навчання за кордоном.",
        },
        {
          en: "The scholarship covered his tuition fees.",
          tr: "Стипендія покривала плату за його навчання.",
        },
      ],
    },
    {
      section: NOUNS,
      icon: "🛡️",
      phrase: "sheltered upbringing",
      translation: "виховання в надмірно захищеному середовищі",
      examples: [
        {
          en: "He had a sheltered upbringing and knew little about hardship.",
          tr: "Він ріс у надмірно захищеному середовищі й мало знав про труднощі.",
        },
        {
          en: "Her sheltered upbringing made university life a shock.",
          tr: "Через надмірно опікуване виховання університетське життя стало для неї шоком.",
        },
      ],
    },

    {
      section: CHANGES,
      icon: "🚨",
      phrase: "to be evacuated",
      translation: "бути евакуйованим / бути вивезеним у безпечне місце",
      examples: [
        {
          en: "The residents were evacuated before the storm.",
          tr: "Мешканців евакуювали перед бурею.",
        },
        {
          en: "The children had to be evacuated from the city.",
          tr: "Дітей довелося евакуювати з міста.",
        },
      ],
    },
    {
      section: CHANGES,
      icon: "🚪",
      phrase: "to drop out",
      translation: "кинути навчання / вибути з навчального закладу",
      examples: [
        {
          en: "He dropped out of university after one year.",
          tr: "Він кинув університет після першого курсу.",
        },
        { en: "She nearly dropped out of school.", tr: "Вона ледь не кинула школу." },
      ],
    },
    {
      section: CHANGES,
      icon: "🏃",
      phrase: "to flee the country",
      translation: "утекти з країни / залишити країну, рятуючись від небезпеки",
      examples: [
        {
          en: "The family had to flee the country during the war.",
          tr: "Під час війни родині довелося втекти з країни.",
        },
        {
          en: "He fled the country after the military coup.",
          tr: "Він утік з країни після військового перевороту.",
        },
      ],
    },
    {
      section: CHANGES,
      icon: "🧱",
      phrase: "from scratch",
      translation: "з нуля / із самого початку",
      examples: [
        { en: "She built the business from scratch.", tr: "Вона створила бізнес із нуля." },
        {
          en: "We had to start the project again from scratch.",
          tr: "Нам довелося почати проєкт заново, із самого початку.",
        },
      ],
    },
  ],
};
