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
import { organizeVocabularyHomework } from "../src/lib/vocabulary-homework";

const LESSON_TITLE = "Tucker & Mendel — Part 9";
const FOLDER_NAME = "Tucker & Mendel";
const LEGACY_FOLDER_NAME = "Mendel & Tucker";
const VIDEO_URL = "https://www.youtube.com/watch?v=Pkz2-cWHPbg&start=4433&end=5022";

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
  examples: [string, string][];
};

const vocabulary: VocabularySeed[] = [
  {
    category: "🎨 Adjectives", icon: "🌀", word: "weird", ipaUs: "/wɪrd/",
    translation: "дивний; чудний", description: "unusual, unexpected, or difficult to explain",
    fillPrompt: "That was a really ___ situation.",
    examples: [["I had a weird dream last night.", "Минулої ночі мені наснився дивний сон."], ["The whole conversation felt weird.", "Уся розмова здавалася дивною."]],
  },
  {
    category: "🎨 Adjectives", icon: "💎", word: "pure", ipaUs: "/pjʊr/",
    translation: "чистий; цілковитий", description: "complete and not mixed with anything else",
    fillPrompt: "His explanation was ___ fiction.",
    examples: [["The water is pure and safe to drink.", "Вода чиста й безпечна для пиття."], ["It was pure coincidence.", "Це був чистий збіг."]],
  },
  {
    category: "🎨 Adjectives", icon: "👽", word: "strange", ipaUs: "/streɪndʒ/",
    translation: "дивний; незвичайний", description: "unusual or surprising, especially in a way that is hard to understand",
    fillPrompt: "There was a ___ rule that nobody could explain.",
    examples: [["I heard a strange noise outside.", "Я почув дивний звук надворі."], ["Her reaction was rather strange.", "Її реакція була досить дивною."]],
  },
  {
    category: "🎨 Adjectives", icon: "🎭", word: "surreal", ipaUs: "/səˈriːəl/",
    translation: "сюрреалістичний; нереальний", description: "so unusual that it seems unreal or dreamlike",
    fillPrompt: "Seeing the empty city was a ___ experience.",
    examples: [["The silent airport looked surreal.", "Порожній аеропорт виглядав нереально."], ["Winning the final felt surreal.", "Перемога у фіналі здавалася нереальною."]],
  },
  {
    category: "🎨 Adjectives", icon: "⏮️", word: "former", ipaUs: "/ˈfɔːrmər/",
    translation: "колишній", description: "having had a particular position or role in the past",
    fillPrompt: "The ___ president gave an interview.",
    examples: [["She is a former government adviser.", "Вона — колишня радниця уряду."], ["His former office is now a museum.", "Його колишній офіс тепер є музеєм."]],
  },
  {
    category: "📦 Nouns", icon: "💥", word: "shelling", ipaUs: "/ˈʃelɪŋ/",
    translation: "обстріл", description: "an attack in which explosive shells are fired at a place",
    fillPrompt: "The village was damaged during heavy ___.",
    examples: [["The shelling continued through the night.", "Обстріл тривав усю ніч."], ["Families left the area after the shelling.", "Сім'ї покинули район після обстрілу."]],
  },
  {
    category: "📦 Nouns", icon: "🍀", word: "pure luck", ipaUs: "/pjʊr lʌk/",
    translation: "чисте везіння; випадкова удача", description: "success caused entirely by chance rather than skill or planning",
    fillPrompt: "Finding the keys before the train left was ___.",
    examples: [["We escaped by pure luck.", "Ми врятувалися завдяки чистому везінню."], ["It was pure luck that nobody was hurt.", "Лише завдяки щасливому випадку ніхто не постраждав."]],
  },
  {
    category: "📦 Nouns", icon: "🚀", word: "a missile", ipaUs: "/ə ˈmɪsəl/",
    translation: "ракета", description: "a weapon that is sent through the air toward a target",
    fillPrompt: "The defence system detected ___ in the air.",
    examples: [["The missile missed its target.", "Ракета не влучила в ціль."], ["The warning came before the missile attack.", "Попередження надійшло до ракетної атаки."]],
  },
  {
    category: "📦 Nouns", icon: "🚪", word: "an opportunity", ipaUs: "/ən ˌɑːpərˈtuːnəti/",
    translation: "можливість; нагода", description: "a situation that makes it possible to do something useful or desirable",
    fillPrompt: "This job is ___ to learn new skills.",
    examples: [["I had an opportunity to speak to her.", "Я мав нагоду поговорити з нею."], ["Do not miss this opportunity.", "Не проґав цю можливість."]],
  },
  {
    category: "📦 Nouns", icon: "🎨", word: "an artist", ipaUs: "/ən ˈɑːrtɪst/",
    translation: "митець; художник", description: "a person who creates art, music, literature, or performances",
    fillPrompt: "The exhibition featured ___ from Kyiv.",
    examples: [["She works as an artist and illustrator.", "Вона працює художницею та ілюстраторкою."], ["Many artists opposed the ban.", "Багато митців виступили проти заборони."]],
  },
  {
    category: "📦 Nouns", icon: "📈", word: "a tendency", ipaUs: "/ə ˈtendənsi/",
    translation: "тенденція; схильність", description: "a general direction in which a situation changes, or a habit of behaving in a certain way",
    fillPrompt: "He has ___ to ignore uncomfortable facts.",
    examples: [["There is a tendency to blame others.", "Існує тенденція звинувачувати інших."], ["Prices have an upward tendency.", "Ціни мають тенденцію до зростання."]],
  },
  {
    category: "📦 Nouns", icon: "⚠️", word: "a threat", ipaUs: "/ə θret/",
    translation: "загроза; погроза", description: "a sign of possible danger or a statement that someone will cause harm",
    fillPrompt: "The message contained ___ against the journalist.",
    examples: [["Climate change is a serious threat.", "Зміна клімату є серйозною загрозою."], ["The police took the threat seriously.", "Поліція серйозно поставилася до погрози."]],
  },
  {
    category: "📦 Nouns", icon: "🛡️", word: "a security service", ipaUs: "/ə sɪˈkjʊrəti ˈsɜːrvɪs/",
    translation: "служба безпеки", description: "a state organization that protects national security and investigates serious threats",
    fillPrompt: "The blogger was questioned by ___.",
    examples: [["The security service opened an investigation.", "Служба безпеки розпочала розслідування."], ["He used to work for a security service.", "Раніше він працював у службі безпеки."]],
  },
  {
    category: "📦 Nouns", icon: "⚖️", word: "treason", ipaUs: "/ˈtriːzən/",
    translation: "державна зрада", description: "the crime of betraying one's country, especially by helping its enemies",
    fillPrompt: "He was charged with ___.",
    examples: [["The accusation of treason shocked the public.", "Звинувачення в державній зраді шокувало суспільство."], ["Treason is a serious criminal offence.", "Державна зрада є тяжким кримінальним злочином."]],
  },
  {
    category: "📦 Nouns", icon: "🔴", word: "a Bolshevik", ipaUs: "/ə ˈboʊlʃəvɪk/",
    translation: "більшовик", description: "a member or supporter of the revolutionary Communist group that took power in Russia in 1917",
    fillPrompt: "The speaker compared the politician to ___.",
    examples: [["He wrote a book about a Bolshevik leader.", "Він написав книжку про більшовицького лідера."], ["The term Bolshevik has a specific historical meaning.", "Термін «більшовик» має конкретне історичне значення."]],
  },
  {
    category: "📦 Nouns", icon: "☭", word: "the USSR", ipaUs: "/ðə ˌjuː es es ˈɑːr/",
    translation: "СРСР", description: "the Union of Soviet Socialist Republics, a state that existed from 1922 to 1991",
    fillPrompt: "The country became independent after the collapse of ___.",
    examples: [["The USSR dissolved in 1991.", "СРСР розпався у 1991 році."], ["They discussed life in the USSR.", "Вони обговорювали життя в СРСР."]],
  },
  {
    category: "📦 Nouns", icon: "🏦", word: "an account", ipaUs: "/ən əˈkaʊnt/",
    translation: "рахунок; обліковий запис", description: "an arrangement with a bank or an online service that belongs to a particular user",
    fillPrompt: "The bank froze ___.",
    examples: [["She opened an account at the bank.", "Вона відкрила рахунок у банку."], ["I cannot log into my account.", "Я не можу увійти у свій обліковий запис."]],
  },
  {
    category: "📦 Nouns", icon: "🤝", word: "friendship", ipaUs: "/ˈfrendʃɪp/",
    translation: "дружба", description: "a close and trusting relationship between friends",
    fillPrompt: "Their ___ lasted for many years.",
    examples: [["Their friendship began at university.", "Їхня дружба почалася в університеті."], ["Trust is important in a friendship.", "Довіра важлива у дружбі."]],
  },
  {
    category: "📦 Nouns", icon: "💬", word: "feedback", ipaUs: "/ˈfiːdbæk/",
    translation: "зворотний зв'язок; відгук", description: "comments or information about how well something works or how someone performed",
    fillPrompt: "The team asked users for ___.",
    examples: [["Thank you for your feedback.", "Дякую за ваш відгук."], ["The teacher gave detailed feedback.", "Учитель дав детальний зворотний зв'язок."]],
  },
  {
    category: "⚡ Verbs", icon: "🧩", word: "to work out", ipaUs: "/tə wɜːrk aʊt/",
    translation: "спрацювати; вдатися; розібратися", description: "to develop successfully, or to find a solution after thinking",
    fillPrompt: "I hope the new plan will ___.",
    examples: [["Everything worked out in the end.", "Зрештою все вдалося."], ["We need to work out a solution.", "Нам потрібно знайти рішення."]],
    accepted: ["work out"],
  },
  {
    category: "⚡ Verbs", icon: "💣", word: "to shell", ipaUs: "/tə ʃel/",
    translation: "обстрілювати", description: "to attack a place by firing explosive shells at it",
    fillPrompt: "The army continued ___ the area overnight.", fillAnswer: "to shell",
    examples: [["The forces began to shell the city.", "Війська почали обстрілювати місто."], ["They shelled the position for hours.", "Вони годинами обстрілювали позицію."]],
    accepted: ["shell", "shelling"],
  },
  {
    category: "⚡ Verbs", icon: "🩺", word: "to treat", ipaUs: "/tə triːt/",
    translation: "ставитися; трактувати; лікувати", description: "to behave toward someone in a particular way, understand something in a particular way, or give medical care",
    fillPrompt: "The media may ___ the same event differently.",
    examples: [["They treated us with respect.", "Вони поставилися до нас із повагою."], ["Doctors treated the injured passengers.", "Лікарі лікували травмованих пасажирів."]],
    accepted: ["treat"],
  },
  {
    category: "⚡ Verbs", icon: "🚫", word: "to ban", ipaUs: "/tə bæn/",
    translation: "забороняти", description: "to officially say that something is not allowed",
    fillPrompt: "The city plans ___ cars from the central square.",
    examples: [["The country banned the publication.", "Країна заборонила публікацію."], ["They want to ban single-use plastic.", "Вони хочуть заборонити одноразовий пластик."]],
    accepted: ["ban"],
  },
  {
    category: "⚡ Verbs", icon: "🌱", word: "to develop", ipaUs: "/tə dɪˈveləp/",
    translation: "розвивати; розробляти; формувати", description: "to grow, change, or create something gradually over time",
    fillPrompt: "The company hopes ___ a safer system.",
    examples: [["Children develop at different speeds.", "Діти розвиваються з різною швидкістю."], ["The team developed a new method.", "Команда розробила новий метод."]],
    accepted: ["develop"],
  },
  {
    category: "⚡ Verbs", icon: "↩️", word: "to go against", ipaUs: "/tə ɡoʊ əˈɡenst/",
    translation: "виступати проти; суперечити", description: "to oppose someone or something, or to conflict with a rule or belief",
    fillPrompt: "The decision appears ___ the constitution.",
    examples: [["She decided to go against the majority.", "Вона вирішила виступити проти більшості."], ["That goes against our values.", "Це суперечить нашим цінностям."]],
    accepted: ["go against"],
  },
  {
    category: "⚡ Verbs", icon: "🛒", word: "to purchase", ipaUs: "/tə ˈpɜːrtʃəs/",
    translation: "купувати; придбавати", description: "to buy something, especially in a formal or business context",
    fillPrompt: "The company agreed ___ the equipment.",
    examples: [["Tickets can be purchased online.", "Квитки можна придбати онлайн."], ["They purchased a small apartment.", "Вони придбали невелику квартиру."]],
    accepted: ["purchase"],
  },
  {
    category: "⚡ Verbs", icon: "👉", word: "to accuse somebody of something", ipaUs: "/tə əˈkjuːz ˈsʌmbədi əv ˈsʌmθɪŋ/",
    translation: "звинувачувати когось у чомусь", description: "to say that someone has done something wrong or illegal",
    fillPrompt: "They tried ___ him of treason.", fillAnswer: "to accuse",
    examples: [["They accused him of lying.", "Його звинуватили у брехні."], ["She was accused of a crime.", "Її звинуватили у злочині."]],
    accepted: ["accuse"],
  },
  {
    category: "⚡ Verbs", icon: "😠", word: "to threaten", ipaUs: "/tə ˈθretən/",
    translation: "погрожувати; загрожувати", description: "to say that you will harm someone, or to put something in danger",
    fillPrompt: "The message appeared ___ the reporter.",
    examples: [["He threatened to leave the company.", "Він пригрозив піти з компанії."], ["The fire threatened nearby homes.", "Пожежа загрожувала сусіднім будинкам."]],
    accepted: ["threaten"],
  },
  {
    category: "⚡ Verbs", icon: "🗑️", word: "to get rid of somebody or something", ipaUs: "/tə ɡet rɪd əv ˈsʌmbədi ɔːr ˈsʌmθɪŋ/",
    translation: "позбутися когось або чогось", description: "to remove, throw away, or stop being affected by someone or something unwanted",
    fillPrompt: "We need ___ these unnecessary files.", fillAnswer: "to get rid of",
    examples: [["How can we get rid of this smell?", "Як нам позбутися цього запаху?"], ["They wanted to get rid of the old system.", "Вони хотіли позбутися старої системи."]],
    accepted: ["get rid of"],
  },
  {
    category: "⚡ Verbs", icon: "✅", word: "to solve", ipaUs: "/tə sɑːlv/",
    translation: "вирішувати; розв'язувати", description: "to find an answer to a problem or a way out of a difficult situation",
    fillPrompt: "We must ___ the problem before it grows.",
    examples: [["Can you solve this puzzle?", "Ти можеш розв'язати цю головоломку?"], ["The talks failed to solve the crisis.", "Переговори не змогли вирішити кризу."]],
    accepted: ["solve"],
  },
  {
    category: "⚡ Verbs", icon: "🧲", word: "to influence", ipaUs: "/tə ˈɪnfluəns/",
    translation: "впливати", description: "to affect how someone thinks or behaves, or how something develops",
    fillPrompt: "Advertising can ___ what people buy.",
    examples: [["Friends can influence our choices.", "Друзі можуть впливати на наш вибір."], ["Weather influenced the result.", "Погода вплинула на результат."]],
    accepted: ["influence"],
  },
  {
    category: "⚡ Verbs", icon: "👏", word: "to applaud", ipaUs: "/tə əˈplɔːd/",
    translation: "аплодувати; схвалювати", description: "to clap to show approval, or to publicly express strong approval",
    fillPrompt: "The audience began ___ after the speech.", fillAnswer: "to applaud",
    examples: [["Everyone applauded the performers.", "Усі аплодували виконавцям."], ["We applaud her decision to speak openly.", "Ми схвалюємо її рішення говорити відкрито."]],
    accepted: ["applaud", "applauding"],
  },
  {
    category: "⚡ Verbs", icon: "📉", word: "to drop", ipaUs: "/tə drɑːp/",
    translation: "падати; знижуватися; кидати", description: "to fall or become lower, or to let something fall",
    fillPrompt: "The ratings began ___ quickly.", fillAnswer: "to drop",
    examples: [["Temperatures dropped below zero.", "Температура впала нижче нуля."], ["His approval rating continues to drop.", "Його рейтинг схвалення продовжує падати."]],
    accepted: ["drop", "dropping"],
  },
  {
    category: "⚡ Verbs", icon: "📋", word: "to push through an agenda", ipaUs: "/tə pʊʃ θruː ən əˈdʒendə/",
    translation: "просувати порядок денний; наполегливо проводити програму", description: "to use persistent effort or influence to make a planned set of policies happen",
    fillPrompt: "The group tried ___ despite public criticism.",
    examples: [["They pushed through an ambitious agenda.", "Вони наполегливо провели амбітну програму."], ["The minister used the crisis to push through his agenda.", "Міністр використав кризу, щоб просунути свій порядок денний."]],
    accepted: ["push through an agenda", "to push through the agenda"],
  },
  {
    category: "⚡ Verbs", icon: "📣", word: "to demand", ipaUs: "/tə dɪˈmænd/",
    translation: "вимагати", description: "to ask for something firmly and insist that it must happen",
    fillPrompt: "Residents began ___ an explanation.", fillAnswer: "to demand",
    examples: [["Workers demanded higher pay.", "Працівники вимагали вищої зарплати."], ["The situation demands immediate action.", "Ситуація вимагає негайних дій."]],
    accepted: ["demand", "demanding"],
  },
  {
    category: "💬 Phrases & patterns", icon: "🧠", word: "to somebody's mind", ipaUs: "/tə ˈsʌmbədiz maɪnd/",
    translation: "на чиюсь думку", description: "used to introduce what a particular person thinks or believes",
    fillPrompt: "___, the decision was completely reasonable.", fillAnswer: "to his mind",
    examples: [["To my mind, the rule is unfair.", "На мою думку, це правило несправедливе."], ["The story was funny to his mind.", "На його думку, історія була смішною."]],
    accepted: ["to somebody's mind", "to my mind", "to her mind"],
  },
  {
    category: "💬 Phrases & patterns", icon: "🕹️", word: "to make somebody do something", ipaUs: "/tə meɪk ˈsʌmbədi duː ˈsʌmθɪŋ/",
    translation: "змусити когось щось зробити", description: "to cause or force a person to perform an action; make is followed by the bare infinitive",
    fillPrompt: "The structure “___” takes the bare infinitive after the person.", fillAnswer: "make somebody do something",
    examples: [["They made him apologize.", "Вони змусили його вибачитися."], ["The joke made everyone laugh.", "Жарт змусив усіх засміятися."]],
    accepted: ["to make somebody do something"],
  },
  {
    category: "💬 Phrases & patterns", icon: "🤷", word: "I don't care", ipaUs: "/aɪ doʊnt ker/",
    translation: "мені байдуже", description: "used to say that something is not important to you",
    fillPrompt: "You can choose either option — ___.",
    examples: [["I don't care what they think.", "Мені байдуже, що вони думають."], ["I don't care which restaurant we choose.", "Мені байдуже, який ресторан ми оберемо."]],
  },
  {
    category: "💬 Phrases & patterns", icon: "🌙", word: "late + time period", ipaUs: "/leɪt/",
    translation: "наприкінці певного періоду", description: "used before a year, month, decade, or other period to mean near its end",
    fillPrompt: "The change began in ___ 2023.", fillAnswer: "late",
    examples: [["The policy changed in late 2023.", "Політика змінилася наприкінці 2023 року."], ["We arrived in late September.", "Ми прибули наприкінці вересня."]],
  },
  {
    category: "💬 Phrases & patterns", icon: "🌅", word: "early + time period", ipaUs: "/ˈɜːrli/",
    translation: "на початку певного періоду", description: "used before a year, month, decade, or other period to mean near its beginning",
    fillPrompt: "The interviews took place in ___ 2024.", fillAnswer: "early",
    examples: [["They met in early 2024.", "Вони зустрілися на початку 2024 року."], ["The weather is cold in early spring.", "На початку весни погода холодна."]],
  },
  {
    category: "💬 Phrases & patterns", icon: "👥", word: "a bunch of people or things", ipaUs: "/ə bʌntʃ əv ˈpiːpəl ɔːr θɪŋz/",
    translation: "купа; група людей або речей", description: "an informal expression meaning a group or a fairly large number of people or things",
    fillPrompt: "A ___ reporters waited outside.", fillAnswer: "bunch of",
    examples: [["A bunch of friends came over.", "До мене прийшла компанія друзів."], ["I have a bunch of emails to answer.", "Мені треба відповісти на купу листів."]],
    accepted: ["a bunch of"],
  },
  {
    category: "💬 Phrases & patterns", icon: "⚖️", word: "to do something in a legal way", ipaUs: "/tə duː ˈsʌmθɪŋ ɪn ə ˈliːɡəl weɪ/",
    translation: "зробити щось законним способом", description: "to act while following the law and the proper legal procedure",
    fillPrompt: "They wanted ___ without breaking any rules.",
    examples: [["We must solve this in a legal way.", "Ми повинні вирішити це законним способом."], ["There is a way to do it legally.", "Є спосіб зробити це законно."]],
    accepted: ["do something in a legal way", "to do it in a legal way"],
  },
  {
    category: "💬 Phrases & patterns", icon: "🚨", word: "to do something in an illegal way", ipaUs: "/tə duː ˈsʌmθɪŋ ɪn ən ɪˈliːɡəl weɪ/",
    translation: "зробити щось незаконним способом", description: "to act in a way that breaks the law",
    fillPrompt: "The money was transferred ___.", fillAnswer: "in an illegal way",
    examples: [["They obtained the records in an illegal way.", "Вони отримали записи незаконним способом."], ["Doing it illegally could lead to charges.", "Незаконні дії можуть призвести до звинувачень."]],
    accepted: ["to do something in an illegal way", "illegally"],
  },
];

