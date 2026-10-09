import type { HomeworkExercise, InteractiveHomeworkPlan } from "../lesson-homework";
import type { LessonWord } from "../lesson-unit";
import { addRegularLessonFocusIds, normalizeRegularLessonSections, type RegularLessonSection, type RegularLessonTone } from "../regular-lesson";
import { organizeVocabularyHomework } from "../vocabulary-homework";

export const HOUSEHOLD_CHORES_LESSON_TITLE = "A2 · Household chores";
type WordContent = Omit<LessonWord, "id">;
type Seed = [string, string, string, string, string, string, string, string, string];

// Original definitions/examples. Native LessonVocab supplies internal audio
// and hidden-by-default translation, definition, example and tip controls.
const vocabulary: Seed[] = [
  ["household chores", "домашні справи / хатня робота", "🏠", "/ˈhaʊs.hoʊld tʃɔːrz/", "/ˈhaʊs.həʊld tʃɔːz/", "Small jobs that you do regularly to keep your home clean and organised.", "Множина: chores. do household chores / do the housework, не make chores. Housework — незлічуване, а a chore — одна справа.", "We share the household chores at home.", "Ми ділимо домашні справи вдома."],
  ["to tidy up", "прибирати / наводити порядок", "🧸", "/ˈtaɪ.di ʌp/", "/ˈtaɪ.di ʌp/", "To put things in the right places so a room looks organised.", "tidy up your room — прибрати кімнату. Це навести порядок, а не обов'язково вимити все. tidy → tidied; tidying.", "I tidy up my room every evening.", "Я прибираю свою кімнату щовечора."],
  ["to make the bed", "застеляти ліжко", "🛏️", "/meɪk ðə bed/", "/meɪk ðə bed/", "To put the sheets and covers neatly on a bed after you get up.", "make the bed, не do the bed. make → made → made. my bed / your bed — теж правильно: I make my bed.", "I make the bed after breakfast.", "Я застеляю ліжко після сніданку."],
  ["to do the dishes", "мити посуд", "🍽️", "/duː ðə ˈdɪʃ.ɪz/", "/duː ðə ˈdɪʃ.ɪz/", "To wash plates, cups and other things after a meal.", "US: do the dishes. UK: do the washing-up. wash the dishes — теж правильно. do → did → done.", "We do the dishes after dinner.", "Ми миємо посуд після вечері."],
  ["to do the laundry", "прати білизну / одяг", "🧺", "/duː ðə ˈlɑːn.dri/", "/duː ðə ˈlɔːn.dri/", "To wash dirty clothes, usually in a washing machine.", "do the laundry / do the washing. laundry — незлічуване. laundry — прання, dishes — посуд; не плутай ці справи.", "I do the laundry on Sundays.", "Я перу одяг щонеділі."],
  ["to vacuum the floor", "пилососити підлогу", "🧹", "/ˈvæk.juːm ðə flɔːr/", "/ˈvæk.juːm ðə flɔː/", "To clean the floor with a machine that sucks up dust and dirt.", "vacuum — і дієслово, і назва пилососа. Дві літери u: vacuum. vacuum the carpet — пилососити килим.", "We vacuum the floor every Saturday.", "Ми пилососимо підлогу щосуботи."],
  ["to sweep the floor", "підмітати підлогу", "🧹", "/swiːp ðə flɔːr/", "/swiːp ðə flɔː/", "To clean the floor by moving dirt with a broom.", "sweep → swept → swept. sweep — віником; vacuum — пилососом; mop — вологою шваброю.", "Please sweep the floor before you mop it.", "Будь ласка, підмети підлогу перед тим, як мити її шваброю."],
  ["to mop the floor", "мити підлогу шваброю", "🪣", "/mɑːp ðə flɔːr/", "/mɒp ðə flɔː/", "To clean the floor with water and a tool with a long handle.", "mop → mopped; mopping: подвоюємо p. a mop — швабра. Зазвичай спочатку sweep, потім mop.", "I mop the floor when it is dirty.", "Я мию підлогу шваброю, коли вона брудна."],
  ["to dust the furniture", "витирати пил з меблів", "🪑", "/dʌst ðə ˈfɝː.nɪ.tʃɚ/", "/dʌst ðə ˈfɜː.nɪ.tʃə/", "To remove a thin layer of dry dirt from tables, shelves and other things in a room.", "dust тут — дієслово: витирати пил. furniture — незлічуване: some furniture, не furnitures. dust → dusted.", "We dust the furniture once a week.", "Ми витираємо пил з меблів раз на тиждень."],
  ["to take out the rubbish", "виносити сміття", "🗑️", "/teɪk aʊt ðə ˈrʌb.ɪʃ/", "/teɪk aʊt ðə ˈrʌb.ɪʃ/", "To carry unwanted things from the bin inside your home to a bin outside.", "UK: rubbish; US: trash / garbage. take out the trash — американський варіант. take → took → taken. take it out, не take out it.", "I take out the rubbish before work.", "Я виношу сміття перед роботою."],
  ["to cook dinner", "готувати вечерю", "🍳", "/kʊk ˈdɪn.ɚ/", "/kʊk ˈdɪn.ə/", "To prepare the main evening meal by heating food.", "cook dinner / make dinner — обидва варіанти можливі. Зазвичай без the, коли говоримо про звичну вечерю. cook → cooked.", "I cook dinner for my family.", "Я готую вечерю для своєї сім'ї."],
  ["to set the table", "накривати на стіл", "🍴", "/set ðə ˈteɪ.bəl/", "/set ðə ˈteɪ.bəl/", "To put plates, knives, forks and glasses on a table before a meal.", "UK також lay the table. set → set → set: форма не змінюється. set the table — ДО їжі; clear the table — ПІСЛЯ.", "Please set the table before dinner.", "Будь ласка, накрий на стіл перед вечерею."],
  ["to clear the table", "прибирати зі столу", "🥣", "/klɪr ðə ˈteɪ.bəl/", "/klɪə ðə ˈteɪ.bəl/", "To take plates, glasses and food off a table after a meal.", "clear the table — прибрати речі зі столу; clean the table — вимити сам стіл. clear → cleared.", "We clear the table after lunch.", "Ми прибираємо зі столу після обіду."],
  ["to water the plants", "поливати рослини", "🪴", "/ˈwɑː.t̬ɚ ðə plænts/", "/ˈwɔː.tə ðə plɑːnts/", "To give plants the water that they need to grow.", "water тут — дієслово: поливати. water → watered. plants — рослини, а не plans — плани.", "I water the plants twice a week.", "Я поливаю рослини двічі на тиждень."],
  ["to iron clothes", "прасувати одяг", "👕", "/ˈaɪ.ɚn kloʊðz/", "/ˈaɪ.ən kləʊðz/", "To make clothes smooth with a hot, flat tool.", "iron — праска або прасувати. US /ˈaɪ.ɚn/, UK /ˈaɪ.ən/: не вимовляємо як eye-ron. clothes — одяг, cloth — тканина.", "I iron clothes on Sunday evening.", "Я прасую одяг у неділю ввечері."],
  ["to fold clothes", "складати одяг", "👚", "/foʊld kloʊðz/", "/fəʊld kləʊðz/", "To bend clothes neatly so you can store them in a smaller space.", "fold → folded. fold a T-shirt — скласти футболку. Спочатку fold clothes, потім put them away.", "We fold clothes after they are dry.", "Ми складаємо одяг після того, як він висохне."],
  ["to clean the bathroom", "прибирати / мити ванну кімнату", "🛁", "/kliːn ðə ˈbæθ.ruːm/", "/kliːn ðə ˈbɑːθ.ruːm/", "To wash the bath, sink, toilet and other parts of the room where you wash yourself.", "clean — прибирати / чистити, tidy — наводити порядок. in the bathroom — у ванній кімнаті. clean → cleaned.", "We clean the bathroom every weekend.", "Ми прибираємо ванну кімнату кожних вихідних."],
  ["to feed the pet", "годувати домашнього улюбленця", "🐈", "/fiːd ðə pet/", "/fiːd ðə pet/", "To give food to an animal that lives in your home.", "feed → fed → fed. feed the cat / feed the dog. pet — домашній улюбленець. feed my pet — годувати свого улюбленця.", "I feed the pet every morning.", "Я годую домашнього улюбленця щоранку."],
  ["to walk the dog", "вигулювати собаку", "🐕", "/wɔːk ðə dɑːɡ/", "/wɔːk ðə dɒɡ/", "To take a dog outside so it can get exercise.", "walk the dog / take the dog for a walk. У walk літера l не вимовляється. walk → walked.", "We walk the dog after breakfast.", "Ми вигулюємо собаку після сніданку."],
  ["to put away clothes", "прибирати одяг на місце", "🚪", "/pʊt əˈweɪ kloʊðz/", "/pʊt əˈweɪ kləʊðz/", "To move clothes to the wardrobe or drawers where you normally keep them.", "put clothes away / put away clothes. З займенником: put them away, не put away them. put → put → put.", "I put away clothes when they are clean.", "Я прибираю одяг на місце, коли він чистий."],
  ["messy", "безладний / неохайний", "😵", "/ˈmes.i/", "/ˈmes.i/", "Not tidy, with things in the wrong places.", "a messy room — кімната, де безлад. messy ↔ tidy. Не те саме, що dirty: кімната може бути чистою, але безладною.", "My brother's room is usually messy.", "У кімнаті мого брата зазвичай безлад."],
  ["tidy", "охайний / прибраний", "✨", "/ˈtaɪ.di/", "/ˈtaɪ.di/", "With things organised and in their right places.", "a tidy room — охайна кімната. keep your room tidy — підтримувати порядок. tidy — прикметник; tidy up — дія.", "Our kitchen is always tidy.", "Наша кухня завжди охайна."],
  ["to share", "ділити / розділяти між собою", "🤝", "/ʃer/", "/ʃeə/", "To use or do something together instead of keeping it or doing it alone.", "share the chores — ділити обов'язки. share something with somebody — ділитися чимось із кимось. share → shared.", "We share the chores with our flatmates.", "Ми ділимо домашні справи з сусідами по квартирі."],
  ["to take turns", "робити щось по черзі", "🔄", "/teɪk tɝːnz/", "/teɪk tɜːnz/", "To do something one person after another, so everyone has a chance or a job to do.", "take turns + -ing: take turns cooking. It's my turn — моя черга. It's your turn to do the dishes — твоя черга мити посуд.", "We take turns cooking dinner.", "Ми готуємо вечерю по черзі."],
];

