import { randomUUID } from "node:crypto";
import { and, eq, ilike } from "drizzle-orm";
import { db } from "@/lib/db";
import { lessonAssignments, lessonUnits, lessonWords } from "@/lib/db/schema";
import type { InteractiveHomeworkPlan } from "@/lib/lesson-homework";
import {
  addRegularLessonFocusIds,
  regularSectionKey,
  type RegularLessonSection,
  type RegularLessonTone,
} from "@/lib/regular-lesson";

type AppearanceWordSeed = {
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

const example = (en: string, tr: string) => ({ en, tr });
const word = (
  category: string,
  sectionColor: string,
  icon: string,
  value: string,
  translation: string,
  description: string,
  examples: { en: string; tr: string }[],
  ipa: string | null = null,
  note: string | null = null,
): AppearanceWordSeed => ({
  category,
  sectionColor,
  icon,
  word: value,
  ipaUs: ipa,
  ipaUk: ipa,
  translation,
  description,
  note,
  examples,
});

export const a1AppearanceVocabulary: AppearanceWordSeed[] = [
  word("Appearance basics", "#14b8a6", "👤", "appearance", "внешность", "The way a person looks.", [example("Her appearance is nice.", "У неё приятная внешность.")], "/əˈpɪr.əns/"),
  word("Appearance basics", "#14b8a6", "💇", "hair", "волосы", "The hair that grows on a person's head.", [example("My hair is long.", "У меня длинные волосы.")], "/her/", "Hair is normally singular in English: My hair is long, not My hair are long."),
  word("Height and style", "#3b82f6", "📏", "long", "длинный", "Having a large distance from one end to the other.", [example("She has long hair.", "У неё длинные волосы.")], "/lɔːŋ/"),
  word("Height and style", "#3b82f6", "✂️", "short", "короткий; невысокий", "Not long; for a person, not tall.", [example("He is short, and his hair is short too.", "Он невысокий, и его волосы тоже короткие.")], "/ʃɔːrt/"),
  word("Height and style", "#3b82f6", "🦒", "tall", "высокий", "Having more than average height.", [example("My brother is very tall.", "Мой брат очень высокий.")], "/tɔːl/"),
  word("Height and style", "#3b82f6", "🌸", "pretty", "симпатичная; милая", "Attractive in a pleasant or delicate way.", [example("Your daughter is pretty.", "Ваша дочь симпатичная.")], "/ˈprɪt.i/", "Pretty is most often used about women and girls."),
  word("Height and style", "#3b82f6", "🤵", "handsome", "красивый", "Attractive, especially when describing a man.", [example("Her husband is tall and handsome.", "Её муж высокий и красивый.")], "/ˈhæn.səm/", "Handsome is most often used about men and boys."),
  word("Face", "#f59e0b", "〰️", "wrinkles", "морщины", "Lines on the skin that often appear with age.", [example("My grandmother has wrinkles.", "У моей бабушки есть морщины.")], "/ˈrɪŋ.kəlz/"),
  word("Face", "#f59e0b", "✨", "freckles", "веснушки", "Small brown spots on the skin.", [example("The girl has freckles.", "У девочки есть веснушки.")], "/ˈfrek.əlz/"),
  word("Face", "#f59e0b", "🧔", "beard", "борода", "Hair that grows on a man's chin and cheeks.", [example("My dad has a beard.", "У моего папы есть борода.")], "/bɪrd/"),
  word("Face", "#f59e0b", "🥸", "moustache", "усы", "Hair that grows above a man's upper lip.", [example("He has a moustache but no beard.", "У него есть усы, но нет бороды.")], "/ˈmʌs.tæʃ/"),
  word("Face", "#f59e0b", "🪒", "facial hair", "растительность на лице", "Hair on a person's face, such as a beard or moustache.", [example("He has no facial hair.", "У него нет растительности на лице.")], "/ˈfeɪ.ʃəl her/"),
  word("Body and lifestyle", "#8b5cf6", "🏋️", "athletic", "атлетичный", "Having a strong, fit body.", [example("The football player is athletic.", "Футболист атлетичный.")], "/æθˈlet̬.ɪk/", "Athletic describes the body or physical ability."),
  word("Body and lifestyle", "#8b5cf6", "⚽", "sporty", "спортивный", "Interested in sport and often doing sport.", [example("I am not very sporty.", "Я не очень спортивный человек.")], "/ˈspɔːr.t̬i/", "Sporty describes a person's interests and lifestyle."),
  word("Body and lifestyle", "#8b5cf6", "💪", "in good shape", "в хорошей форме", "Healthy and physically fit.", [example("My mum is 60, but she is in good shape.", "Моей маме 60, но она в хорошей форме.")], null, "Say in good shape, without the article a."),
  word("Body and lifestyle", "#8b5cf6", "🐻", "overweight", "с лишним весом; полный", "Heavier than is healthy or usual.", [example("My cat is a bit overweight.", "У моего кота немного лишнего веса.")], "/ˌoʊ.vɚˈweɪt/"),
  word("Age", "#ec4899", "🧑", "in his / her teens", "ему / ей 13–19 лет", "Between 13 and 19 years old.", [example("My nephew is in his teens.", "Мой племянник — подросток.")], null, "Change his to her when you speak about a woman or girl."),
  word("Age", "#ec4899", "🎂", "in his / her 20s / 30s", "ему / ей двадцать или тридцать с чем-то", "Between 20 and 29, or between 30 and 39 years old.", [example("She is in her 30s.", "Ей тридцать с чем-то.")], null, "Read 30s as thirties: in her thirties."),
];

const focus = (html: string) => addRegularLessonFocusIds(html.trim());

const contentSection = (
  id: string,
  title: string,
  tone: RegularLessonTone,
  html: string,
  options: { defaultOpen?: boolean; teacherHtml?: string; teacherOnly?: boolean } = {},
): RegularLessonSection => ({
  id,
  title,
  tone,
  studentHtml: focus(html),
  teacherHtml: focus(options.teacherHtml ?? html),
  defaultOpen: options.defaultOpen ?? false,
  ...(options.teacherOnly ? { teacherOnly: true } : {}),
});

const checkedSection = (
  id: string,
  title: string,
  instruction: string,
  items: { prompt: string; answer: string }[],
): RegularLessonSection => {
  const render = (teacher: boolean) => focus(`
    <div class="support"><p>${instruction}</p></div>
    <ol class="sentence-check">
      ${items.map((item) => `<li>${item.prompt.replace(
        "___",
        teacher
          ? `<span class="blank ans">${item.answer}</span>`
          : '<span class="blank"></span>',
      )}</li>`).join("")}
    </ol>
  `);
  return {
    id,
    title,
    tone: "exercise",
    studentHtml: render(false),
    teacherHtml: render(true),
    defaultOpen: false,
  };
};

const openQuestionsSection = (
  id: string,
  title: string,
  instruction: string,
  items: { prompt: string; answer?: string }[],
  tone: RegularLessonTone = "exercise",
): RegularLessonSection => {
  const render = (teacher: boolean) => focus(`
    <h3>Questions</h3>
    <div class="support"><p>${instruction}</p></div>
    <ol>
      ${items.map((item) => `<li>${item.prompt}${teacher && item.answer ? `<div class="key"><b>Key:</b> ${item.answer}</div>` : ""}</li>`).join("")}
    </ol>
  `);
  return { id, title, tone, studentHtml: render(false), teacherHtml: render(true), defaultOpen: false };
};

const trueFalseSection = (
  id: string,
  title: string,
  items: { prompt: string; answer: "T" | "F"; explanation?: string }[],
): RegularLessonSection => {
  const render = (teacher: boolean) => focus(`
    <h3>True or False?</h3>
    <div class="support"><p>Choose T or F for every sentence.</p></div>
    <ol>
      ${items.map((item) => `<li>${item.prompt} <span class="tfbox${teacher ? " ans" : ""}">${teacher ? item.answer : ""}</span>${teacher && item.explanation ? `<div class="key">${item.explanation}</div>` : ""}</li>`).join("")}
    </ol>
  `);
  return { id, title, tone: "exercise", studentHtml: render(false), teacherHtml: render(true), defaultOpen: false };
};

const warmup = contentSection(
  "02-warm-up",
  "Warm-up",
  "warm",
  `<h3>Personal questions</h3><ol>
    <li>How are you today?</li>
    <li>Where are you from? Where do you live now?</li>
    <li>What is your hobby?</li>
    <li>Who is your favourite person? Is he or she tall or short?</li>
  </ol>`,
  { defaultOpen: true },
);

const wordOrderGrammar = contentSection(
  "03-word-order",
  "Grammar · Word order",
  "grammar",
  `<h3>S + V + O</h3>
   <p class="big"><b>Subject</b> (who?) + <b>Verb</b> (action or state) + <b>Object / other information</b></p>
   <table><thead><tr><th>Subject</th><th>Verb</th><th>Object / other</th></tr></thead><tbody>
     <tr><td>I</td><td>like</td><td>mushrooms.</td></tr>
     <tr><td>My dad</td><td>has</td><td>a beard.</td></tr>
     <tr><td>She</td><td><g>is</g></td><td>tall.</td></tr>
   </tbody></table>
   <div class="warn"><p>English sentences always need a verb: <b>She is tall.</b> Not: <i>She tall.</i></p></div>
   <div class="warn"><p>Do not use <b>am / is / are</b> together with <b>have / has</b>: <b>I have freckles.</b> Not: <i>I am have freckles.</i></p></div>`,
);

const toBeGrammar = contentSection(
  "04-to-be",
  "Grammar · am, is, are",
  "grammar",
  `<h3>Present Simple of to be</h3>
   <table><thead><tr><th>Statement</th><th>Short form</th><th>Negative</th></tr></thead><tbody>
     <tr><td>I <g>am</g> tall.</td><td>I<g>'m</g></td><td>I<g>'m not</g> tall.</td></tr>
     <tr><td>You / We / They <g>are</g> tall.</td><td>you're / we're / they're</td><td>They <g>aren't</g> tall.</td></tr>
     <tr><td>He / She / It <g>is</g> tall.</td><td>he's / she's / it's</td><td>She <g>isn't</g> tall.</td></tr>
   </tbody></table>
   <div class="tip"><p>There is no form <i>amn't</i>. Say <b>I'm not</b>.</p></div>
   <h3>Questions</h3>
   <p>Put <b>am / is / are</b> before the subject.</p>
   <table><thead><tr><th>Statement</th><th>Question</th></tr></thead><tbody>
     <tr><td>She is pretty.</td><td>Is she pretty?</td></tr>
     <tr><td>They are in their 20s.</td><td>Are they in their 20s?</td></tr>
     <tr><td>Her hair is long.</td><td>Is her hair long?</td></tr>
   </tbody></table>
   <p><b>Question word + am / is / are + subject:</b> How old is he? Where are you from?</p>
   <h3>Short answers</h3>
   <table><thead><tr><th>Question</th><th>Yes</th><th>No</th></tr></thead><tbody>
     <tr><td>Are you tall?</td><td>Yes, I am.</td><td>No, I'm not.</td></tr>
     <tr><td>Is he handsome?</td><td>Yes, he is.</td><td>No, he isn't.</td></tr>
     <tr><td>Are they sporty?</td><td>Yes, they are.</td><td>No, they aren't.</td></tr>
   </tbody></table>
   <div class="tip"><p>Do not contract a positive short answer: <b>Yes, she is.</b> Not: <i>Yes, she's.</i></p></div>`,
);

const likeGrammar = contentSection(
  "05-like-look-like",
  "Grammar · like, be like, look like",
  "grammar",
  `<table><thead><tr><th>Question or phrase</th><th>Meaning</th><th>Example answer</th></tr></thead><tbody>
    <tr><td>What does she <c>like</c>?</td><td>What does she enjoy?</td><td>She likes mushrooms.</td></tr>
    <tr><td>What <c>is</c> she <c>like</c>?</td><td>What is her character?</td><td>She is kind and funny.</td></tr>
    <tr><td>What does she <c>look like</c>?</td><td>What is her appearance?</td><td>She is tall. She has long hair.</td></tr>
    <tr><td>She <c>looks like</c> her mother.</td><td>They have a similar appearance.</td><td>—</td></tr>
  </tbody></table>
  <div class="support"><p>Useful character words: kind, friendly, funny, nice, quiet.</p></div>`,
);

const readingHtml = `<h3>A New Life in Germany</h3>
  <p>Hi! My name <g>is</g> Emma. I <g>am</g> 30 years old. I <g>am</g> from Ukraine, but now I live in Germany, in a small city.</p>
  <p>My <v>appearance</v> <g>is</g> simple: I <g>am</g> <v>short</v>, my <v>hair</v> <g>is</g> <v>long</v> and dark, and I have <v>freckles</v>. I <g>am not</g> very <v>sporty</v>, but I <g>am</g> <v>in good shape</v>, because I walk a lot.</p>
  <p>My hobby <g>is</g> mushrooms! Every weekend I go to the forest with a big bag. I love it. The forest <g>is</g> quiet and beautiful.</p>
  <p>My neighbour <g>is</g> Mr Fisher. He <g>is</g> <v>in his 60s</v>. He <g>is</g> <v>tall</v> and a bit <v>overweight</v>. He has a big grey <v>beard</v> and a <v>moustache</v>, and he has a lot of <v>wrinkles</v>. <c>What is he like?</c> Well, he <g>is not</g> very friendly. He says “Hello”, and that's it.</p>
  <p>People here <g>are</g> OK, but they <g>aren't</g> very friendly. It <g>is</g> hard for me sometimes.</p>
  <p>But I have a friend here — Lucy. She <g>is</g> from England. She <g>is</g> <v>in her 20s</v>. She <g>is</g> <v>pretty</v> and <v>athletic</v>, and her <v>hair</v> <g>is</g> <v>short</v>. Lucy <g>is</g> very kind and funny. She <c>likes</c> mushrooms too! On Sundays we go to the forest together.</p>`;

const dialogueOneHtml = `<h3>At the Train Station</h3>
  <p><b>Lucy:</b> Hi, Emma! Can you help me? My brother Jack is at the train station, but I'm at work.</p>
  <p><b>Emma:</b> Sure! What does he look like?</p>
  <p><b>Lucy:</b> He's tall and athletic. He's in his 30s.</p>
  <p><b>Emma:</b> Is his hair long?</p>
  <p><b>Lucy:</b> No, it isn't. It's short. And he has a beard.</p>
  <p><b>Emma:</b> A beard and a moustache?</p>
  <p><b>Lucy:</b> No, only a beard.</p>
  <p><b>Emma:</b> OK. And what is he like? Is he friendly?</p>
  <p><b>Lucy:</b> Yes, he is! He's very friendly and funny. And he likes coffee — so go to the cafe at the station.</p>
  <p><b>Emma:</b> Great! I can be there in 20 minutes.</p>
  <p><b>Lucy:</b> Thank you! You're the best!</p>`;

const dialogueTwoHtml = `<h3>A Meeting in the Forest</h3>
  <p><b>Mr Fisher:</b> Good morning!</p>
  <p><b>Emma:</b> Oh! Mr Fisher? Good morning! Are you here for mushrooms too?</p>
  <p><b>Mr Fisher:</b> Yes, I am. I like mushrooms very much. I'm here every Saturday.</p>
  <p><b>Emma:</b> Really? Me too!</p>
  <p><b>Mr Fisher:</b> Your bag is very big!</p>
  <p><b>Emma:</b> Yes, it is. But it isn't full. Look — only five mushrooms.</p>
  <p><b>Mr Fisher:</b> Five is good! Are you from Poland?</p>
  <p><b>Emma:</b> No, I'm not. I'm from Ukraine.</p>
  <p><b>Mr Fisher:</b> Ukraine! My grandson's wife is from Ukraine too.</p>
  <p><b>Emma:</b> Really? What is she like?</p>
  <p><b>Mr Fisher:</b> She's very kind and funny. And she's pretty: she has long hair and freckles — like you!</p>
  <p><b>Emma:</b> Ha-ha, thank you! And what does your grandson look like?</p>
  <p><b>Mr Fisher:</b> He's tall and handsome. He's in his 30s. He's very sporty — he plays football every weekend. And he has a beard, like me!</p>
  <p><b>Emma:</b> And what does he like? Mushrooms?</p>
  <p><b>Mr Fisher:</b> No! He only likes pizza!</p>
  <p><b>Emma:</b> Ha-ha! You walk a lot, Mr Fisher. You're in good shape!</p>
  <p><b>Mr Fisher:</b> Thank you! I'm in my 60s, look at my wrinkles… and I'm a bit overweight. But my legs are strong!</p>
  <p><b>Emma:</b> Mr Fisher, you're very friendly! People here aren't always friendly with me.</p>
  <p><b>Mr Fisher:</b> I know. People here are a bit cold at first. But we aren't bad — we just need time.</p>
  <p><b>Emma:</b> I see. Thank you!</p>
  <p><b>Mr Fisher:</b> Come with me. I know a very good place with a lot of mushrooms. And call me Frank!</p>
  <p><b>Emma:</b> Great! Thank you, Frank!</p>`;

export const a1AppearanceSections: RegularLessonSection[] = [
  {
    id: "01-vocabulary",
    title: "📖 Vocabulary · Appearance",
    tone: "vocab",
    studentHtml: "",
    teacherHtml: "",
    defaultOpen: true,
  },
  warmup,
  wordOrderGrammar,
  toBeGrammar,
  likeGrammar,
  checkedSection("06-word-order-practice", "Practice 1 · Word order", "Put the words in the correct order.", [
    { prompt: "is / tall / my brother → ___", answer: "My brother is tall." },
    { prompt: "a beard / has / my dad / and a moustache → ___", answer: "My dad has a beard and a moustache." },
    { prompt: "not / she / overweight / is → ___", answer: "She is not overweight. / She isn't overweight." },
    { prompt: "in / your sister / is / her teens / ? → ___", answer: "Is your sister in her teens?" },
  ]),
  checkedSection("07-to-be-practice", "Practice 2 · am, is, are", "Complete each sentence with am, is or are.", [
    { prompt: "I ___ 30 years old.", answer: "am" },
    { prompt: "My husband ___ tall and athletic.", answer: "is" },
    { prompt: "Her hair ___ long.", answer: "is" },
    { prompt: "We ___ from Ukraine, but we live in Germany.", answer: "are" },
    { prompt: "Your children ___ in their teens.", answer: "are" },
    { prompt: "I ___ not very sporty.", answer: "am" },
  ]),
  checkedSection("08-question-practice", "Practice 3 · Make questions", "Rewrite each statement as a question.", [
    { prompt: "She is pretty. → ___", answer: "Is she pretty?" },
    { prompt: "They are in their 20s. → ___", answer: "Are they in their 20s?" },
    { prompt: "You are in good shape. → ___", answer: "Are you in good shape?" },
    { prompt: "Her brothers are athletic. → ___", answer: "Are her brothers athletic?" },
    { prompt: "Emma is 30. (How old…?) → ___", answer: "How old is Emma?" },
    { prompt: "His hair is short. → ___", answer: "Is his hair short?" },
  ]),
  checkedSection("09-short-answers", "Practice 4 · Short answers", "Write the correct short answer. (+) means yes; (−) means no.", [
    { prompt: "Is your mother tall? (+) → ___", answer: "Yes, she is." },
    { prompt: "Are you sporty? (−) → ___", answer: "No, I'm not. / No, I am not." },
    { prompt: "Is your brother in his 30s? (+) → ___", answer: "Yes, he is." },
    { prompt: "Are your parents overweight? (−) → ___", answer: "No, they aren't. / No, they are not." },
    { prompt: "Is his beard long? (−) → ___", answer: "No, it isn't. / No, it is not." },
    { prompt: "Are we in good shape? (+) → ___", answer: "Yes, we are." },
  ]),
  checkedSection("10-like-practice", "Practice 5 · like, be like, look like", "Complete each sentence or answer.", [
    { prompt: "What does your sister ___? — She is short and she has freckles.", answer: "look like" },
    { prompt: "What ___ your new neighbour like? — He is very friendly.", answer: "is" },
    { prompt: "What does Tom ___? — He likes football and mushrooms.", answer: "like" },
    { prompt: "Kate ___ her mother: they both have long hair and freckles.", answer: "looks like" },
    { prompt: "What ___ your friends like? — They are kind and funny.", answer: "are" },
    { prompt: "My dad ___ mushrooms.", answer: "likes" },
    { prompt: "What does he look like? → ___", answer: "He is tall and athletic." },
    { prompt: "What is she like? → ___", answer: "She is quiet and nice." },
  ]),
  contentSection("11-reading", "Reading · A New Life in Germany", "reading", readingHtml),
  openQuestionsSection("12-reading-questions", "Reading · Questions", "Write a short answer to each question.", [
    { prompt: "How old is Emma?", answer: "She is 30 years old." },
    { prompt: "Where is Emma from?", answer: "She is from Ukraine." },
    { prompt: "What does Emma look like?", answer: "She is short, her hair is long and dark, and she has freckles." },
    { prompt: "Is Emma sporty?", answer: "No, she isn't very sporty, but she is in good shape." },
    { prompt: "What does Mr Fisher look like?", answer: "He is tall and a bit overweight. He has a grey beard, a moustache and wrinkles." },
    { prompt: "What is Mr Fisher like?", answer: "At first, he is not very friendly." },
    { prompt: "Is Lucy in her 30s?", answer: "No, she isn't. She is in her 20s." },
    { prompt: "What is Lucy like?", answer: "She is very kind and funny." },
  ], "reading"),
  trueFalseSection("13-reading-true-false", "Reading · True or False", [
    { prompt: "Emma lives in Ukraine.", answer: "F", explanation: "She lives in Germany." },
    { prompt: "Emma is tall.", answer: "F", explanation: "She is short." },
    { prompt: "Emma has freckles.", answer: "T" },
    { prompt: "Mr Fisher is in his 60s.", answer: "T" },
    { prompt: "Mr Fisher has a beard but no moustache.", answer: "F", explanation: "He has a beard and a moustache." },
    { prompt: "People in the city are very friendly.", answer: "F", explanation: "They aren't very friendly at first." },
    { prompt: "Lucy is athletic.", answer: "T" },
    { prompt: "Lucy likes mushrooms.", answer: "T" },
  ]),
  contentSection("14-dialogue-one", "Dialogue 1 · At the Train Station", "dialogue", dialogueOneHtml),
  openQuestionsSection("15-dialogue-one-questions", "Dialogue 1 · Questions", "Answer in complete short sentences.", [
    { prompt: "Where is Jack?", answer: "He is at the train station." },
    { prompt: "Where is Lucy?", answer: "She is at work." },
    { prompt: "Is Jack short?", answer: "No, he isn't. He is tall." },
    { prompt: "How old is Jack?", answer: "He is in his 30s." },
    { prompt: "Is his hair long?", answer: "No, it isn't. It is short." },
    { prompt: "What is Jack like?", answer: "He is very friendly and funny." },
    { prompt: "What does Jack like?", answer: "He likes coffee." },
    { prompt: "What does Jack look like? Give all the details.", answer: "He is tall and athletic, he is in his 30s, his hair is short, and he has a beard." },
  ], "dialogue"),
  trueFalseSection("16-dialogue-one-true-false", "Dialogue 1 · True or False", [
    { prompt: "Jack is Lucy's brother.", answer: "T" },
    { prompt: "Lucy is at the station.", answer: "F", explanation: "She is at work." },
    { prompt: "Jack is in his 20s.", answer: "F", explanation: "He is in his 30s." },
    { prompt: "Jack is athletic.", answer: "T" },
    { prompt: "Jack's hair is long.", answer: "F", explanation: "It is short." },
    { prompt: "Jack has a moustache.", answer: "F", explanation: "He only has a beard." },
    { prompt: "Jack is friendly.", answer: "T" },
    { prompt: "Jack likes tea.", answer: "F", explanation: "He likes coffee." },
  ]),
  contentSection("17-dialogue-two", "Dialogue 2 · A Meeting in the Forest", "dialogue", dialogueTwoHtml),
  openQuestionsSection("18-dialogue-two-questions", "Dialogue 2 · Questions", "Answer in complete short sentences.", [
    { prompt: "Where are Emma and Mr Fisher?", answer: "They are in the forest." },
    { prompt: "Is Mr Fisher there for mushrooms?", answer: "Yes, he is." },
    { prompt: "Is Emma from Poland?", answer: "No, she isn't. She is from Ukraine." },
    { prompt: "Who in Mr Fisher's family is from Ukraine?", answer: "His grandson's wife is from Ukraine." },
    { prompt: "What is the grandson's wife like?", answer: "She is very kind and funny." },
    { prompt: "What does the grandson look like?", answer: "He is tall and handsome, he is in his 30s, and he has a beard." },
    { prompt: "What does the grandson like?", answer: "He likes pizza and football." },
    { prompt: "Are the people there bad, in Mr Fisher's opinion?", answer: "No, they aren't. They are a bit cold at first and need time." },
  ], "dialogue"),
  trueFalseSection("19-dialogue-two-true-false", "Dialogue 2 · True or False", [
    { prompt: "Mr Fisher is in the forest every Saturday.", answer: "T" },
    { prompt: "Emma's bag is full.", answer: "F", explanation: "It isn't full." },
    { prompt: "Emma has five mushrooms.", answer: "T" },
    { prompt: "The grandson's wife has short hair.", answer: "F", explanation: "She has long hair." },
    { prompt: "The grandson is in his 20s.", answer: "F", explanation: "He is in his 30s." },
    { prompt: "The grandson is sporty.", answer: "T" },
    { prompt: "Mr Fisher's first name is Frank.", answer: "T" },
    { prompt: "Mr Fisher is not friendly.", answer: "F", explanation: "He is friendly when Emma meets him in the forest." },
  ]),
];

export const a1AppearanceHomework: InteractiveHomeworkPlan = {
  kind: "INTERACTIVE_HOMEWORK_V1",
  title: "Appearance · Homework",
  intro: "Complete the written tasks, then record the description from Task 5 directly on the platform.",
  exercises: [
    {
      id: "appearance-hw-corrections",
      title: "1 · Correct the mistakes",
      instruction: "Each sentence has one mistake. Write the correct sentence.",
      kind: "fill",
      items: [
        { id: "appearance-hw-c1", prompt: "She tall. → ___", answer: "She is tall." },
        { id: "appearance-hw-c2", prompt: "My husband have a beard. → ___", answer: "My husband has a beard." },
        { id: "appearance-hw-c3", prompt: "Is long her hair? → ___", answer: "Is her hair long?" },
        { id: "appearance-hw-c4", prompt: "I am have freckles. → ___", answer: "I have freckles." },
        { id: "appearance-hw-c5", prompt: "They is in their 20s. → ___", answer: "They are in their 20s." },
        { id: "appearance-hw-c6", prompt: "What does she like? — She is tall. → ___", answer: "What does she look like? — She is tall." },
      ],
    },
    {
      id: "appearance-hw-short-forms",
      title: "2 · am, is, are and short forms",
      instruction: "Rewrite every sentence with the correct short form.",
      kind: "fill",
      items: [
        { id: "appearance-hw-s1", prompt: "I am in my 30s. → ___", answer: "I'm in my 30s." },
        { id: "appearance-hw-s2", prompt: "He is not overweight. → ___", answer: "He isn't overweight.", accepted: ["He's not overweight."] },
        { id: "appearance-hw-s3", prompt: "They are handsome. → ___", answer: "They're handsome." },
        { id: "appearance-hw-s4", prompt: "My mum is pretty. → ___", answer: "My mum's pretty." },
        { id: "appearance-hw-s5", prompt: "We are not sporty. → ___", answer: "We aren't sporty.", accepted: ["We're not sporty."] },
        { id: "appearance-hw-s6", prompt: "It is a long beard. → ___", answer: "It's a long beard." },
      ],
    },
    {
      id: "appearance-hw-personal",
      title: "3 · Questions about you",
      instruction: "Make each question and answer it about yourself with a short answer.",
      kind: "question-text",
      items: [
        { id: "appearance-hw-p1", prompt: "you / tall", answer: "Are you tall? — Yes, I am. / No, I'm not." },
        { id: "appearance-hw-p2", prompt: "your hair / long", answer: "Is your hair long? — Yes, it is. / No, it isn't." },
        { id: "appearance-hw-p3", prompt: "you / in your 30s", answer: "Are you in your 30s? — Yes, I am. / No, I'm not." },
        { id: "appearance-hw-p4", prompt: "your best friend / sporty", answer: "Is your best friend sporty? — Yes, he/she is. / No, he/she isn't." },
        { id: "appearance-hw-p5", prompt: "your parents / in good shape", answer: "Are your parents in good shape? — Yes, they are. / No, they aren't." },
        { id: "appearance-hw-p6", prompt: "you / from Germany", answer: "Are you from Germany? — Yes, I am. / No, I'm not." },
      ],
    },
    {
      id: "appearance-hw-like",
      title: "4 · like, be like, look like",
      instruction: "Complete the sentences with the correct form.",
      kind: "fill",
      items: [
        { id: "appearance-hw-l1", prompt: "What does your mother ___? — She is short and pretty.", answer: "look like" },
        { id: "appearance-hw-l2", prompt: "What ___? — He is friendly.", answer: "is your neighbour like" },
        { id: "appearance-hw-l3", prompt: "What does your brother ___? — He likes football.", answer: "like" },
        { id: "appearance-hw-l4", prompt: "My son ___ his father: they are both tall and handsome.", answer: "looks like" },
        { id: "appearance-hw-l5", prompt: "What ___? — They are nice.", answer: "are your colleagues like" },
        { id: "appearance-hw-l6", prompt: "I ___ coffee and mushrooms.", answer: "like" },
      ],
    },
    {
      id: "appearance-hw-writing",
      title: "5 · Describe a person",
      instruction: "Choose a friend, family member or neighbour. Write 6–8 simple sentences.",
      kind: "question-text",
      items: [{
        id: "appearance-hw-writing-one",
        prompt: "Answer: What does he or she look like? What is he or she like? What does he or she like? Use vocabulary from the lesson.",
        answer: "Model: My friend is in her 20s. She is short and pretty. Her hair is long and dark. She has freckles. She is friendly and funny. She likes coffee and walking.",
      }],
    },
    {
      id: "appearance-hw-speaking",
      title: "6 · Voice message",
      instruction: "Record about one minute. Describe the same person as in Task 5. You can pause, resume, listen and start again before publishing.",
      kind: "question-audio",
      items: [{
        id: "appearance-hw-speaking-one",
        prompt: "Describe the person from Task 5. Say what the person looks like, what the person is like, and what the person likes.",
      }],
    },
  ],
};

/** Installs the bundled A1 Appearance lesson into the database used by the running app. */
export async function installA1AppearanceLesson(authorId: string) {
  return db.transaction(async (tx) => {
    const [existing] = await tx
      .select({ id: lessonUnits.id })
      .from(lessonUnits)
      .where(and(eq(lessonUnits.authorId, authorId), ilike(lessonUnits.title, "A1 · Appearance & the Verb to Be")))
      .limit(1);

    const unitValues = {
      kind: "REGULAR" as const,
      title: "A1 · Appearance & the Verb to Be",
      description: "A complete beginner lesson about appearance, am/is/are and like vs look like",
      vocabNodeId: null,
      lexis: null,
      videoUrl: null,
      videoTitle: null,
      transcript: [],
      questions: { afterVideo: [], afterReading: [] },
      homework: [a1AppearanceHomework],
      activityIds: [],
      sections: a1AppearanceSections,
      updatedAt: new Date(),
    };

    const unitId = existing?.id
      ? (await tx.update(lessonUnits).set(unitValues).where(eq(lessonUnits.id, existing.id)).returning({ id: lessonUnits.id }))[0]?.id
      : (await tx.insert(lessonUnits).values({ id: randomUUID(), authorId, ...unitValues }).returning({ id: lessonUnits.id }))[0]?.id;
    if (!unitId) throw new Error("Could not save A1 Appearance lesson");

    await tx.delete(lessonWords).where(eq(lessonWords.unitId, unitId));
    await tx.insert(lessonWords).values(
      a1AppearanceVocabulary.map((entry, index) => ({
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
      await tx.update(lessonAssignments)
        .set({ openSections: [...openSections], updatedAt: new Date() })
        .where(eq(lessonAssignments.id, assignment.id));
    }

    return unitId;
  });
}