const lexisSource = `TYPE: LEXIS
TITLE: Part 9 · Lexis
INTRO: Five patterns from the interview: manner, causation, degree, future in the past, and subject versus object questions.

ITEM: to do something in some way
ICON: 🛠️
TR: зробити щось певним способом
SENSE: Use in + adjective + way to explain how an action is performed.
PATTERN: do something in a legal / different / careful way
EX: We need to solve it in a legal way. | Нам потрібно вирішити це законним способом.
EX: She explained the idea in a simple way. | Вона пояснила ідею простим способом.
NOTE: You can often replace in a ... way with an adverb: in a legal way = legally.

ITEM: make somebody do something
ICON: 🕹️
TR: змусити когось щось зробити
SENSE: Make expresses causation or pressure. The next verb has no to.
PATTERN: make + person + bare infinitive
EX: They made him apologize. | Вони змусили його вибачитися.
EX: The story made everyone laugh. | Історія змусила всіх засміятися.
NOTE: Not “make somebody to do”. In the passive, to returns: He was made to apologize.

ITEM: pretty + adjective
ICON: 🎚️
TR: досить + прикметник
SENSE: In informal English, pretty can be an adverb meaning fairly or quite.
PATTERN: pretty + adjective
EX: The information is pretty public. | Ця інформація доволі публічна.
EX: The task was pretty difficult. | Завдання було досить складним.
NOTE: Here pretty does not mean beautiful.

ITEM: would · future in the past
ICON: ⏩
TR: майбутнє з погляду минулого
SENSE: Would describes an event that was still in the future at an earlier past moment.
PATTERN: past reporting verb + (that) + subject + would + verb
EX: He said that Ukraine would not join NATO. | Він сказав, що Україна не вступатиме до НАТО.
EX: I knew they would arrive late. | Я знав, що вони приїдуть пізно.
NOTE: In direct speech, will usually becomes would after a past reporting verb.

ITEM: who vs whom
ICON: 👤
TR: хто проти кого / кому
SENSE: Who is normally the subject. Whom is the formal object form and is common after a preposition.
PATTERN: who + verb / whom + subject + verb / preposition + whom
EX: Who changed his mind? | Хто змінив його думку?
EX: Whom did he want to influence? | На кого він хотів вплинути?
NOTE: In everyday speech, who often replaces whom. After a fronted preposition, whom is standard: To whom was the interview given?

CONTRAST: who | whom | subject: who did it? | object: whom did you see?
TRAP: ❌ Whom changed the plan? ✅ Who changed the plan.`;