export function householdChoresVocabulary(): WordContent[] {
  return vocabulary.map(([word, translation, icon, ipaUs, ipaUk, description, note, en, tr], index) => ({
    word, translation, icon, ipaUs, ipaUk, description, note, examples: [{ en, tr }],
    category: index < 20 ? "Household chores" : "Useful words & phrases", sectionColor: null, imageUrl: null,
  }));
}

const escapeHtml = (value: string) => value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
type GapRow = { prompt: string; answer: string };
const gap = (prompt: string, answer: string): GapRow => ({ prompt, answer });

function gapExercise(title: string, instruction: string, rows: GapRow[], teacher: boolean, translation = false) {
  return `<h3>${escapeHtml(title)}</h3><p class="instr">${escapeHtml(instruction)}</p><ol${translation ? ' class="translation-check"' : ""}>${rows.map(row => `<li>${escapeHtml(row.prompt).replace("___", teacher ? `<span class="ans">${escapeHtml(row.answer)}</span>` : '<span class="blank"></span>')}</li>`).join("")}</ol>`;
}

function section(id: string, title: string, tone: RegularLessonTone, studentHtml: string, teacherHtml = studentHtml, teacherOnly = false): RegularLessonSection {
  return { id, title, tone, studentHtml: addRegularLessonFocusIds(studentHtml), teacherHtml: addRegularLessonFocusIds(teacherHtml), defaultOpen: tone === "vocab", ...(teacherOnly ? { teacherOnly } : {}) };
}

