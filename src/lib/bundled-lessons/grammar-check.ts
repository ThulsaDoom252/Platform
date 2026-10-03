import { randomUUID } from "node:crypto";
import { and, eq, ilike } from "drizzle-orm";
import { db } from "@/lib/db";
import { lessonAssignments, lessonUnits, lessonWords } from "@/lib/db/schema";
import {
  addRegularLessonFocusIds,
  regularSectionKey,
  type RegularLessonSection,
} from "@/lib/regular-lesson";

export type GrammarCheckWordSeed = {
  category: string;
  sectionColor: string;
  icon: string;
  word: string;
  ipaUs: string | null;
  ipaUk: string | null;
  translation: string;
  description: string;
  note: string | null;
  examples: { en: string; tr: string }[];
};

const ex = (en: string, tr: string) => ({ en, tr });
const w = (
  category: string,
  sectionColor: string,
  icon: string,
  word: string,
  translation: string,
  description: string,
  examples: { en: string; tr: string }[],
  ipaUs: string | null = null,
  note: string | null = null,
): GrammarCheckWordSeed => ({
  category,
  sectionColor,
  icon,
  word,
  ipaUs,
  ipaUk: ipaUs,
  translation,
  description,
  note,
  examples,
});

export const grammarCheckVocabulary: GrammarCheckWordSeed[] = [
  w("Adverbs", "#38bdf8", "🎲", "accidentally", "випадково", "By mistake; without planning to do it.", [ex("I accidentally broke my cup.", "Я випадково розбив свою чашку.")], "/ˌæk.sɪˈden.təl.i/"),
  w("Adverbs", "#38bdf8", "⚡", "suddenly", "раптом", "Quickly and unexpectedly.", [ex("It suddenly started to rain.", "Раптом почався дощ.")], "/ˈsʌd.ən.li/"),
  w("Adverbs", "#38bdf8", "🚨", "immediately", "негайно; одразу", "At once, without waiting.", [ex("Please call me immediately.", "Будь ласка, подзвони мені негайно.")], "/ɪˈmiː.di.ət.li/"),
  w("Adverbs", "#38bdf8", "👀", "apparently", "очевидно; мабуть", "According to what seems to be true.", [ex("Apparently, he is busy today.", "Мабуть, сьогодні він зайнятий.")], "/əˈpær.ənt.li/"),
  w("Adverbs", "#38bdf8", "🏁", "eventually", "зрештою; врешті-решт", "In the end, especially after a long time.", [ex("We eventually found the hotel.", "Зрештою ми знайшли готель.")], "/ɪˈven.tʃu.ə.li/"),
  w("Adverbs", "#38bdf8", "🍀", "fortunately / unfortunately", "на щастя / на жаль", "Used to say that a situation is lucky or unlucky.", [ex("Fortunately, we were on time.", "На щастя, ми прийшли вчасно.")], "/ˈfɔːr.tʃən.ət.li/"),
  w("Adverbs", "#38bdf8", "🤞", "hopefully", "сподіваюся", "Used to say that you hope something will happen.", [ex("Hopefully, the weather will be nice.", "Сподіваюся, погода буде гарною.")], "/ˈhoʊp.fəl.i/"),
  w("Adverbs", "#38bdf8", "🤯", "incredibly", "неймовірно", "To an unusually great degree.", [ex("This film is incredibly interesting.", "Цей фільм неймовірно цікавий.")], "/ɪnˈkred.ə.bli/"),
  w("Adverbs", "#38bdf8", "🧩", "basically", "в основному; по суті", "Used to give the most important or simple explanation.", [ex("Basically, it is very easy.", "По суті, це дуже легко.")], "/ˈbeɪ.sɪ.kəl.i/"),

  w("Story phrases", "#8b5cf6", "🎬", "It all started when…", "Усе почалося тоді, коли…", "A phrase used to introduce the beginning of a story.", [ex("It all started when I met my best friend.", "Усе почалося тоді, коли я зустрів свого найкращого друга.")], "/ɪt ɔːl ˈstɑːr.tɪd wen/", "Use It all started, not It's all started, when you tell a finished past story."),
  w("Story phrases", "#8b5cf6", "📅", "one day / once", "одного дня / одного разу", "Phrases that introduce one event in a story.", [ex("One day we went to the beach.", "Одного дня ми поїхали на пляж.")]),
  w("Story phrases", "#8b5cf6", "➡️", "then / after that / next", "потім / після цього / далі", "Words that show the order of events.", [ex("We had lunch. Then we went home.", "Ми пообідали. Потім ми пішли додому.")]),

  w("Extreme adjectives", "#f59e0b", "💡", "brilliant", "блискучий; чудовий; геніальний", "Extremely clever, skilful, or impressive.", [ex("Her idea was absolutely brilliant.", "Її ідея була просто блискучою."), ex("The team gave a brilliant performance.", "Команда виступила блискуче.")], "/ˈbrɪl.i.ənt/"),
  w("Extreme adjectives", "#f59e0b", "😋", "delicious", "дуже смачний", "Having a very pleasant taste or smell.", [ex("This soup is absolutely delicious.", "Цей суп надзвичайно смачний."), ex("We had a delicious meal at the hotel.", "У готелі ми чудово повечеряли.")], "/dɪˈlɪʃ.əs/"),
  w("Extreme adjectives", "#f59e0b", "🤩", "fascinating", "захопливий; надзвичайно цікавий", "Extremely interesting.", [ex("The documentary was fascinating.", "Документальний фільм був захопливим."), ex("She told us a fascinating story.", "Вона розповіла нам надзвичайно цікаву історію.")], "/ˈfæs.ə.neɪ.tɪŋ/"),
  w("Extreme adjectives", "#f59e0b", "😂", "hilarious", "надзвичайно смішний", "Extremely funny.", [ex("The comedian was hilarious.", "Комік був надзвичайно смішним."), ex("We watched a hilarious video.", "Ми подивилися дуже кумедне відео.")], "/hɪˈler.i.əs/"),
  w("Extreme adjectives", "#f59e0b", "🌟", "stunning", "приголомшливий; надзвичайно красивий", "Extremely beautiful or impressive.", [ex("The view from the mountain was stunning.", "Краєвид з гори був приголомшливим."), ex("She looked stunning in that dress.", "У тій сукні вона мала приголомшливий вигляд.")], "/ˈstʌn.ɪŋ/"),
  w("Extreme adjectives", "#f59e0b", "✨", "wonderful", "чудовий; прекрасний", "Very good and enjoyable.", [ex("We had a wonderful holiday by the sea.", "Ми чудово провели відпустку біля моря."), ex("It's wonderful to see you again.", "Чудово знову тебе бачити.")], "/ˈwʌn.dɚ.fəl/"),
  w("Extreme adjectives", "#ef4444", "😖", "awful", "жахливий; дуже поганий", "Extremely bad or unpleasant.", [ex("The weather was awful all weekend.", "Погода була жахливою всі вихідні."), ex("I had an awful headache yesterday.", "Учора в мене страшенно боліла голова.")], "/ˈɑː.fəl/"),
  w("Extreme adjectives", "#ef4444", "😫", "exhausted", "виснажений; украй стомлений", "Extremely tired.", [ex("I was exhausted after the long journey.", "Я був виснажений після довгої подорожі."), ex("She felt exhausted by the end of the day.", "Наприкінці дня вона почувалася вкрай стомленою.")], "/ɪɡˈzɑː.stɪd/"),
  w("Extreme adjectives", "#ef4444", "😡", "furious", "лютий; розлючений", "Extremely angry.", [ex("He was furious about the cancelled flight.", "Він був розлючений через скасований рейс."), ex("My manager will be furious if we miss the deadline.", "Мій керівник буде в люті, якщо ми не вкладемося в термін.")], "/ˈfjʊr.i.əs/"),
  w("Extreme adjectives", "#ef4444", "😱", "terrified", "дуже наляканий", "Extremely frightened.", [ex("She was terrified of flying.", "Вона панічно боялася літати."), ex("The children were terrified by the loud explosion.", "Діти були налякані гучним вибухом.")], "/ˈter.ə.faɪd/"),
  w("Extreme adjectives", "#14b8a6", "🐘", "huge", "величезний; гігантський", "Extremely large.", [ex("They live in a huge house.", "Вони живуть у величезному будинку."), ex("The project was a huge success.", "Проєкт мав величезний успіх.")], "/hjuːdʒ/"),
  w("Extreme adjectives", "#14b8a6", "🐜", "tiny", "крихітний; дуже маленький", "Extremely small.", [ex("The room was tiny but comfortable.", "Кімната була крихітною, але затишною."), ex("A tiny insect landed on my hand.", "Крихітна комаха сіла мені на руку.")], "/ˈtaɪ.ni/"),

  w("Mixed vocabulary", "#10b981", "🐦", "bee hummingbird", "колібрі-бджілка", "The smallest bird in the world, native to Cuba.", [ex("The bee hummingbird is the smallest bird in the world.", "Колібрі-бджілка — найменший птах у світі."), ex("The bee hummingbird lives in Cuba.", "Колібрі-бджілка живе на Кубі.")]),
  w("Mixed vocabulary", "#10b981", "🦣", "behemoth", "велетень; гігант; щось величезне", "A very large and powerful thing.", [ex("The new cruise ship is a behemoth.", "Новий круїзний лайнер — справжній гігант."), ex("The company has become a global tech behemoth.", "Компанія стала світовим технологічним гігантом.")], "/bɪˈhiː.məθ/"),
  w("Mixed vocabulary", "#10b981", "🪲", "cockchafer", "хрущ; травневий жук", "A large brown beetle seen in late spring.", [ex("A cockchafer flew into the room.", "Хрущ залетів до кімнати."), ex("Cockchafers are often seen in late spring.", "Хрущів часто можна побачити наприкінці весни.")], "/ˈkɑːkˌtʃeɪ.fɚ/"),
  w("Mixed vocabulary", "#10b981", "📅", "events", "події; заходи", "Things that happen, especially planned public activities.", [ex("The festival includes events for children.", "Фестиваль включає заходи для дітей."), ex("Recent events changed our plans.", "Нещодавні події змінили наші плани.")], "/ɪˈvents/"),
  w("Mixed vocabulary", "#10b981", "🗣️", "gossip", "плітки; пліткування", "Informal talk about other people's private lives.", [ex("I don't listen to office gossip.", "Я не слухаю офісних пліток."), ex("The gossip spread quickly.", "Плітки швидко поширилися.")], "/ˈɡɑː.səp/"),
  w("Mixed vocabulary", "#10b981", "🚢", "ship", "корабель; судно", "A large boat that carries people or goods.", [ex("The ship left the harbour at dawn.", "Корабель вийшов із гавані на світанку."), ex("We watched the cargo ship cross the bay.", "Ми спостерігали, як вантажне судно перетинало затоку.")], "/ʃɪp/"),
  w("Mixed vocabulary", "#10b981", "☀️", "warmth", "тепло; теплота; душевність", "A comfortable heat or a friendly feeling.", [ex("I could feel the warmth of the sun.", "Я відчував тепло сонця."), ex("She spoke with warmth and kindness.", "Вона говорила тепло й доброзичливо.")], "/wɔːrmθ/"),
  w("Mixed vocabulary", "#10b981", "🍩", "cream-filled", "наповнений кремом", "Containing cream inside.", [ex("We ordered cream-filled doughnuts.", "Ми замовили пончики з кремовою начинкою."), ex("This cream-filled pastry is delicious.", "Це тістечко з кремовою начинкою дуже смачне.")], "/ˈkriːm.fɪld/"),
  w("Mixed vocabulary", "#10b981", "😊", "more smiley", "більш усміхнений; привітніший", "Looking happier and smiling more; informal.", [ex("She looks more smiley in this photo.", "На цьому фото вона виглядає більш усміхненою."), ex("The new character is more smiley and friendly.", "Новий персонаж більш усміхнений і привітний.")]),
  w("Mixed vocabulary", "#10b981", "👀", "to notice", "помічати; зауважувати", "To see or become aware of something.", [ex("I noticed a small mistake in the report.", "Я помітив невелику помилку у звіті."), ex("Did you notice how quiet the room became?", "Ти помітив, як тихо стало в кімнаті?")], "/ˈnoʊ.t̬ɪs/"),
  w("Mixed vocabulary", "#10b981", "⏰", "to remind", "нагадувати", "To help someone remember something.", [ex("Please remind me to call the doctor.", "Будь ласка, нагадай мені зателефонувати лікарю."), ex("This song reminds me of my childhood.", "Ця пісня нагадує мені про моє дитинство.")], "/rɪˈmaɪnd/"),
  w("Mixed vocabulary", "#10b981", "🛌", "to rest", "відпочивати; перепочити", "To relax and recover your energy.", [ex("You should rest after the journey.", "Тобі варто відпочити після подорожі."), ex("We stopped to rest under a tree.", "Ми зупинилися, щоб перепочити під деревом.")], "/rest/"),
  w("Mixed vocabulary", "#10b981", "👫", "a couple", "пара; двоє; кілька", "Two people or things; informally, a small number.", [ex("I saw a couple walking by the river.", "Я бачив пару, яка гуляла біля річки."), ex("We need a couple more chairs.", "Нам потрібно ще кілька стільців.")]),
  w("Mixed vocabulary", "#10b981", "📆", "a couple of days", "кілька днів; пара днів", "Two or a few days.", [ex("I'll finish it in a couple of days.", "Я закінчу це за кілька днів."), ex("We stayed there for a couple of days.", "Ми пробули там кілька днів.")]),
  w("Mixed vocabulary", "#10b981", "✨", "doubt my powers", "сумніватися в моїх силах", "To be unsure about my abilities.", [ex("Don't doubt my powers.", "Не сумнівайся в моїх силах."), ex("They doubted my powers at first.", "Спочатку вони сумнівалися в моїх здібностях.")]),
  w("Mixed vocabulary", "#10b981", "💚", "to appreciate", "цінувати", "To recognize the value of something and be thankful for it.", [ex("I really appreciate your help.", "Я дуже ціную твою допомогу."), ex("She appreciates honest feedback.", "Вона цінує чесні відгуки.")], "/əˈpriː.ʃi.eɪt/", "Usually appreciate a thing or action: I appreciate your help. A short thank-you is I appreciate it."),
  w("Mixed vocabulary", "#10b981", "⏳", "to last", "тривати; вистачати", "To continue for a period of time.", [ex("The meeting lasted two hours.", "Нарада тривала дві години."), ex("These batteries last for a long time.", "Цих батарейок вистачає надовго.")], "/læst/", "Say It lasted an hour or It lasted for an hour."),
  w("Mixed vocabulary", "#10b981", "🎭", "actors", "актори; учасники", "People who perform, or important participants in a process.", [ex("The actors took a bow after the show.", "Після вистави актори вийшли на уклін."), ex("Many actors are involved in the peace process.", "У мирному процесі беруть участь багато сторін.")], "/ˈæk.tɚz/"),
  w("Mixed vocabulary", "#10b981", "⚖️", "judge", "суддя; судити", "A person who decides legal cases; also, to form an opinion.", [ex("The judge sentenced him to five years.", "Суддя засудив його до п'яти років."), ex("Don't judge people by their appearance.", "Не суди людей за зовнішністю.")], "/dʒʌdʒ/", "Common patterns: judge by something; judging by something."),
  w("Mixed vocabulary", "#10b981", "🌐", "sphere", "сфера", "An area of activity or knowledge.", [ex("She has experience in the sphere of education.", "Вона має досвід у сфері освіти."), ex("IT is a fast-growing sphere.", "IT — сфера, що швидко зростає.")], "/sfɪr/", "In everyday work English, field or area is often more natural. The letters ph sound like /f/."),

  w("Reactions", "#ec4899", "🤨", "Are you serious?", "Ти серйозно?", "A reaction showing surprise or doubt.", [ex("Are you serious? You want to move next week?", "Ти серйозно? Хочеш переїхати наступного тижня?")]),
  w("Reactions", "#ec4899", "😲", "No way!", "Не може бути!; Нізащо!", "A strong reaction of surprise or refusal.", [ex("You won the competition? No way!", "Ти виграв змагання? Не може бути!"), ex("No way! I'm not lending you my car.", "Нізащо! Я не позичу тобі машину.")], null, "The meaning depends on context: surprise or a strong refusal."),
  w("Reactions", "#ec4899", "❓", "That can't be right!", "Тут щось не так!", "Used when information seems wrong.", [ex("The bill is two hundred pounds? That can't be right!", "Рахунок на двісті фунтів? Тут щось не так!")]),
  w("Reactions", "#ec4899", "🧾", "They must have made a mistake.", "Вони, мабуть, припустилися помилки.", "A strong logical conclusion about a past action.", [ex("My name is missing. They must have made a mistake.", "Мого імені немає. Вони, мабуть, припустилися помилки.")], null, "Must have + past participle is a conclusion about the past, not an obligation."),
  w("Reactions", "#ec4899", "😳", "You can't be serious!", "Та ти жартуєш!", "A strong reaction of disbelief.", [ex("That phone costs more than my laptop. You can't be serious!", "Той телефон дорожчий за ноутбук. Та ти жартуєш!")]),
  w("Reactions", "#ec4899", "🙃", "You must be joking!", "Ти, мабуть, жартуєш!", "Used when something sounds unbelievable.", [ex("We cannot finish this today. You must be joking!", "Ми не можемо закінчити це сьогодні. Та ти жартуєш!")]),
  w("Reactions", "#ec4899", "😵", "You must be kidding me!", "Ти що, жартуєш?!", "A very informal reaction to surprising or annoying news.", [ex("The train has been cancelled again? You must be kidding me!", "Потяг знову скасували? Ти що, жартуєш?!")]),
  w("Reactions", "#ec4899", "🤩", "That's amazing!", "Це неймовірно!", "A strong positive reaction.", [ex("You built this yourself? That's amazing!", "Ти зробив це сам? Це неймовірно!")]),
  w("Reactions", "#ec4899", "😂", "That's hilarious!", "Це дуже смішно!", "A reaction to something extremely funny.", [ex("Your cat fell asleep in a shoe? That's hilarious!", "Твій кіт заснув у черевику? Це дуже смішно!")]),
  w("Reactions", "#ec4899", "🙄", "That's (so) lame!", "Це відстій!; Це так банально!", "An informal negative reaction to something weak or disappointing.", [ex("Another excuse? That's so lame!", "Ще одна відмовка? Це так банально!")], null, "Here lame is informal and dismissive, not the literal word for difficulty walking."),
  w("Reactions", "#ec4899", "😤", "That's (so) ridiculous!", "Це безглуздо!", "A reaction to something unreasonable or absurd.", [ex("They charge extra for tap water? That's ridiculous!", "Вони беруть додаткову плату за воду? Це безглуздо!")]),

  w("Goals & progress", "#6366f1", "🎯", "to set a goal", "ставити мету", "To decide on something you want to achieve.", [ex("I set a goal to improve my English.", "Я поставив собі за мету покращити англійську."), ex("Set a realistic goal for this month.", "Постав реалістичну мету на цей місяць.")]),
  w("Goals & progress", "#6366f1", "📌", "to set priorities", "визначати; розставляти пріоритети", "To decide which tasks are most important.", [ex("We need to set priorities before we begin.", "Нам потрібно визначити пріоритети перед початком роботи."), ex("She sets her priorities carefully.", "Вона ретельно розставляє пріоритети.")]),
  w("Goals & progress", "#6366f1", "🏅", "to achieve", "досягати", "To succeed in reaching a goal.", [ex("She worked hard to achieve her goal.", "Вона наполегливо працювала, щоб досягти своєї мети."), ex("The team achieved excellent results.", "Команда досягла чудових результатів.")], "/əˈtʃiːv/"),
  w("Goals & progress", "#6366f1", "📈", "to improve", "покращувати(ся)", "To make or become better.", [ex("I want to improve my pronunciation.", "Я хочу покращити свою вимову."), ex("Her health has improved.", "Її здоров’я покращилося.")], "/ɪmˈpruːv/"),
  w("Goals & progress", "#6366f1", "💬", "to express", "висловлювати; виражати", "To show a thought or feeling in words or actions.", [ex("He finds it difficult to express his feelings.", "Йому важко висловлювати свої почуття."), ex("She expressed her opinion clearly.", "Вона чітко висловила свою думку.")], "/ɪkˈspres/"),
  w("Goals & progress", "#6366f1", "✅", "to complete", "завершувати; виконувати", "To finish something.", [ex("Please complete the task by Friday.", "Будь ласка, заверши завдання до п’ятниці."), ex("He completed the course successfully.", "Він успішно закінчив курс.")], "/kəmˈpliːt/"),
  w("Success & failure", "#22c55e", "🎓", "to graduate", "закінчувати навчальний заклад", "To successfully finish school or university.", [ex("She graduated from university last year.", "Вона закінчила університет минулого року."), ex("He hopes to graduate in June.", "Він сподівається випуститися в червні.")], "/ˈɡrædʒ.u.eɪt/"),
  w("Success & failure", "#22c55e", "🥇", "to win", "перемагати; вигравати", "To be the best in a game, competition, or election.", [ex("Our team won the match.", "Наша команда виграла матч."), ex("She wants to win the competition.", "Вона хоче перемогти у змаганні.")], "/wɪn/"),
  w("Success & failure", "#22c55e", "🌱", "to grow", "рости; зростати; розвиватися", "To become bigger, older, or more developed.", [ex("The company continues to grow.", "Компанія продовжує зростати."), ex("Children grow very quickly.", "Діти ростуть дуже швидко.")], "/ɡroʊ/"),
  w("Success & failure", "#22c55e", "❌", "to fail", "зазнати невдачі; провалитися", "To be unsuccessful.", [ex("He failed the exam.", "Він не склав іспит."), ex("The plan failed because of poor preparation.", "План провалився через погану підготовку.")], "/feɪl/"),
  w("Success & failure", "#22c55e", "🏆", "to succeed", "досягати успіху", "To achieve the result you wanted.", [ex("You will succeed if you keep trying.", "Ти досягнеш успіху, якщо продовжуватимеш старатися."), ex("She succeeded in finding a solution.", "Їй вдалося знайти рішення.")], "/səkˈsiːd/", "The common pattern is succeed in doing something."),
  w("Success & failure", "#22c55e", "📋", "to carry out", "виконувати; здійснювати", "To do and complete a plan, task, order, or test.", [ex("The team carried out the plan successfully.", "Команда успішно здійснила план."), ex("Scientists carried out several tests.", "Науковці провели кілька випробувань.")], null, "Carry out is common with a plan, task, order, experiment, or research."),
  w("Success & failure", "#22c55e", "💡", "to realize", "усвідомлювати; здійснювати", "To understand something clearly, or make a dream real.", [ex("She realized her dream of becoming a doctor.", "Вона здійснила свою мрію стати лікаркою."), ex("I realized that I had made a mistake.", "Я усвідомив, що припустився помилки.")], "/ˈriː.ə.laɪz/"),
  w("Success & failure", "#22c55e", "🧗", "to overcome", "долати; подолати", "To successfully deal with a problem or difficulty.", [ex("She overcame many difficulties.", "Вона подолала багато труднощів."), ex("We can overcome this problem together.", "Ми можемо разом подолати цю проблему.")], "/ˌoʊ.vɚˈkʌm/"),
  w("Success idioms", "#a855f7", "🍎", "to bear fruit", "приносити плоди; давати результат", "To begin producing successful results.", [ex("Their hard work finally bore fruit.", "Їхня наполеглива праця нарешті дала плоди."), ex("The new strategy is beginning to bear fruit.", "Нова стратегія починає давати результат.")]),
  w("Success idioms", "#a855f7", "🌌", "the sky's the limit", "можливості безмежні", "There is no limit to what someone can achieve.", [ex("Work hard — the sky's the limit.", "Працюй наполегливо — твої можливості безмежні."), ex("With this talent, the sky's the limit for her.", "З таким талантом для неї немає меж.")]),
  w("Success idioms", "#a855f7", "⚾", "to hit a home run", "досягти блискучого успіху", "To achieve an especially successful result.", [ex("The campaign hit a home run with young voters.", "Кампанія мала величезний успіх серед молодих виборців."), ex("His presentation really hit a home run.", "Його презентація мала блискучий успіх.")], null, "Home run is written as two words."),
  w("Success idioms", "#a855f7", "🐎", "to back the wrong horse", "підтримати програшну сторону", "To support a person or choice that later fails.", [ex("The company backed the wrong horse and lost money.", "Компанія підтримала програшний варіант і втратила гроші."), ex("I think we backed the wrong horse.", "Думаю, ми підтримали не того кандидата.")]),
  w("Success idioms", "#a855f7", "🛑", "to spike someone's guns", "зірвати чиїсь плани", "To prevent someone from succeeding or using their strongest argument.", [ex("The announcement spiked our competitors' guns.", "Оголошення зірвало плани наших конкурентів."), ex("The new evidence spiked the lawyer's guns.", "Нові докази позбавили адвоката його головних аргументів.")]),
];