const [parsedLexis] = parseLexisDocuments(lexisSource);
if (!parsedLexis) throw new Error("Could not parse Part 9 lexis");

const transcriptParts = [
  {
    speaker: "Mendel",
    text: "Once I was in this very **weird** situation—I was in many **weird** situations with Zelensky; it's just a norm. But there was this situation where there was his friend from 95th Kvartal and Zelensky. We were three of us. I don't know for which reason this guy started telling a very funny, **to his mind**, situation: that Olena Zelenska was running after Zelensky for eight years **to make him marry her**. And he—he was a strong guy. He didn't want to marry. Ha ha ha. It was so funny.",
  },
  {
    speaker: "Mendel",
    text: "Well, definitely Zelensky was smiling a lot, and he liked the story. I still don't understand what was funny about that. I think Zelenska is a smart person, but she **does not care** and doesn't know anything about politics, and she doesn't want—",
  },
  { speaker: "Tucker", text: "Yes." },
  { speaker: "Mendel", text: "—to be involved. She tried to stay human. I'm not sure how that **worked out** through the war." },
  { speaker: "Tucker", text: "When did you leave the country—Ukraine?" },
  { speaker: "Mendel", text: "I would prefer not to talk about that." },
  { speaker: "Tucker", text: "Okay." },
  {
    speaker: "Mendel",
    text: "I stayed in the country in 2022. We were **shelled**, by the way. When the Russians were leaving Bucha, we were **shelled**. It's just **pure luck** that they didn't hit the house where we were. My husband went to the front lines. We stayed in 2023, the majority of 2024, the beginning of 2025, and I had so many sources that were saying that Zelensky is not going to finish this war. People are going crazy there. I was going crazy. You're like in a closed cage. You're being **shelled** and bombed. You can die at any moment from a Russian drone or Russian **missile**. At the same time, you can't do anything. There are no economic **opportunities**. There is no freedom of speech. Anything you do can be **treated** in a different way. The country is full of **bans**. Everything is **banned**. There are **strange** rules, like this very **strange** rule that all the cars need to stop at 9 a.m. on the roads to listen to the anthem. If you drive and then it is 9 a.m. and there is the Ukrainian anthem, you need to stop for it. There is a really **strange** agenda, and it looks **surreal**. The country—I don't recognize Ukraine anymore.",
  },
  { speaker: "Tucker", text: "Everything is banned? What does that mean?" },
  {
    speaker: "Mendel",
    text: "Like, he uses **bans**. There is this culture that he **developed**, the culture of banning and cancelling people, **artists**, you know—",
  },
  { speaker: "Tucker", text: "Churches." },
  {
    speaker: "Mendel",
    text: "—poets, churches, writers—anything he can connect to Russia somehow. Sometimes it doesn't have any connection to Russia. It always makes us weaker. Sometimes these are Ukrainians from the past, but they used to live under the Russian Empire or **the USSR**. There is this whole culture of cancellation. He cancels bloggers or journalists—not personally, but he has this **tendency**. He has these orders. For instance, in **late 2023**, I learned from **the security service** that Zelensky collected his guys and told them that they needed to **go against** critical bloggers. At the end of—or at the **beginning of 2024**—there were purges of bloggers. Bloggers were called to **the security service**, having conversations: why they did that, why they said that, and that they would be **accused** of being pro-Russian. There was **a bunch of bloggers** that went against the war, and they said, “We don't need the borders of 1991. We want to stop this war.” And all of them were called to **a security service**. One guy needed to leave the country. He was **threatened**. Every story can become a bigger story. It can become a story with **the security service**, you see? It can become a story of **treason**. By the way, the cases of **treason** rose multiple times in four years. **Treason** is just another punishment, you see?",
  },
  { speaker: "Tucker", text: "He sounds like **a Bolshevik**." },
  { speaker: "Mendel", text: "In many ways, it feels like it's **the USSR** that we read about. In many ways, it is." },
  { speaker: "Tucker", text: "So, just to restate the question: is there any way to **get rid of** Zelensky?" },
  {
    speaker: "Mendel",
    text: "That's a good thing. You know, the problem is how **to do this in a legal way**, and who is going to be next? Who's going to fight with Zelensky on the electoral field, and how do we restore the electoral field in general, you see?",
  },
  { speaker: "Tucker", text: "Yes." },
  {
    speaker: "Mendel",
    text: "And there are so many questions there that are not being **solved** at all, and I'm not sure he wants to **solve** them. So one big question to all the Ukrainians and Westerners who have resources, who have the power, who are strong enough, is actually: how do we make it in the legal field? How do we finish this?",
  },
  { speaker: "Tucker", text: "Yes." },
  {
    speaker: "Mendel",
    text: "And that's the answer to your question: why are Ukrainians silent? Rich people are afraid of being sanctioned. By the way, it's also an **illegal** instrument that Zelensky uses. He sanctions his own citizens, and it's absolutely anti-constitutional. And people are afraid.",
  },
  { speaker: "Tucker", text: "How can you sanction your own citizens?" },
  {
    speaker: "Mendel",
    text: "Yes. He sanctions his own citizens. That's **pretty** public and on his website. I don't know—he comes up with reasons: working for Russia or whatever.",
  },
  { speaker: "Tucker", text: "And what happens when you're sanctioned?" },
  {
    speaker: "Mendel",
    text: "Your businesses can be closed, your **accounts** are frozen. The **former** president is sanctioned, so he says he cannot use his money anymore.",
  },
  {
    speaker: "Tucker",
    text: "So just to go back to something you said earlier that I should have followed up on: when you were working for Zelensky, he told Putin—I think you said it was 2019—that Ukraine **would** not join NATO. Then you fast-forward a couple of years, three years, and he's telling the world that Ukraine does plan to join NATO, which you said is impossible. But what do you think changed his mind? What changed?",
  },
  { speaker: "Mendel", text: "Well, I definitely know that he wanted **to influence** the American administration. He really did want to." },
  { speaker: "Tucker", text: "Influence the American administration in what way?" },
  {
    speaker: "Mendel",
    text: "I mean, he wanted to get something. He wanted to get some support, **friendship**, you know—to get something. I remember the interview. I remember **whom** that interview was given to when he first said, “Why are we not in NATO?” So it was a TV interview, and I was preparing messages. It had never been in the messages. We never discussed that, actually. It was not on the table at all. And he was sitting there, and the journalist asked him, “So what would you tell or ask Biden about?” And he said, “Why are we not in NATO?” I started looking at the messages, and there was no NATO thing. He just came up with that.",
  },
  {
    speaker: "Mendel",
    text: "And Zelensky is the kind of person: if you **applaud**, he's going to continue. And there were a lot of nationalists who **applauded**, who thought, “Oh, that's great stuff. Go, do it.” And so he saw the applause, he saw the reaction, and since his ratings were **dropping**, and there was positive **feedback**, he just started **pushing through this agenda**. Again, I read the book about Biden, and there was a description of the meeting in 2021. That was a few months after I left. It happened that Zelensky insisted on this NATO issue with Biden, thinking that Biden was the only obstacle to this, and if Biden said yes, then they would be in NATO. He didn't want to listen to any arguments, any facts—nothing. And then when Biden said, “Look, there is no consensus for this,” the guy said, “But NATO is an outdated organization, and it's going to fall apart. Germany and France are going to leave NATO now.” As the journalist explains, even those who really liked Zelensky were blown away by this. They thought he went too far. But this is who Zelensky is. He's always escalating. He's always **demanding**. He's always proving himself. I was talking to one guy who used to work under two or three presidents, and he told me that he tells everyone these two guys—Zelensky and Yermak—are just six-year-olds. He meant because they had been in power for six years. Now they are seven-year-olds. I myself thought that they behaved more like teenagers, but we never argued that they behaved like adults—",
  },
  { speaker: "Tucker", text: "Yeah." },
  {
    speaker: "Mendel",
    text: "—you see? So I believe that Zelensky—if that journalist who was inside the White House says that Zelensky thought Biden was weak—I believe Zelensky thought Biden was weak and that he could pressure him and get the NATO thing. Because Zelensky actually doesn't have much understanding of how things work in his own government or globally.",
  },
];