const routineGaps = [
  gap("There are dirty plates in the sink. After dinner, I ___.", "do the dishes / wash the dishes / do the washing-up"),
  gap("The bin is full. Please ___ before you go out.", "take out the rubbish / take out the trash / take out the garbage"),
  gap("My shirts are dirty. On Sundays, I ___.", "do the laundry / do the washing"),
  gap("The shelves are covered in dust. We need to ___.", "dust the furniture"),
  gap("Before we eat, please put the plates and forks out. Can you ___?", "set the table / lay the table"),
  gap("After lunch, please take the plates off the table. Can you ___?", "clear the table"),
  gap("The plants are dry. Don't forget to ___.", "water the plants"),
  gap("My dog needs some exercise. Every evening, I ___.", "walk the dog / take the dog for a walk"),
];
const collocationGaps = [
  gap("I usually ___ the bed at seven. (do / make)", "make"),
  gap("We ___ the laundry on Saturday. (do / make)", "do"),
  gap("It's your turn to ___ the dishes. (do / make)", "do"),
  gap("My parents ___ the housework together. (do / make)", "do"),
  gap("I ___ a shopping list before I go to the shop. (do / make)", "make"),
  gap("She likes to ___ dinner with her sister. (do / make)", "make"),
];
const obligationGaps = [
  gap("I ___ feed the pet every morning. (have to / has to)", "have to"),
  gap("My brother ___ make the bed before school. (have to / has to)", "has to"),
  gap("We ___ clean the bathroom today. (have to / has to)", "have to"),
  gap("Anna ___ do the laundry on Friday. (have to / has to)", "has to"),
  gap("You ___ take out the rubbish before lunch. (have to / has to)", "have to"),
  gap("Our flatmate ___ water the plants this week. (have to / has to)", "has to"),
  gap("They ___ put away their clothes after school. (have to / has to)", "have to"),
  gap("My dad ___ cook dinner tonight. (have to / has to)", "has to"),
];
const questionGaps = [
  gap("___ you have to walk the dog every day? (Do / Does)", "Do"),
  gap("___ Mia have to iron clothes at work? (Do / Does)", "Does"),
  gap("Leo ___ have to cook tonight: Omar is cooking. (don't / doesn't)", "doesn't / does not"),
  gap("We ___ have to do the laundry today: our clothes are clean. (don't / doesn't)", "don't / do not"),
  gap("___ your parents have to clean the bathroom every week? (Do / Does)", "Do"),
  gap("My sister doesn't ___ tidy up my room. (have to / has to)", "have to"),
  gap("Does your brother ___ feed the pet? (have to / has to)", "have to"),
  gap("I don't ___ vacuum the floor today. (have to / has to)", "have to"),
];
const meaningGaps = [
  gap("The floor is already clean. You ___ mop it again. It isn't necessary.", "don't have to / do not have to"),
  gap("This is our house rule: you ___ leave the front door open when you go out. It isn't allowed.", "mustn't / must not"),
  gap("I fed the cat an hour ago. You ___ feed it now. It isn't necessary.", "don't have to / do not have to"),
  gap("This is our house rule: you ___ leave dirty dishes in the living room. It isn't allowed.", "mustn't / must not"),
  gap("We have a dishwasher. You ___ wash all the dishes by hand. It isn't necessary.", "don't have to / do not have to"),
  gap("The sign says 'Do not walk on the wet floor'. You ___ walk there now. It isn't allowed.", "mustn't / must not"),
];

