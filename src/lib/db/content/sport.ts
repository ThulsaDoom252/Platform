import type { SeedPage } from "./types";

const VERBS = "Single-word Verbs & Participles";
const ACTIONS = "Sports Actions & Competition";
const GAME = "Game Descriptions — Опис гри";
const CONDITION = "Physical Condition — Фізичний стан";

export const sportPage: SeedPage = {
  name: "Sport",
  icon: "🏅",
  description:
    "Sports & Competition — лексика про результати, правила та стан спортсменів",
  phrases: [
    {
      section: VERBS,
      icon: "⬇️",
      phrase: "dropped",
      transcription: "/drɒpt/",
      translation: "виключений зі складу / не включений до команди (на рівні відбору)",
      examples: [
        {
          en: "The striker was dropped from the team after several poor games.",
          tr: "Нападника виключили зі складу після кількох невдалих матчів.",
        },
        {
          en: "She was surprised to be dropped for the final.",
          tr: "Вона здивувалася, що її не включили до складу на фінал.",
        },
      ],
    },
    {
      section: VERBS,
      icon: "🔋",
      phrase: "to fade",
      transcription: "/feɪd/",
      translation: "слабшати / згасати / втрачати сили",
      examples: [
        {
          en: "The team faded in the second half.",
          tr: "У другому таймі команда втратила сили.",
        },
        {
          en: "His hopes of winning began to fade.",
          tr: "Його надії на перемогу почали згасати.",
        },
      ],
    },
    {
      section: VERBS,
      icon: "🔄",
      phrase: "to overturn",
      transcription: "/ˌəʊ.vəˈtɜːn/",
      translation: "скасувати / змінити рішення",
      examples: [
        {
          en: "The referee overturned the decision after watching the replay.",
          tr: "Арбітр змінив рішення після перегляду повтору.",
        },
        {
          en: "The appeal committee overturned the ban.",
          tr: "Апеляційний комітет скасував дискваліфікацію.",
        },
      ],
    },
    {
      section: VERBS,
      icon: "🔁",
      phrase: "substituted",
      transcription: "/ˈsʌb.stɪ.tjuː.tɪd/",
      translation:
        "замінений іншим гравцем (або взагалі кимось; не обов'язково у спорті). Зазвичай тимчасово",
      examples: [
        {
          en: "The injured player was substituted at half-time.",
          tr: "Травмованого гравця замінили в перерві.",
        },
        {
          en: "He looked disappointed when he was substituted.",
          tr: "Він виглядав розчарованим, коли його замінили.",
        },
      ],
    },
    {
      section: VERBS,
      icon: "✅",
      phrase: "to uphold",
      transcription: "/ʌpˈhəʊld/",
      translation:
        "залишити рішення в силі / підтримати рішення / дотримуватися правил",
      examples: [
        {
          en: "The committee upheld the referee's decision.",
          tr: "Комітет залишив рішення арбітра в силі.",
        },
        {
          en: "The appeal was rejected, and the suspension was upheld.",
          tr: "Апеляцію відхилили, а дискваліфікацію залишили в силі.",
        },
      ],
    },

    {
      section: ACTIONS,
      icon: "💉",
      phrase: "to be caught doping",
      translation: "бути спійманим на вживанні допінгу",
      examples: [
        {
          en: "The athlete was caught doping and lost her medal.",
          tr: "Спортсменку викрили у вживанні допінгу, і вона втратила медаль.",
        },
        {
          en: "Players caught doping may receive a long ban.",
          tr: "Гравці, спіймані на допінгу, можуть отримати тривалу дискваліфікацію.",
        },
      ],
    },
    {
      section: ACTIONS,
      icon: "⛔",
      phrase: "to be suspended",
      translation: "бути відстороненим / бути дискваліфікованим",
      examples: [
        { en: "He was suspended for three matches.", tr: "Його відсторонили на три матчі." },
        {
          en: "A player may be suspended for violent conduct.",
          tr: "Гравця можуть дискваліфікувати за агресивну поведінку.",
        },
      ],
    },
    {
      section: ACTIONS,
      icon: "💥",
      phrase: "to blow it",
      translation: "усе зіпсувати / втратити шанс",
      examples: [
        { en: "We were leading 2:0, but we blew it.", tr: "Ми вели 2:0, але все зіпсували." },
        {
          en: "Don't blow it now; you're close to the final.",
          tr: "Не втрать шанс зараз: ти майже у фіналі.",
        },
      ],
    },
    {
      section: ACTIONS,
      icon: "🙋",
      phrase: "to challenge a decision",
      translation: "оскаржити рішення",
      examples: [
        {
          en: "The coach decided to challenge the referee's decision.",
          tr: "Тренер вирішив оскаржити рішення арбітра.",
        },
        {
          en: "Teams can challenge a decision using video review.",
          tr: "Команди можуть оскаржити рішення за допомогою відеоперегляду.",
        },
      ],
    },
    {
      section: ACTIONS,
      icon: "🤝",
      phrase: "to fix a match",
      translation: "підтасувати результат матчу / домовитися про результат (за гроші)",
      examples: [
        {
          en: "The players were accused of trying to fix a match.",
          tr: "Гравців звинуватили у спробі підтасувати результат матчу.",
        },
        {
          en: "Fixing a match can lead to a lifetime ban.",
          tr: "Підтасування результату матчу може призвести до довічної дискваліфікації.",
        },
      ],
    },
    {
      section: ACTIONS,
      icon: "🥊",
      phrase: "to get knocked out",
      translation: "вилетіти з турніру / зазнати нокауту",
      examples: [
        {
          en: "They got knocked out in the quarter-finals.",
          tr: "Вони вилетіли з турніру у чвертьфіналі.",
        },
        {
          en: "The boxer was knocked out in the third round.",
          tr: "Боксера нокаутували в третьому раунді.",
        },
      ],
    },
    {
      section: ACTIONS,
      icon: "📉",
      phrase: "to get trashed",
      translation: "бути розгромленим / зазнати нищівної поразки",
      examples: [
        { en: "We got trashed 6-0.", tr: "Нас розгромили з рахунком 6:0." },
        {
          en: "Their team got trashed in the final.",
          tr: "Їхня команда зазнала нищівної поразки у фіналі.",
        },
      ],
    },
    {
      section: ACTIONS,
      icon: "➡️",
      phrase: "to go through",
      translation: "пройти до наступного раунду / пройти",
      examples: [
        {
          en: "We won on penalties and went through to the final.",
          tr: "Ми перемогли в серії пенальті й пройшли до фіналу.",
        },
        {
          en: "Only the top two teams go through.",
          tr: "До наступного раунду проходять лише дві найкращі команди.",
        },
      ],
    },
    {
      section: ACTIONS,
      icon: "😅",
      phrase: "to scrape through",
      translation: "ледве пройти / насилу вийти в наступний раунд або етап",
      examples: [
        {
          en: "They scraped through with a last-minute goal.",
          tr: "Вони ледве пройшли далі завдяки голу на останній хвилині.",
        },
        {
          en: "We scraped through to the semi-finals on penalties.",
          tr: "Ми насилу вийшли до півфіналу в серії пенальті.",
        },
      ],
    },
    {
      section: ACTIONS,
      icon: "🟥",
      phrase: "to send someone off",
      translation: "вилучити когось із поля",
      examples: [
        {
          en: "The referee sent him off for a dangerous tackle.",
          tr: "Арбітр вилучив його з поля за небезпечний підкат.",
        },
        {
          en: "Two players were sent off during the match.",
          tr: "Під час матчу двох гравців вилучили з поля.",
        },
      ],
    },

    {
      section: GAME,
      icon: "⚖️",
      phrase: "a close game",
      translation: "напружена гра / гра приблизно рівних суперників",
      examples: [
        { en: "It was a close game, but we won 2-1.", tr: "Це була напружена гра, але ми перемогли 2:1." },
        {
          en: "Everyone expected a close game between the two teams.",
          tr: "Усі очікували рівної боротьби між двома командами.",
        },
      ],
    },
    {
      section: GAME,
      icon: "🟨",
      phrase: "dirty game",
      translation: "брудна гра / нечесна гра",
      examples: [
        {
          en: "It was a dirty game with many fouls.",
          tr: "Це була брудна гра з великою кількістю фолів.",
        },
        {
          en: "The referee struggled to control the dirty game.",
          tr: "Арбітру було важко контролювати жорстоку й нечесну гру.",
        },
      ],
    },
    {
      section: GAME,
      icon: "📊",
      phrase: "one-sided game",
      translation: "одностороння гра / гра з явною перевагою однієї команди",
      examples: [
        {
          en: "The final was a one-sided game from the start.",
          tr: "Фінал від самого початку проходив з явною перевагою однієї команди.",
        },
        {
          en: "Nobody expected such a one-sided game.",
          tr: "Ніхто не очікував настільки односторонньої гри.",
        },
      ],
    },
    {
      section: GAME,
      icon: "⏱️",
      phrase: "sin-bin",
      transcription: "/ˈsɪn.bɪn/",
      translation: "штрафна лава / зона тимчасового вилучення",
      examples: [
        {
          en: "The player was sent to the sin-bin for ten minutes.",
          tr: "Гравця відправили на штрафну лаву на десять хвилин.",
        },
        {
          en: "A yellow card can mean time in the sin-bin.",
          tr: "Жовта картка може означати тимчасове вилучення до штрафної зони.",
        },
      ],
    },

    {
      section: CONDITION,
      icon: "🦵",
      phrase: "feeling stiff",
      translation: "відчувати скутість у м'язах / мати затерплі м'язи",
      examples: [
        {
          en: "I'm feeling stiff after yesterday's training.",
          tr: "Після вчорашнього тренування я відчуваю скутість у м'язах.",
        },
        {
          en: "She was feeling stiff before the race.",
          tr: "Перед забігом вона відчувала скутість у м'язах.",
        },
      ],
    },
    {
      section: CONDITION,
      icon: "⚡",
      phrase: "to get cramp",
      translation: "мати судому / коли зводить м'яз судомою",
      examples: [
        {
          en: "I got cramp in my leg during the match.",
          tr: "Під час матчу в мене звело ногу судомою.",
        },
        {
          en: "Stretch properly so you don't get cramp.",
          tr: "Добре розімнися, щоб тебе не схопила судома.",
        },
      ],
    },
  ],
};