type FillItem = { prompt: string; answer: string };

function checkedSection(
  id: string,
  title: string,
  items: FillItem[],
  options: { instruction?: string; translation?: boolean } = {},
): RegularLessonSection {
  const instruction = options.instruction ?? "Open the brackets.";
  const listClass = options.translation ? "sentence-check translation-check" : "sentence-check";
  const studentItems = items.map(({ prompt }) =>
    `<li>${prompt.replace("___", '<span class="blank"></span>')}</li>`,
  ).join("");
  const teacherItems = items.map(({ prompt, answer }) =>
    `<li>${prompt.replace("___", `<span class="ans">${answer}</span>`)}</li>`,
  ).join("");
  const studentHtml = `<p class="instr">${instruction}</p><ol class="${listClass}">${studentItems}</ol>`;
  const teacherHtml = `<p class="instr">${instruction}</p><ol class="${listClass}">${teacherItems}</ol>`;
  return {
    id,
    title,
    tone: "exercise",
    studentHtml: addRegularLessonFocusIds(studentHtml),
    teacherHtml: addRegularLessonFocusIds(teacherHtml),
    defaultOpen: false,
  };
}

export const grammarCheckSections: RegularLessonSection[] = [
  {
    id: "01-vocabulary",
    title: "📖 Vocabulary",
    tone: "vocab",
    studentHtml: "",
    teacherHtml: "",
    defaultOpen: true,
  },
  checkedSection("02-present", "Present Simple vs Present Continuous", [
    { prompt: "She usually ___ her priorities before work. (set)", answer: "sets" },
    { prompt: "Look! The actors ___ onto the stage now. (walk)", answer: "are walking" },
    { prompt: "I often ___ honest feedback. (appreciate)", answer: "appreciate" },
    { prompt: "The ship ___ the harbour at the moment. (leave)", answer: "is leaving" },
    { prompt: "Apparently, he ___ on a huge project this month. (work)", answer: "is working" },
    { prompt: "This battery usually ___ for a couple of days. (last)", answer: "lasts" },
    { prompt: "Why ___ at that hilarious video now? (you / laugh)", answer: "are you laughing" },
    { prompt: "My sister always ___ small mistakes immediately. (notice)", answer: "notices" },
  ]),
  checkedSection("03-past", "Past Simple vs Past Continuous", [
    { prompt: "I accidentally ___ my cup yesterday. (break)", answer: "broke" },
    { prompt: "While we ___, a cockchafer flew into the room. (talk)", answer: "were talking" },
    { prompt: "She ___ exhausted after the event. (feel)", answer: "felt" },
    { prompt: "The actors ___ when the lights suddenly went out. (perform)", answer: "were performing" },
    { prompt: "Did you ___ the tiny bird near the window? (notice)", answer: "notice" },
    { prompt: "The ship ___ the bay when the storm started. (cross)", answer: "was crossing" },
    { prompt: "We eventually ___ the right hotel. (find)", answer: "found" },
    { prompt: "He ___ office gossip when the manager came in. (discuss)", answer: "was discussing" },
  ]),
  checkedSection("04-mixed-tenses", "Present & Past — Mixed", [
    { prompt: "Our team sometimes ___ difficult competitions. (win)", answer: "wins" },
    { prompt: "They ___ out the plan right now. (carry)", answer: "are carrying" },
    { prompt: "One day, she ___ a realistic goal. (set)", answer: "set" },
    { prompt: "I ___ the warmth of the sun while I was resting. (feel)", answer: "felt" },
    { prompt: "The company ___ quickly these days. (grow)", answer: "is growing" },
    { prompt: "She sometimes ___ prizes at local events. (win)", answer: "wins" },
    { prompt: "When I called, he ___ his idea to the judge. (express)", answer: "was expressing" },
    { prompt: "She ___ the task immediately after lunch yesterday. (complete)", answer: "completed" },
  ]),
  checkedSection("05-good-well", "Good vs Well — Basics", [
    { prompt: "The cream-filled cake tastes very ___. (well)", answer: "good" },
    { prompt: "The actors performed ___. (good)", answer: "well" },
    { prompt: "Fortunately, I slept ___ last night. (good)", answer: "well" },
    { prompt: "That is a ___ plan. (well)", answer: "good" },
    { prompt: "She speaks English very ___. (good)", answer: "well" },
    { prompt: "The soup smells ___. (good)", answer: "good" },
  ], { instruction: "Choose good or well." }),
  checkedSection("06-infinitive", "Infinitive vs No Infinitive", [
    { prompt: "I want ___ my pronunciation. (improve)", answer: "to improve" },
    { prompt: "We need ___ our priorities before Monday. (set)", answer: "to set" },
    { prompt: "She would like ___ her opinion. (express)", answer: "to express" },
    { prompt: "They plan ___ from university next year. (graduate)", answer: "to graduate" },
    { prompt: "Do you want me ___ you about the meeting? (remind)", answer: "to remind" },
    { prompt: "I plan ___ for a couple of days. (rest)", answer: "to rest" },
    { prompt: "We can ___ this problem together. (overcome)", answer: "overcome" },
    { prompt: "You must ___ priorities immediately. (set)", answer: "set" },
  ]),
  checkedSection("07-translation", "Translate into English", [
    { prompt: "Я випадково розбив чашку вчора. → ___", answer: "I accidentally broke my cup yesterday." },
    { prompt: "Зараз актори виступають дуже добре. → ___", answer: "The actors are performing very well now." },
    { prompt: "Учора корабель перетинав затоку, коли почався шторм. → ___", answer: "Yesterday the ship was crossing the bay when the storm started." },
    { prompt: "Я хочу покращити англійську і поставити нову мету. → ___", answer: "I want to improve my English and set a new goal." },
    { prompt: "Зрештою ми виконали план. → ___", answer: "We eventually carried out the plan." },
    { prompt: "Вона зазвичай одразу помічає маленькі помилки. → ___", answer: "She usually notices small mistakes immediately." },
    { prompt: "Вони планують відпочити кілька днів. → ___", answer: "They plan to rest for a couple of days." },
    { prompt: "Мабуть, ця блискуча ідея вже приносить плоди. → ___", answer: "Apparently, this brilliant idea is already bearing fruit." },
  ], { instruction: "Translate each sentence into English.", translation: true }),
  {
    id: "08-speaking-one",
    title: "🎙️ Speaking 1 — My day and plans",
    tone: "dialogue",
    studentHtml: "",
    teacherHtml: "",
    defaultOpen: false,
    voiceExercise: {
      instruction: "Answer the questions in one voice message. Keep your sentences simple and clear.",
      prompts: [
        "What makes you happy every day?",
        "When did you wake up today?",
        "What did you do after that?",
        "Are you working today? If yes, when?",
        "What do you plan to do this Sunday?",
        "What do you need to do next week?",
      ],
      maxSeconds: 600,
    },
  },
  {
    id: "09-speaking-story",
    title: "🎧 Speaking 2 — A short story",
    tone: "dialogue",
    studentHtml: "",
    teacherHtml: "",
    defaultOpen: false,
    voiceExercise: {
      instruction: "Record one short A2 story. Use at least five words or phrases from the lesson.",
      prompts: [
        "Start with: It all started when…",
        "Say what happened first, then, and eventually.",
        "Describe how you felt.",
        "Finish with the result or what you plan to do next.",
      ],
      maxSeconds: 600,
    },
  },
];