const transcript = transcriptParts.reduce<Array<{ speaker: string; text: string }>>((lines, line) => {
  const previous = lines.at(-1);
  if (previous?.speaker === line.speaker) previous.text = `${previous.text} ${line.text}`;
  else lines.push({ ...line });
  return lines;
}, []);

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
  if (/^(?:a|an) /.test(answer)) variants.add(answer.replace(/^(?:a|an) /, ""));
  return [...variants];
}

function fillExercise(id: string, title: string, entries: VocabularySeed[], optional = false): HomeworkExercise {
  const items = shuffled(entries, `${id}:items`);
  return {
    id,
    title,
    instruction: "Complete each sentence with a word or phrase from the shuffled list.",
    kind: "fill",
    optional,
    wordBank: shuffled(entries, `${id}:bank`).map((entry) => entry.fillAnswer ?? entry.word),
    items: items.map((entry): HomeworkItem => ({
      id: itemId(id, entry),
      prompt: entry.fillPrompt,
      answer: entry.fillAnswer ?? entry.word,
      accepted: acceptedFor(entry),
    })),
  };
}

function definitionExercise(id: string, title: string, entries: VocabularySeed[], optional = false): HomeworkExercise {
  return {
    id,
    title,
    instruction: "Read each description and write the exact word or phrase.",
    kind: "definition",
    optional,
    wordBank: shuffled(entries, `${id}:bank`).map((entry) => entry.word),
    items: shuffled(entries, `${id}:items`).map((entry): HomeworkItem => ({
      id: itemId(id, entry),
      prompt: entry.description,
      answer: entry.word,
      accepted: acceptedFor(entry),
    })),
  };
}