const reading = `<h3>A small flat, a fair plan</h3>
<p>Mia, Leo and Omar share a small flat. Last month, their kitchen was always <strong>messy</strong>. There were cups on the table and clothes on the chairs. Everyone said, “I'm busy!” Now they have a simple plan.</p>
<p>Every morning, Mia has to <strong>feed the pet</strong>, a cat called Bean. Leo has to <strong>take out the rubbish</strong>. Omar has to <strong>make the bed</strong> and <strong>put away</strong> his <strong>clothes</strong>. Everyone keeps their own room <strong>tidy</strong>.</p>
<p>In the evening, they <strong>take turns</strong> cooking dinner. The person who cooks doesn't have to <strong>do the dishes</strong>. The other two <strong>set the table</strong>, then <strong>clear the table</strong> and wash up after the meal. They <strong>share</strong> the work, so nobody has to do everything.</p>
<p>On Saturday, they clean together. Mia has to <strong>vacuum the floor</strong> and <strong>dust the furniture</strong>. Leo has to <strong>clean the bathroom</strong>. Omar has to <strong>do the laundry</strong>. They <strong>fold clothes</strong> together, but they don't have to <strong>iron</strong> every T-shirt. Leo <strong>waters the plants</strong> twice a week.</p>
<p>Their main rule is simple: you mustn't leave dirty dishes in the living room. Before bed, everyone spends ten minutes tidying up. On most evenings, they finish quickly and watch a film. Their home isn't perfect, but their plan is fair. “Ten minutes of teamwork is better than an hour of arguing,” says Mia.</p>`;
const readingFacts: [string, boolean][] = [
  ["Three people live in the flat.", true],
  ["Leo has to feed Bean every morning.", false],
  ["The person who cooks also has to do all the dishes.", false],
  ["Mia has to vacuum the floor on Saturday.", true],
  ["They have to iron every T-shirt.", false],
  ["They mustn't leave dirty dishes in the living room.", true],
];
function readingChecks(teacher: boolean) {
  return `<h3>True or false?</h3><p class="instr">Read the text again. Write True or False.</p><ol>${readingFacts.map(([prompt, correct]) => `<li>${escapeHtml(prompt)} ${teacher ? `<span class="ans">${correct ? "True" : "False"}</span>` : '<span class="tfbox"></span>'}</li>`).join("")}</ol>
  <h3>Reading questions</h3><p class="instr">Answer in full sentences. Find the evidence in the text.</p><ol>
  <li>Why was the kitchen messy last month?</li><li>Who has to take out the rubbish in the morning?</li><li>What does Omar have to do on Saturday?</li><li>Why doesn't the cook have to do the dishes?</li><li>What do they do before bed?</li><li>Do you think their plan is fair? Why?</li></ol>${teacher ? '<div class="key"><p>1. Everyone said they were busy. 2. Leo. 3. Do the laundry. 4. The other two wash up; they share the work. 5. Spend ten minutes tidying up. 6. Accept a reasoned personal answer.</p></div>' : ""}`;
}