/** Installs the bundled Grammar Check lesson into the database used by the running app. */
export async function installGrammarCheckLesson(authorId: string) {
  return db.transaction(async (tx) => {
    const [existing] = await tx
      .select({ id: lessonUnits.id })
      .from(lessonUnits)
      .where(and(eq(lessonUnits.authorId, authorId), ilike(lessonUnits.title, "Grammar Check")))
      .limit(1);

    const unitValues = {
      kind: "REGULAR" as const,
      title: "Grammar Check",
      description:
        "A2 grammar review · tenses, good vs well, infinitives, translation and native voice practice",
      vocabNodeId: null,
      lexis: null,
      videoUrl: null,
      videoTitle: null,
      transcript: [],
      questions: { afterVideo: [], afterReading: [] },
      homework: [],
      activityIds: [],
      sections: grammarCheckSections,
      updatedAt: new Date(),
    };

    const unitId = existing?.id
      ? (await tx
          .update(lessonUnits)
          .set(unitValues)
          .where(eq(lessonUnits.id, existing.id))
          .returning({ id: lessonUnits.id }))[0]?.id
      : (await tx
          .insert(lessonUnits)
          .values({ id: randomUUID(), authorId, ...unitValues })
          .returning({ id: lessonUnits.id }))[0]?.id;
    if (!unitId) throw new Error("Could not save Grammar Check lesson");

    await tx.delete(lessonWords).where(eq(lessonWords.unitId, unitId));
    await tx.insert(lessonWords).values(
      grammarCheckVocabulary.map((entry, index) => ({
        id: randomUUID(),
        unitId,
        ...entry,
        imageUrl: null,
        sortOrder: index + 1,
      })),
    );

    const assignments = await tx
      .select({ id: lessonAssignments.id, openSections: lessonAssignments.openSections })
      .from(lessonAssignments)
      .where(eq(lessonAssignments.unitId, unitId));
    for (const assignment of assignments) {
      const openSections = new Set(assignment.openSections ?? []);
      openSections.add(regularSectionKey("01-vocabulary"));
      await tx
        .update(lessonAssignments)
        .set({ openSections: [...openSections], updatedAt: new Date() })
        .where(eq(lessonAssignments.id, assignment.id));
    }

    return unitId;
  });
}