function describeExercise(id: string, title: string, entries: VocabularySeed[], optional = false): HomeworkExercise {
  return {
    id,
    title,
    instruction: "Explain every word or phrase in your own English.",
    kind: "describe",
    optional,
    items: shuffled(entries, `${id}:items`).map((entry): HomeworkItem => ({
      id: itemId(id, entry),
      prompt: entry.word,
      word: entry.word,
    })),
  };
}

const splitOrder = shuffled(vocabulary, "part-9-homework-split");
const mainWords = splitOrder.slice(0, 30);
const bonusWords = splitOrder.slice(30);

const homework: InteractiveHomeworkPlan = organizeVocabularyHomework({
  kind: "INTERACTIVE_HOMEWORK_V1",
  title: "Tucker & Mendel — Part 9 — Homework",
  intro: "Complete the three required vocabulary exercises. Bonus blocks are optional. Written and voice questions will be added later.",
  exercises: [
    fillExercise("tm9-fill-main", "Vocabulary 1 — Fill in the gaps", mainWords),
    definitionExercise("tm9-definition-main", "Vocabulary 2 — Guess by description", mainWords),
    describeExercise("tm9-describe-main", "Vocabulary 3 — Describe the words", mainWords),
    fillExercise("tm9-fill-bonus", "Bonus — Fill in the gaps", bonusWords, true),
    definitionExercise("tm9-definition-bonus", "Bonus — Guess by description", bonusWords, true),
    describeExercise("tm9-describe-bonus", "Bonus — Describe the words", bonusWords, true),
    {
      id: "tm9-written-questions",
      title: "Questions — Written answers",
      instruction: "Questions will be added later.",
      kind: "question-text",
      items: [],
    },
    {
      id: "tm9-voice-questions",
      title: "Questions — Voice answers",
      instruction: "Voice questions will be added later.",
      kind: "question-audio",
      items: [],
    },
  ],
}, vocabulary.map((entry) => ({ ...entry, examples: entry.examples.map(([en]) => ({ en })) })), { includeAllWords: true });