const dialogues: { speaker: string; text: string }[][] = [
  [
    { speaker: "Alex", text: "The kitchen is <strong>messy</strong> again. Let's <strong>share</strong> the <strong>household chores</strong>." },
    { speaker: "Nina", text: "Good idea. What do we have to do today?" },
    { speaker: "Alex", text: "We have to <strong>do the laundry</strong> and <strong>clean the bathroom</strong>." },
    { speaker: "Nina", text: "I'll do the laundry. Can you clean the bathroom, please?" },
    { speaker: "Alex", text: "Sure. Do I also have to <strong>vacuum the floor</strong>?" },
    { speaker: "Nina", text: "No, you don't. I vacuumed it yesterday." },
    { speaker: "Alex", text: "Great. What about dinner?" },
    { speaker: "Nina", text: "Let's <strong>take turns</strong> cooking. It's my turn today." },
    { speaker: "Alex", text: "Then I'll <strong>set the table</strong> and <strong>do the dishes</strong>." },
    { speaker: "Nina", text: "Thanks. And don't forget to <strong>take out the rubbish</strong>. The bin is full." },
    { speaker: "Alex", text: "OK. Do we have to <strong>iron</strong> all these <strong>clothes</strong>?" },
    { speaker: "Nina", text: "No, we don't. We just have to <strong>fold</strong> them and <strong>put</strong> them <strong>away</strong>." },
    { speaker: "Alex", text: "That sounds fair. Let's start!" },
  ],
  [
    { speaker: "Sam", text: "Our friends are coming at six. What do we have to do?" },
    { speaker: "Jo", text: "First, we have to <strong>tidy up</strong> the living room." },
    { speaker: "Sam", text: "Can you <strong>dust the furniture</strong>, please? I'll <strong>sweep the floor</strong>." },
    { speaker: "Jo", text: "Of course. Do we have to <strong>mop the floor</strong> too?" },
    { speaker: "Sam", text: "Yes, we do. It's dirty near the door." },
    { speaker: "Jo", text: "OK. But we mustn't walk on it while it's wet." },
    { speaker: "Sam", text: "Right. I'll <strong>walk the dog</strong> while it dries." },
    { speaker: "Jo", text: "Does your sister have to help us?" },
    { speaker: "Sam", text: "No, she doesn't. She has to work until five." },
    { speaker: "Jo", text: "Then I'll <strong>cook dinner</strong>. Can you <strong>set the table</strong> later?" },
    { speaker: "Sam", text: "Sure. Do I have to <strong>water the plants</strong>?" },
    { speaker: "Jo", text: "No, you don't. I watered them this morning." },
    { speaker: "Sam", text: "Excellent. We can finish the important jobs first." },
    { speaker: "Jo", text: "Exactly. A <strong>tidy</strong> home, not a perfect home!" },
  ],
];
function dialogueHtml(index: number) {
  return dialogues[index].map(line => `<p><b>${line.speaker}:</b> ${line.text}</p>`).join("");
}

const translationPairs = [
  ["Мне нужно застилать кровать каждое утро.", "I have to make the bed every morning.", "I have to make my bed every morning."],
  ["Моя сестра должна мыть посуд после ужина.", "My sister has to do the dishes after dinner.", "My sister has to wash the dishes after dinner."],
  ["Тебе не нужно стирать сегодня: одежда чистая.", "You don't have to do the laundry today: the clothes are clean.", "You do not have to do the laundry today because the clothes are clean."],
  ["Ему не нужно гладить эту футболку.", "He doesn't have to iron this T-shirt.", "He does not have to iron this T-shirt."],
  ["Тебе нужно выносить мусор каждый день?", "Do you have to take out the rubbish every day?", "Do you have to take out the trash every day?"],
  ["Ей нужно поливать растения два раза в неделю?", "Does she have to water the plants twice a week?"],
  ["По правилам нашего дома нельзя оставлять грязную посуду в гостиной.", "You mustn't leave dirty dishes in the living room: it's our house rule.", "You must not leave dirty dishes in the living room. It's our house rule."],
  ["Мы по очереди готовим ужин и делим домашние обязанности.", "We take turns cooking dinner and share the household chores.", "We take turns cooking dinner and share the chores."],
];