function validateContent() {
  if (vocabulary.length !== 43) throw new Error(`Expected 43 vocabulary entries, got ${vocabulary.length}`);
  if (new Set(vocabulary.map((entry) => entry.word.toLowerCase())).size !== vocabulary.length) {
    throw new Error("Vocabulary contains duplicate headwords");
  }
  const vocabularyHomework = homework.exercises.filter((exercise) => ["fill", "definition", "describe"].includes(exercise.kind));
  if (vocabularyHomework.some((exercise) => exercise.items.length > 8)) throw new Error("Homework group exceeds eight words");
  if (vocabularyHomework.filter((exercise) => !exercise.optional).some((exercise) => exercise.items.length !== 8)) throw new Error("Homework split is invalid");
  if (new Set(vocabularyHomework.flatMap((exercise) => exercise.items.map((item) => item.vocabularyWord))).size !== 43) throw new Error("Homework vocabulary repeats or is incomplete");
  for (const line of transcript) {
    const markers = line.text.match(/\*\*/g)?.length ?? 0;
    if (markers % 2 !== 0) throw new Error(`Broken transcript highlight in: ${line.text.slice(0, 80)}`);
  }
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
      .select({ id: lessonFolders.id })
      .from(lessonFolders)
      .where(and(eq(lessonFolders.authorId, author.id), ilike(lessonFolders.name, LEGACY_FOLDER_NAME)))
      .limit(1);
  }
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
    description: "Interview activity · Part 9 · 1:13:53–1:23:42 · censorship, legal power and NATO",
    folderId: folder.id,
    sortOrder,
    vocabNodeId: null,
    lexis: [{
      id: "tm9-lexis",
      source: lexisSource,
      title: parsedLexis.title || "Part 9 · Lexis",
      intro: parsedLexis.subtitle || null,
      blocks: parsedLexis.blocks,
      warnings: parsedLexis.warnings,
      sourceNodeId: null,
    }],
    videoUrl: VIDEO_URL,
    videoTitle: "Tucker Carlson interviews Iuliia Mendel · Part 9",
    transcript,
    questions: {
      afterVideo: [
        "Part 1 · 1:13:53–1:18:00 — Questions will be added later.",
        "Part 2 · 1:18:00–1:23:42 — Questions will be added later.",
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
    if (!id) throw new Error("Could not save Part 9");

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
      note: null,
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
      await tx.update(lessonAssignments)
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
    video: VIDEO_URL,
    homeworkExercises: homework.exercises.length,
    mainWords: 24,
    bonusWords: 19,
  }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