export function householdChoresHomework(words = householdChoresVocabulary()): InteractiveHomeworkPlan {
  const vocabularyExercises: HomeworkExercise[] = (["fill", "definition", "describe"] as const).map(kind => ({
    id: `chores-vocab-${kind}`, title: `Vocabulary — ${kind}`, instruction: "", kind, items: [],
  }));
  const grammar: HomeworkExercise = {
    id: "chores-grammar", title: "Grammar — Duties, choices & house rules", kind: "fill", optional: false,
    instruction: "Fill in the gap. Use have to / has to, don't have to / doesn't have to, mustn't, Do or Does. Read the context carefully.",
    items: [
      gap("My sister ___ feed our cat every morning. It's her job.", "has to"),
      gap("We ___ clean the bathroom on Saturdays. That's our weekly job.", "have to"),
      gap("The clothes are clean. I ___ do the laundry today. It isn't necessary.", "don't have to / do not have to"),
      gap("Our house rule says: you ___ leave dirty plates in the bedroom. It isn't allowed.", "mustn't / must not"),
      gap("___ your brother have to walk the dog before school?", "Does"),
      gap("___ you have to take out the rubbish every day?", "Do"),
      gap("I set the table ten minutes ago, so Leo ___ set it again. It isn't necessary.", "doesn't have to / does not have to"),
      gap("Does she ___ water the plants this week? (have to / has to)", "have to"),
    ].map((row, index) => { const [answer, ...accepted] = row.answer.split(" / "); return { id: `chores-grammar-${index + 1}`, prompt: row.prompt, answer, ...(accepted.length ? { accepted } : {}) }; }),
  };
  const translation: HomeworkExercise = {
    id: "chores-translation", title: "Translation — Household chores", kind: "translate", optional: false, translationDirection: "to-english", translationLanguage: "RU",
    instruction: "Переведи на английский. Используй словарь урока и have to / has to, don't have to / doesn't have to, mustn't. Переводы проверяет учитель.",
    items: translationPairs.map(([prompt, answer, ...accepted], index) => ({ id: `chores-translation-${index + 1}`, prompt, answer, ...(accepted.length ? { accepted } : {}) })),
  };
  const personal: HomeworkExercise = {
    id: "chores-personal", title: "Personal questions — Your home", kind: "question-text", optional: false,
    instruction: "Ответь по-английски: 2–3 предложения на каждый вопрос. Используй новые слова и грамматику урока.",
    items: [
      "Which household chores do you have to do at home? How often?",
      "Which chore do you like, and which chore don't you like? Why?",
      "How do the people in your home share the chores or take turns?",
      "What don't you have to do at home? What is one thing you mustn't do?",
    ].map((prompt, index) => ({ id: `chores-personal-${index + 1}`, prompt })),
  };
  const bonus: HomeworkExercise = {
    id: "chores-bonus-plan", title: "Bonus — A fair plan for the weekend", kind: "question-text", optional: true,
    instruction: "Напиши 60–80 слов: придумай справедливый план уборки для себя и друга. Используй минимум 6 слов/фраз урока, have to, doesn't/don't have to и одну вежливую просьбу с Can you ... please?",
    items: [{ id: "chores-bonus-plan-1", prompt: "You and a friend share a flat. Guests are coming on Saturday. Write your plan: who does what, what isn't necessary, and how you share the work." }],
  };
  const plan = organizeVocabularyHomework({ kind: "INTERACTIVE_HOMEWORK_V1", title: `${HOUSEHOLD_CHORES_LESSON_TITLE} — Homework`,
    intro: "Три группы словаря без повторов, грамматика, перевод и личные ответы. Bonus — по желанию.",
    exercises: [...vocabularyExercises, grammar, translation, personal, bonus] }, words, { includeAllWords: true });
  const alternatives: Record<string, string[]> = {
    "to do the dishes": ["do the washing-up", "wash the dishes"],
    "to do the laundry": ["do the washing"],
    "to take out the rubbish": ["take out the trash", "take out the garbage"],
    "to set the table": ["lay the table"],
    "to walk the dog": ["take the dog for a walk"],
    "to put away clothes": ["put clothes away"],
  };
  return { ...plan, exercises: plan.exercises.map(exercise => {
    if (!exercise.id.startsWith("chores-vocab-") || exercise.kind === "describe") return exercise;
    return { ...exercise, items: exercise.items.map(item => {
      const word = item.vocabularyWord ?? "";
      const forms = alternatives[word] ?? [];
      const accepted = [...new Set([...(item.accepted ?? []), word, word.replace(/^to /, ""), ...forms, ...forms.map(form => `to ${form}`)])]
        .filter(form => form && form !== item.answer);
      return { ...item, accepted };
    }) };
  }) };
}

export function householdChoresLesson() {
  const words = householdChoresVocabulary();
  const vocabHtml = `<p class="instr">Listen, repeat and use each phrase in a sentence. Compare US and UK pronunciation. Translations, meanings, examples and tips are hidden until you open them.</p>${words.map(word => `<div class="vcard"><div class="vhead"><span class="em">${word.icon}</span><b>${escapeHtml(word.word)}</b><span class="tr">${escapeHtml(word.ipaUk ?? "")}</span> — <span class="ua">${escapeHtml(word.translation ?? "")}</span></div><p>${escapeHtml(word.description ?? "")}</p><ul>${word.examples.map(example => `<li>${escapeHtml(example.en)}</li>`).join("")}</ul><div class="note">${escapeHtml(word.note ?? "")}</div></div>`).join("")}`;
  const lexis = `<h3>DO or MAKE?</h3><div class="support"><p><b>DO:</b> do the dishes · do the laundry · do the housework · do household chores.</p><p><b>MAKE:</b> make the bed · make dinner · make a shopping list.</p></div><p class="tip">Часто do — выполнять работу, make — создавать или готовить что-то. Но это сочетания, их нужно учить целиком. Cook dinner и make dinner — оба варианта правильные.</p>
  <h3>How often?</h3><p>I <b>usually</b> tidy up after dinner. She <b>never</b> irons T-shirts. Our kitchen <b>is always</b> tidy.</p><p class="tip">usually / always / often / sometimes / never стоят перед обычным глаголом, но после am / is / are. Every day · once a week · twice a week обычно идут в конце.</p>
  <h3>Share the work politely</h3><p><b>Can you set the table, please?</b> — Можешь накрыть на стол, пожалуйста?</p><p><b>It's your turn to do the dishes.</b> — Твоя очередь мыть посуду.</p><p><b>Let's take turns cooking.</b> — Давай готовить по очереди.</p><p class="tip">take turns + -ing, но It's my turn + to + глагол. Put the clothes away → put them away. Не put away them.</p>`;
  const grammar = `<h3>Зачем это нужно?</h3><p>Чтобы рассказать об обязанностях дома и договориться, кто что делает: что <b>нужно</b> сделать, что <b>необязательно</b>, а что <b>нельзя</b>.</p>
  <h3>1 · HAVE TO / HAS TO — нужно, приходится</h3><div class="support"><p><b>I / you / we / they + have to + глагол</b></p><p>I have to take out the rubbish. — Мне нужно вынести мусор.</p><p><b>He / she / it + has to + глагол</b></p><p>She has to feed the pet. — Ей нужно покормить питомца.</p></div>
  <h3>2 · DON'T HAVE TO / DOESN'T HAVE TO — не нужно, необязательно</h3><div class="support"><p><b>I / you / we / they + don't have to + глагол</b></p><p>You don't have to iron this T-shirt. — Необязательно гладить эту футболку.</p><p><b>He / she / it + doesn't have to + глагол</b></p><p>He doesn't have to cook tonight. — Сегодня ему не нужно готовить.</p></div><p class="tip">После doesn't — <b>have</b>, не has. Действие можно сделать, но необходимости нет.</p>
  <h3>3 · Вопросы и короткие ответы</h3><div class="support"><p><b>Do + I / you / we / they + have to + глагол?</b></p><p>Do you have to make the bed? — Yes, I do. / No, I don't.</p><p><b>Does + he / she / it + have to + глагол?</b></p><p>Does she have to do the laundry? — Yes, she does. / No, she doesn't.</p></div><p class="tip">Does she <b>have to</b> ...?, не Does she has to ...?</p>
  <h3>4 · MUSTN'T — нельзя, запрещено</h3><div class="support"><p><b>Любое подлежащее + mustn't + глагол</b></p><p>You mustn't leave dirty dishes in the living room. — По нашему правилу нельзя оставлять грязную посуду в гостиной.</p><p>mustn't = must not. После mustn't нет to и нет -s.</p></div>
  <h3>Главное различие</h3><table><thead><tr><th>Фраза</th><th>Смысл</th><th>Пример</th></tr></thead><tbody><tr><td>have to</td><td>нужно</td><td>I have to clean the bathroom.</td></tr><tr><td>don't have to</td><td>необязательно; можно, но не нужно</td><td>The floor is clean. You don't have to mop it.</td></tr><tr><td>mustn't</td><td>нельзя; это запрет</td><td>Our house rule: you mustn't leave the door open.</td></tr></tbody></table><p class="warn"><b>Don't have to ≠ mustn't.</b> Необязательно делать и запрещено делать — разные вещи.</p>`;
  const vocabularyPractice = (teacher: boolean) => gapExercise("1 · Which chore is it?", "Read the situation. Complete it with a phrase from the vocabulary.", routineGaps, teacher) + gapExercise("2 · DO or MAKE?", "Choose do or make. Learn the full phrase.", collocationGaps, teacher);
  const grammarPractice = (teacher: boolean) => gapExercise("1 · HAVE TO or HAS TO?", "Choose the correct form. Look at the subject.", obligationGaps, teacher) + gapExercise("2 · Questions and negatives", "Choose the correct form from the brackets.", questionGaps, teacher) + gapExercise("3 · Not necessary or not allowed?", "Use don't have to or mustn't. The context tells you which meaning is needed.", meaningGaps, teacher);
  const translationRows = translationPairs.map(([prompt, answer, ...accepted]) => gap(`${prompt} → ___`, [answer, ...accepted].join(" / ")));
  const sections = [
    section("chores-warmup", "Warm-up", "warm", `<h3>Let's talk about your home</h3><p class="instr">Short answers are fine. First speak from memory, then use the vocabulary.</p><ol><li>Is your room usually tidy or messy?</li><li>Who usually cooks dinner in your home?</li><li>What do you usually do after a meal?</li><li>Which household chore do you like least?</li><li>What do you already know how to say in English?</li></ol>`, `<h3>Warm-up questions</h3><ol><li>Is your room usually tidy or messy?</li><li>Who usually cooks dinner in your home?</li><li>What do you usually do after a meal?</li><li>Which household chore do you like least?</li><li>What do you already know how to say in English?</li></ol><div class="key"><p>3–5 minutes. Accept short answers; reformulate naturally. Do not reveal translations before the learner tries. Keep this section closed for the student until you choose to open it.</p></div>`),
    section("chores-vocabulary", "Vocabulary", "vocab", vocabHtml),
    section("chores-lexis", "Lexis · Useful phrases", "grammar", lexis),
    section("chores-vocabulary-practice", "Vocabulary practice", "exercise", vocabularyPractice(false), vocabularyPractice(true)),
    section("chores-grammar", "Grammar · Have to", "grammar", grammar),
    section("chores-grammar-practice", "Grammar practice", "exercise", grammarPractice(false), grammarPractice(true)),
    section("chores-reading", "Reading · A fair plan", "reading", reading + readingChecks(false), reading + readingChecks(true)),
    section("chores-dialogue-1", "Dialogue 1 · Share the chores", "dialogue", dialogueHtml(0) + '<h3>Dialogue questions</h3><ol><li>What does Nina agree to do?</li><li>Why doesn\'t Alex have to vacuum the floor?</li><li>What do they decide to do with the clothes?</li></ol>', dialogueHtml(0) + '<h3>Dialogue questions</h3><ol><li>What does Nina agree to do?</li><li>Why doesn\'t Alex have to vacuum the floor?</li><li>What do they decide to do with the clothes?</li></ol><div class="key"><p>1. Do the laundry and cook dinner. 2. Nina vacuumed it yesterday. 3. Fold them and put them away; they do not have to iron them.</p></div>'),
    section("chores-dialogue-2", "Dialogue 2 · Guests are coming", "dialogue", dialogueHtml(1) + '<h3>Dialogue questions</h3><ol><li>When are their friends coming?</li><li>Why do they have to mop the floor?</li><li>Why doesn\'t Sam\'s sister have to help?</li><li>Does Sam have to water the plants? Why?</li></ol>', dialogueHtml(1) + '<h3>Dialogue questions</h3><ol><li>When are their friends coming?</li><li>Why do they have to mop the floor?</li><li>Why doesn\'t Sam\'s sister have to help?</li><li>Does Sam have to water the plants? Why?</li></ol><div class="key"><p>1. At six. 2. It is dirty near the door. 3. She has to work until five. 4. No; Jo watered them this morning.</p></div>'),
    section("chores-translation", "Translation · RU → EN", "exercise", gapExercise("Translation practice", "Переведи на английский. Используй словарь и грамматику урока.", translationRows, false, true), gapExercise("Translation practice", "Переведи на английский. Используй словарь и грамматику урока.", translationRows, true, true)),
    section("chores-speaking", "Speaking · Your home", "exercise", `<h3>Personal questions</h3><p class="instr">Answer in 2–3 sentences. Use a frequency phrase and have to / don't have to.</p><ol><li>Which chores do you have to do every day?</li><li>Who usually does the laundry in your home?</li><li>Do you have to make your bed every morning?</li><li>How often do you vacuum or sweep the floor?</li><li>Which chores do you like? Which ones do you dislike?</li><li>What don't you have to do at home?</li><li>How do you share the chores?</li><li>What is one house rule: what mustn't people do?</li></ol><h3>Role-play · A fair weekend plan</h3><div class="support"><p>You and your partner share a flat. The kitchen is messy. The bin is full. The bathroom is dirty. Your friends are coming at six.</p><p>Agree on who does what. Use: <b>We have to ... / Can you ... please? / I can ... / You don't have to ... / It's my turn ... / Let's take turns ...</b></p></div>`),
    section("chores-teacher-notes", "Teacher notes", "teacher", "", `<div class="teacher-note"><h3>A2 · Household chores — teaching guide</h3><p>Goal: name everyday chores, describe routines, share work politely and distinguish an obligation from no obligation and a prohibition.</p><p>Suggested flow: warm-up 3–5 min; vocabulary in two passes 12–15 min; lexis 5 min; practice 8–10 min; grammar and controlled practice 12–15 min; reading and two dialogues 12–15 min; speaking 5–8 min. Use two lessons if all 24 targets are new.</p><p>Core corrections: make the bed, do the dishes/laundry/housework; he has to, but Does he have to? and He doesn't have to; don't have to is not mustn't; take turns cooking, but It's my turn to cook; put them away.</p><p>Accept do the washing-up / wash the dishes for do the dishes; take out the trash/garbage for take out the rubbish; lay the table for set the table. This is an A2 duties lesson, not a lesson on all modal verbs.</p><p>Read the dialogues twice: first for meaning, then swap roles. Ask learners to replace at least three chores with their own. Grade translations and descriptions manually with feedback, using the platform controls.</p><p>Vocabulary homework: 24 unique targets, split 8 + 8 + 8 across Fill in the gaps, Guess by meaning and Explain the meaning. The writing task is optional. No student is assigned automatically.</p></div>`, true),
  ];
  return { title: HOUSEHOLD_CHORES_LESSON_TITLE,
    description: "Household chores · 24 essential words & phrases · have to / has to, don't have to & mustn't · do/make, routines, reading, two dialogues, speaking and interactive homework.",
    sections: normalizeRegularLessonSections(sections), words, homework: [householdChoresHomework(words)] };
}
