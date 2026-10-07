import { randomUUID } from "node:crypto";
import { and, asc, eq, ilike, max } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  lessonAssignments,
  lessonFolders,
  lessonUnits,
  lessonWords,
  users,
} from "@/lib/db/schema";
import type { InteractiveHomeworkPlan } from "@/lib/lesson-homework";
import {
  addRegularLessonFocusIds,
  regularSectionKey,
  type RegularLessonSection,
  type RegularLessonTone,
} from "@/lib/regular-lesson";

const LESSON_TITLE = "A1 · Characteristics & Possessive Pronouns";
const FOLDER_NAME = "A1";
const STUDENT_NAME = "Ksenia";

type CharacteristicSeed = {
  category: string;
  sectionColor: string;
  icon: string;
  word: string;
  ipaUs: string;
  ipaUk: string;
  translation: string;
  description: string;
  note: string | null;
  examples: { en: string; tr: string }[];
};

const example = (en: string, tr: string) => ({ en, tr });

const characteristic = (
  category: string,
  sectionColor: string,
  icon: string,
  word: string,
  ipa: string,
  translation: string,
  description: string,
  examples: { en: string; tr: string }[],
  note: string | null = null,
): CharacteristicSeed => ({
  category,
  sectionColor,
  icon,
  word,
  ipaUs: ipa,
  ipaUk: ipa,
  translation,
  description,
  note,
  examples,
});

export const a1CharacteristicsVocabulary: CharacteristicSeed[] = [
  characteristic("Positive characteristics", "#10b981", "💚", "kind", "/kaɪnd/", "добрый; заботливый", "A kind person cares about other people and treats them well.", [
    example("My sister is very kind.", "Моя сестра очень добрая."),
    example("This kind woman helps her neighbours.", "Эта добрая женщина помогает соседям."),
  ]),
  characteristic("Positive characteristics", "#10b981", "🤝", "friendly", "/ˈfrend.li/", "дружелюбный", "A friendly person is pleasant and easy to talk to.", [
    example("Our new neighbour is friendly.", "Наш новый сосед дружелюбный."),
    example("They are friendly with everyone.", "Они дружелюбны со всеми."),
  ]),
  characteristic("Positive characteristics", "#10b981", "😄", "funny", "/ˈfʌn.i/", "смешной; с хорошим чувством юмора", "A funny person makes people laugh.", [
    example("Her brother is funny.", "Её брат смешной."),
    example("That story is funny.", "Та история смешная."),
  ]),
  characteristic("Positive characteristics", "#10b981", "✅", "honest", "/ˈɑː.nɪst/", "честный", "An honest person tells the truth and does not lie.", [
    example("I trust him because he is honest.", "Я доверяю ему, потому что он честный."),
    example("Are your friends honest?", "Твои друзья честные?"),
  ], "The h is silent: honest starts with a vowel sound."),
  characteristic("Positive characteristics", "#10b981", "🫶", "helpful", "/ˈhelp.fəl/", "готовый помочь; отзывчивый", "A helpful person is ready to help other people.", [
    example("This doctor is very helpful.", "Этот врач очень отзывчивый."),
    example("Thank you. Your advice is helpful.", "Спасибо. Твой совет полезен."),
  ]),
  characteristic("Work and energy", "#3b82f6", "🐝", "hard-working", "/ˌhɑːrdˈwɜːr.kɪŋ/", "трудолюбивый", "A hard-working person works a lot and does their work carefully.", [
    example("My parents are hard-working.", "Мои родители трудолюбивые."),
    example("She has a job and she is very hard-working.", "У неё есть работа, и она очень трудолюбивая."),
  ]),
  characteristic("Work and energy", "#3b82f6", "🛋️", "lazy", "/ˈleɪ.zi/", "ленивый", "A lazy person does not want to work or be active.", [
    example("Their cat is cute but lazy.", "Их кот милый, но ленивый."),
    example("I am a little bit lazy today.", "Сегодня я немного ленивый."),
  ]),
  characteristic("Work and energy", "#3b82f6", "🏃", "active", "/ˈæk.tɪv/", "активный", "An active person likes doing things and moving around.", [
    example("My grandmother is very active.", "Моя бабушка очень активная."),
    example("Our children are active and sporty.", "Наши дети активные и спортивные."),
  ]),
  characteristic("Communication", "#f59e0b", "🤫", "quiet", "/ˈkwaɪ.ət/", "тихий; молчаливый", "A quiet person does not talk very much or make much noise.", [
    example("His daughter is quiet.", "Его дочь тихая."),
    example("The hotel is small and quiet.", "Отель маленький и тихий."),
  ]),
  characteristic("Communication", "#ef4444", "🚫", "rude", "/ruːd/", "грубый; невежливый", "A rude person is not polite and may speak badly to people.", [
    example("That man is rude to the doctor.", "Тот мужчина груб с врачом."),
    example("Do not be rude to your family.", "Не будь груб со своей семьёй."),
  ], "Bad is general. Rude describes impolite behaviour. Evil is much stronger: morally very bad and cruel."),
];

const focus = (html: string) => addRegularLessonFocusIds(html.trim());

const section = (
  id: string,
  title: string,
  tone: RegularLessonTone,
  html: string,
  teacherHtml = html,
  defaultOpen = false,
): RegularLessonSection => ({
  id,
  title,
  tone,
  studentHtml: focus(html),
  teacherHtml: focus(teacherHtml),
  defaultOpen,
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
        teacher ? `<span class="blank ans">${item.answer}</span>` : '<span class="blank"></span>',
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

const questionsSection = (
  id: string,
  title: string,
  instruction: string,
  items: { prompt: string; answer: string }[],
): RegularLessonSection => {
  const render = (teacher: boolean) => focus(`
    <div class="support"><p>${instruction}</p></div>
    <ol>${items.map((item) => `<li>${item.prompt}${teacher ? `<div class="key"><b>Key:</b> ${item.answer}</div>` : ""}</li>`).join("")}</ol>
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

export const a1CharacteristicsSections: RegularLessonSection[] = [
  section(
    "01-vocabulary",
    "📖 Vocabulary · Characteristics",
    "vocab",
    "",
    "",
    true,
  ),
  section(
    "02-warm-up",
    "Warm-up · What are people like?",
    "warm",
    `
      <h3>Start with what you already know</h3>
      <ol>
        <li>Hello! How are you today?</li>
        <li>What is your name? Where are you from?</li>
        <li>Who is in your family?</li>
        <li>Who is a good person in your family?</li>
        <li>Are you active today or a little bit tired?</li>
      </ol>
      <div class="support"><p>Useful pattern: <b>What is he / she like?</b> — He / She is kind and friendly.</p></div>
    `,
    undefined,
    true,
  ),
  section(
    "03-characteristics",
    "Vocabulary · Meaning and opposites",
    "vocab",
    `
      <h3>Ten useful words</h3>
      <table><thead><tr><th>Positive</th><th>Work / energy</th><th>Communication</th></tr></thead><tbody>
        <tr><td>kind</td><td>hard-working</td><td>friendly</td></tr>
        <tr><td>honest</td><td>active</td><td>funny</td></tr>
        <tr><td>helpful</td><td>lazy</td><td>quiet / rude</td></tr>
      </tbody></table>
      <h3>Useful contrasts</h3>
      <p><b>hard-working</b> ↔ <b>lazy</b></p>
      <p><b>friendly / kind</b> ↔ <b>rude</b></p>
      <p><b>active</b> ↔ <b>lazy</b></p>
      <div class="tip"><p><b>good</b> and <b>bad</b> are general. <b>Evil</b> is very strong: a person who is morally very bad and cruel. For everyday character, use a more exact word: kind, honest, rude, lazy.</p></div>
    `,
  ),
  section(
    "04-grammar-form",
    "Grammar · Possessive adjectives and pronouns",
    "grammar",
    `
      <h3>Whose thing is it?</h3>
      <p class="big"><b>my + noun</b> → This is <b>my pen</b>.</p>
      <p class="big"><b>mine</b> (no noun) → This pen is <b>mine</b>.</p>
      <table><thead><tr><th>Person</th><th>Before a noun</th><th>Without a noun</th><th>Example</th></tr></thead><tbody>
        <tr><td>I</td><td>my</td><td><b>mine</b></td><td>It is my key. The key is mine.</td></tr>
        <tr><td>you</td><td>your</td><td><b>yours</b></td><td>It is your bag. The bag is yours.</td></tr>
        <tr><td>he</td><td>his</td><td><b>his</b></td><td>It is his phone. The phone is his.</td></tr>
        <tr><td>she</td><td>her</td><td><b>hers</b></td><td>It is her map. The map is hers.</td></tr>
        <tr><td>it</td><td>its</td><td><b>—</b></td><td>The dog likes its toy.</td></tr>
        <tr><td>we</td><td>our</td><td><b>ours</b></td><td>It is our room. The room is ours.</td></tr>
        <tr><td>they</td><td>their</td><td><b>theirs</b></td><td>It is their car. The car is theirs.</td></tr>
      </tbody></table>
      <div class="warn"><p>There is normally <b>no independent possessive pronoun for it</b>. Say: <b>The dog likes its toy.</b> Do not teach or use: <i>The toy is its.</i></p></div>
    `,
  ),
  section(
    "05-grammar-use",
    "Grammar · How to choose",
    "grammar",
    `
      <h3>One simple question</h3>
      <p class="big">Is there a noun after the word?</p>
      <table><thead><tr><th>Yes: adjective</th><th>No: pronoun</th></tr></thead><tbody>
        <tr><td>This is <b>my pen</b>.</td><td>This pen is <b>mine</b>.</td></tr>
        <tr><td>That is <b>her job</b>.</td><td>That job is <b>hers</b>.</td></tr>
        <tr><td>These are <b>their keys</b>.</td><td>These keys are <b>theirs</b>.</td></tr>
      </tbody></table>
      <h3>Questions</h3>
      <p><b>Whose pen is this?</b> — It is mine.</p>
      <p><b>Is this your pen?</b> — Yes, it is mine. / No, it is hers.</p>
      <div class="warn"><p>❌ This is mine pen. ✅ This is my pen. ✅ This pen is mine.</p></div>
      <div class="warn"><p>❌ The bag is her. ✅ The bag is hers.</p></div>
      <div class="warn"><p>❌ Your's / her's / our's. ✅ yours / hers / ours. No apostrophe.</p></div>
      <div class="tip"><p><b>his</b> is the same in both columns: his phone / The phone is his.</p></div>
    `,
  ),
  checkedSection(
    "06-vocabulary-practice",
    "Practice 1 · Choose the characteristic",
    "Complete each sentence with one word: kind, friendly, funny, honest, helpful, hard-working, lazy, active, quiet or rude.",
    [
      { prompt: "Marta tells the truth. She is ___.", answer: "honest" },
      { prompt: "Ben works a lot and does his job well. He is ___.", answer: "hard-working" },
      { prompt: "Nina is ready to help everyone. She is ___.", answer: "helpful" },
      { prompt: "Tom does not want to work today. He is ___.", answer: "lazy" },
      { prompt: "My neighbour says hello and talks to everyone. He is ___.", answer: "friendly" },
      { prompt: "The man says bad things to the doctor. He is ___.", answer: "rude" },
      { prompt: "My brother makes us laugh. He is ___.", answer: "funny" },
      { prompt: "The child does not talk very much. She is ___.", answer: "quiet" },
    ],
  ),
  checkedSection(
    "07-pronouns-practice",
    "Practice 2 · my or mine?",
    "Complete each sentence with the correct possessive form.",
    [
      { prompt: "This is ___ pen. (I)", answer: "my" },
      { prompt: "This pen is ___. (I)", answer: "mine" },
      { prompt: "Is that ___ email? (you)", answer: "your" },
      { prompt: "Yes, the email is ___. (I)", answer: "mine" },
      { prompt: "Anna is helpful. This app is ___. (she)", answer: "hers" },
      { prompt: "Max is funny. ___ stories are always good. (he)", answer: "His" },
      { prompt: "We live in this hotel. This room is ___. (we)", answer: "ours" },
      { prompt: "They have two keys. These keys are ___. (they)", answer: "theirs" },
      { prompt: "The dog is quiet. ___ name is Lucky. (it)", answer: "Its" },
    ],
  ),
  checkedSection(
    "08-rewrite-practice",
    "Practice 3 · Replace the noun",
    "Rewrite the phrase with a possessive pronoun.",
    [
      { prompt: "This is my map. → The map is ___.", answer: "mine" },
      { prompt: "That is her coffee. → The coffee is ___.", answer: "hers" },
      { prompt: "These are our keys. → The keys are ___.", answer: "ours" },
      { prompt: "It is his job. → The job is ___.", answer: "his" },
      { prompt: "Those are their bags. → The bags are ___.", answer: "theirs" },
      { prompt: "This is your quiz. → The quiz is ___.", answer: "yours" },
    ],
  ),
  checkedSection(
    "09-mixed-practice",
    "Practice 4 · Vocabulary + grammar",
    "Use the word in brackets. Change the form when necessary.",
    [
      { prompt: "My sister is kind, but ___ sister is a little rude. (you)", answer: "your" },
      { prompt: "This helpful doctor is ___. (we)", answer: "ours" },
      { prompt: "Their son is active. ___ is quiet. (she)", answer: "Hers" },
      { prompt: "Is this funny story ___? (he)", answer: "his" },
      { prompt: "Our neighbour is hard-working. ___ is lazy. (they)", answer: "Theirs" },
      { prompt: "My pen is blue. What colour is ___? (you)", answer: "yours" },
    ],
  ),
  section(
    "10-speaking",
    "Speaking · People you know",
    "exercise",
    `
      <div class="support"><p>Answer with 2–3 simple sentences. Use <b>am / is / are</b>, a characteristic and one possessive form.</p></div>
      <ol>
        <li>What are you like?</li>
        <li>Who is a kind person in your family?</li>
        <li>Who is hard-working? What is his or her job?</li>
        <li>Are your friends active or quiet?</li>
        <li>Whose phone, key or pen is near you now?</li>
        <li>Is the thing yours or somebody else's?</li>
      </ol>
    `,
  ),
  section(
    "11-dialogue-one",
    "Dialogue 1 · A pen before the quiz",
    "dialogue",
    `
      <h3>A pen before the quiz</h3>
      <p><b>Mia:</b> Hi, Alex! Nice to see you. Are you ready for the quiz?</p>
      <p><b>Alex:</b> Hi! Yes, I am. But I need a pen. Is this blue pen yours?</p>
      <p><b>Mia:</b> No, mine is black. The blue pen is Anna's. It is hers.</p>
      <p><b>Alex:</b> Anna is very helpful. Can I use her pen?</p>
      <p><b>Mia:</b> Yes. She is kind and friendly too. She always helps us.</p>
      <p><b>Alex:</b> And whose books are these?</p>
      <p><b>Mia:</b> They are ours. Your book is on the teacher's table.</p>
      <p><b>Alex:</b> Oh, I see. This one is mine. Thank you!</p>
      <p><b>Mia:</b> No problem. Good luck with the quiz!</p>
    `,
  ),
  questionsSection(
    "12-dialogue-one-questions",
    "Dialogue 1 · Check understanding",
    "Answer in complete short sentences.",
    [
      { prompt: "Is Alex ready for the quiz?", answer: "Yes, he is." },
      { prompt: "What does Alex need?", answer: "He needs a pen." },
      { prompt: "Is the blue pen Mia's?", answer: "No, it isn't. It is Anna's / hers." },
      { prompt: "What is Anna like?", answer: "She is helpful, kind and friendly." },
      { prompt: "Whose books are on the table?", answer: "They are Mia and Alex's / theirs." },
    ],
  ),
  section(
    "13-dialogue-two",
    "Dialogue 2 · A family photo",
    "dialogue",
    `
      <h3>A family photo</h3>
      <p><b>Kate:</b> Is this your family photo?</p>
      <p><b>Leo:</b> Yes, it is mine. This is my sister, Eva.</p>
      <p><b>Kate:</b> What is she like?</p>
      <p><b>Leo:</b> She is active, funny and very honest. Her job is at a hotel.</p>
      <p><b>Kate:</b> Is that her dog?</p>
      <p><b>Leo:</b> Yes. The dog is hers. Its name is Max. It is quiet but a little lazy.</p>
      <p><b>Kate:</b> And who is this man?</p>
      <p><b>Leo:</b> He is our dad. He is hard-working and helpful. This supermarket is his.</p>
      <p><b>Kate:</b> Your family looks very friendly.</p>
      <p><b>Leo:</b> Thank you! And is that photo yours?</p>
      <p><b>Kate:</b> No, it is theirs. It is my friends' photo.</p>
    `,
  ),
  questionsSection(
    "14-dialogue-two-questions",
    "Dialogue 2 · Check understanding",
    "Answer in complete short sentences.",
    [
      { prompt: "Whose family photo is it?", answer: "It is Leo's / his." },
      { prompt: "What is Eva like?", answer: "She is active, funny and honest." },
      { prompt: "Where is Eva's job?", answer: "Her job is at a hotel." },
      { prompt: "What is the dog's name?", answer: "Its name is Max." },
      { prompt: "Is the dog active?", answer: "No. It is quiet and a little lazy." },
      { prompt: "Whose supermarket is it?", answer: "It is Leo's dad's / his." },
    ],
  ),
  section(
    "15-reading",
    "Reading · Our neighbours",
    "reading",
    `
      <h3>Our neighbours</h3>
      <p>My name is Sofia. I live with my family in a small hotel. The hotel is not ours; it is my uncle's. His name is Mark. He is hard-working and helpful. He is at the hotel every morning.</p>
      <p>Our neighbours are Paul and Emma. Their home is near the supermarket. Paul is quiet, but he is kind and honest. Emma is active, friendly and funny. She has a new job at the bank. The blue car near their home is theirs.</p>
      <p>I have a little dog. Its name is Bingo. Bingo is friendly but lazy. It likes my lamp and sleeps near it. The lamp is mine, but Bingo thinks everything is his!</p>
      <p>My family and our neighbours are different, but we like one another. We have coffee together every Sunday.</p>
    `,
  ),
  questionsSection(
    "16-reading-questions",
    "Reading · Questions",
    "Answer in complete short sentences.",
    [
      { prompt: "Is the hotel Sofia's?", answer: "No, it isn't. It is her uncle's / his." },
      { prompt: "What is Mark like?", answer: "He is hard-working and helpful." },
      { prompt: "Where do Paul and Emma live?", answer: "They live near the supermarket." },
      { prompt: "What is Emma like?", answer: "She is active, friendly and funny." },
      { prompt: "Whose blue car is it?", answer: "It is Paul and Emma's / theirs." },
      { prompt: "What is the dog's name?", answer: "Its name is Bingo." },
      { prompt: "Whose lamp is it?", answer: "It is Sofia's / hers." },
    ],
  ),
  checkedSection(
    "17-reading-true-false",
    "Reading · True or False",
    "Write T or F.",
    [
      { prompt: "The hotel is Sofia's. ___", answer: "F" },
      { prompt: "Mark is helpful. ___", answer: "T" },
      { prompt: "Paul is rude. ___", answer: "F" },
      { prompt: "Emma works at a bank. ___", answer: "T" },
      { prompt: "The blue car is theirs. ___", answer: "T" },
      { prompt: "Bingo is active. ___", answer: "F" },
    ],
  ),
  section(
    "18-role-play",
    "Role-play · Lost things",
    "dialogue",
    `
      <div class="support"><p>Use a pen, key, phone, map or book. Ask and answer. Change the object and owner every time.</p></div>
      <p><b>A:</b> Excuse me, is this your pen?</p>
      <p><b>B:</b> No, it isn't mine. Mine is blue.</p>
      <p><b>A:</b> Is it Anna's?</p>
      <p><b>B:</b> Yes, it is hers.</p>
      <p><b>A:</b> What is Anna like?</p>
      <p><b>B:</b> She is kind and helpful.</p>
      <div class="tip"><p>Try all forms: mine, yours, his, hers, ours, theirs.</p></div>
    `,
  ),
  section(
    "19-writing",
    "Writing · A person and their things",
    "exercise",
    `
      <div class="support"><p>Write 8 simple sentences about a person you know. Use at least four new characteristic words and three possessive forms.</p></div>
      <p><b>Model:</b> My friend is Anna. She is kind, active and funny. Her job is at a bank. This blue phone is hers. Our favourite app is a quiz app. The app is ours. Anna has a dog. Its name is Rex.</p>
    `,
  ),
  section(
    "20-teacher-plan",
    "Teacher guide · 60-minute route",
    "teacher",
    `
      <ol>
        <li>5 min — greetings and warm-up with familiar language.</li>
        <li>10 min — introduce ten characteristics with personal examples.</li>
        <li>10 min — contrast my/mine and complete the full pronoun table.</li>
        <li>10 min — Practices 1–4, with quick correction after each block.</li>
        <li>10 min — read and role-play Dialogue 1, then Dialogue 2.</li>
        <li>10 min — read Our neighbours and answer the questions.</li>
        <li>5 min — speaking recap: describe one person and identify three objects.</li>
      </ol>
      <div class="warn"><p>Do not present <b>its</b> as a standalone possessive pronoun. At this level, teach <b>its + noun</b> only.</p></div>
    `,
  ),
];

export const a1CharacteristicsHomework: InteractiveHomeworkPlan = {
  kind: "INTERACTIVE_HOMEWORK_V1",
  title: "Characteristics & Possessive Pronouns · Homework",
  intro: "Review the ten characteristics and practise my/mine, your/yours, his, her/hers, our/ours and their/theirs.",
  exercises: [
    {
      id: "characteristics-hw-vocabulary",
      title: "1 · Choose the characteristic",
      instruction: "Complete each sentence with the correct word.",
      kind: "fill",
      items: [
        { id: "char-v1", prompt: "A person who tells the truth is ___.", answer: "honest" },
        { id: "char-v2", prompt: "A person who is ready to help is ___.", answer: "helpful" },
        { id: "char-v3", prompt: "A person who works a lot is ___.", answer: "hard-working", accepted: ["hardworking"] },
        { id: "char-v4", prompt: "A person who does not want to work is ___.", answer: "lazy" },
        { id: "char-v5", prompt: "A person who makes people laugh is ___.", answer: "funny" },
        { id: "char-v6", prompt: "A person who is not polite is ___.", answer: "rude" },
      ],
    },
    {
      id: "characteristics-hw-possessives",
      title: "2 · Possessive adjective or pronoun",
      instruction: "Write the correct form of the word in brackets.",
      kind: "fill",
      items: [
        { id: "char-p1", prompt: "This is ___ pen. (I)", answer: "my" },
        { id: "char-p2", prompt: "The pen is ___. (I)", answer: "mine" },
        { id: "char-p3", prompt: "Is this ___ phone? (you)", answer: "your" },
        { id: "char-p4", prompt: "No, it is ___. (she)", answer: "hers" },
        { id: "char-p5", prompt: "The dog likes ___ toy. (it)", answer: "its" },
        { id: "char-p6", prompt: "The hotel room is ___. (we)", answer: "ours" },
        { id: "char-p7", prompt: "These keys are ___. (they)", answer: "theirs" },
        { id: "char-p8", prompt: "That is ___ job. (he)", answer: "his" },
      ],
    },
    {
      id: "characteristics-hw-rewrite",
      title: "3 · Rewrite without the noun",
      instruction: "Use a possessive pronoun.",
      kind: "fill",
      items: [
        { id: "char-r1", prompt: "This is my coffee. → The coffee is ___.", answer: "mine" },
        { id: "char-r2", prompt: "That is her app. → The app is ___.", answer: "hers" },
        { id: "char-r3", prompt: "These are our books. → The books are ___.", answer: "ours" },
        { id: "char-r4", prompt: "It is their car. → The car is ___.", answer: "theirs" },
        { id: "char-r5", prompt: "This is your key. → The key is ___.", answer: "yours" },
      ],
    },
    {
      id: "characteristics-hw-translation",
      title: "4 · Translate into English",
      instruction: "Use the new vocabulary and grammar.",
      kind: "translate",
      translationDirection: "to-english",
      translationLanguage: "RU",
      items: [
        { id: "char-t1", prompt: "Моя сестра добрая и дружелюбная.", answer: "My sister is kind and friendly." },
        { id: "char-t2", prompt: "Этот синий телефон мой.", answer: "This blue phone is mine." },
        { id: "char-t3", prompt: "Их дети активные, а наши тихие.", answer: "Their children are active, but ours are quiet." },
        { id: "char-t4", prompt: "Чья это ручка? Она её.", answer: "Whose pen is this? It is hers.", accepted: ["Whose is this pen? It is hers."] },
        { id: "char-t5", prompt: "У собаки есть игрушка. Её игрушка новая.", answer: "The dog has a toy. Its toy is new." },
        { id: "char-t6", prompt: "Его брат трудолюбивый, но мой немного ленивый.", answer: "His brother is hard-working, but mine is a little bit lazy.", accepted: ["His brother is hardworking, but mine is a little bit lazy."] },
      ],
    },
    {
      id: "characteristics-hw-describe",
      title: "5 · Describe the word",
      instruction: "Explain the characteristic in simple English and add one example.",
      kind: "describe",
      items: a1CharacteristicsVocabulary.map((entry, index) => ({
        id: `char-d${index + 1}`,
        prompt: entry.word,
        word: entry.word,
      })),
    },
    {
      id: "characteristics-hw-writing",
      title: "6 · Describe two people",
      instruction: "Write 8–10 simple sentences. Use at least five characteristic words and four possessive forms.",
      kind: "question-text",
      items: [{
        id: "char-writing-1",
        prompt: "Describe two people you know. What are they like? What things are theirs?",
        answer: "Model: My friend is Kate. She is kind and active. Her phone is blue. The blue phone is hers. My brother is quiet but funny. His job is at a hotel. This car is his. Our friends are friendly.",
      }],
    },
    {
      id: "characteristics-hw-speaking",
      title: "7 · Voice message",
      instruction: "Record 45–60 seconds. Speak in simple complete sentences.",
      kind: "question-audio",
      items: [{
        id: "char-speaking-1",
        prompt: "Describe one person in your family. Say what the person is like and use mine, his, hers, ours or theirs at least twice.",
      }],
    },
  ],
};

/** Installs the A1 lesson and assigns it to Ksenia, without duplicating either record. */
export async function installA1CharacteristicsLesson() {
  const [author] = await db
    .select({ id: users.id, name: users.name })
    .from(users)
    .where(eq(users.role, "TEACHER"))
    .orderBy(asc(users.createdAt))
    .limit(1);
  if (!author) throw new Error("No teacher account found");

  const [student] = await db
    .select({ id: users.id, name: users.name, level: users.level })
    .from(users)
    .where(and(eq(users.role, "STUDENT"), ilike(users.name, STUDENT_NAME)))
    .limit(1);
  if (!student) throw new Error(`Student ${STUDENT_NAME} was not found`);

  let [folder] = await db
    .select({ id: lessonFolders.id })
    .from(lessonFolders)
    .where(and(eq(lessonFolders.authorId, author.id), ilike(lessonFolders.name, FOLDER_NAME)))
    .limit(1);
  if (!folder) {
    const [lastFolderOrder] = await db.select({ value: max(lessonFolders.sortOrder) }).from(lessonFolders).where(eq(lessonFolders.authorId, author.id));
    [folder] = await db.insert(lessonFolders).values({
      id: randomUUID(),
      authorId: author.id,
      name: FOLDER_NAME,
      sortOrder: Number(lastFolderOrder?.value ?? 0) + 10,
    }).returning({ id: lessonFolders.id });
  }
  if (!folder) throw new Error("Could not find or create the A1 folder");

  const result = await db.transaction(async (tx) => {
    const [existing] = await tx
      .select({ id: lessonUnits.id, sortOrder: lessonUnits.sortOrder })
      .from(lessonUnits)
      .where(and(eq(lessonUnits.authorId, author.id), ilike(lessonUnits.title, LESSON_TITLE)))
      .limit(1);
    const [lastOrder] = await tx.select({ value: max(lessonUnits.sortOrder) }).from(lessonUnits).where(eq(lessonUnits.folderId, folder.id));
    const unitValues = {
      kind: "REGULAR" as const,
      title: LESSON_TITLE,
      description: "Pre-A1 → A1 · 10 essential character adjectives · possessive pronouns · two dialogues · reading · complete practice",
      folderId: folder.id,
      sortOrder: existing?.sortOrder ?? Number(lastOrder?.value ?? 0) + 10,
      vocabNodeId: null,
      lexis: null,
      videoUrl: null,
      videoTitle: null,
      transcript: [],
      questions: { afterVideo: [], afterReading: [] },
      homework: [a1CharacteristicsHomework],
      activityIds: [],
      sections: a1CharacteristicsSections,
      updatedAt: new Date(),
    };

    const unitId = existing?.id
      ? (await tx.update(lessonUnits).set(unitValues).where(eq(lessonUnits.id, existing.id)).returning({ id: lessonUnits.id }))[0]?.id
      : (await tx.insert(lessonUnits).values({ id: randomUUID(), authorId: author.id, ...unitValues }).returning({ id: lessonUnits.id }))[0]?.id;
    if (!unitId) throw new Error("Could not save A1 Characteristics lesson");

    await tx.delete(lessonWords).where(eq(lessonWords.unitId, unitId));
    await tx.insert(lessonWords).values(a1CharacteristicsVocabulary.map((entry, index) => ({
      id: randomUUID(),
      unitId,
      ...entry,
      imageUrl: null,
      sortOrder: index + 1,
    })));

    const [existingAssignment] = await tx
      .select({ id: lessonAssignments.id, openSections: lessonAssignments.openSections })
      .from(lessonAssignments)
      .where(and(eq(lessonAssignments.unitId, unitId), eq(lessonAssignments.studentId, student.id)))
      .limit(1);
    const openSections = new Set(existingAssignment?.openSections ?? []);
    openSections.add(regularSectionKey("01-vocabulary"));
    openSections.add(regularSectionKey("02-warm-up"));

    const assignmentId = existingAssignment?.id
      ? (await tx.update(lessonAssignments).set({ openSections: [...openSections], updatedAt: new Date() }).where(eq(lessonAssignments.id, existingAssignment.id)).returning({ id: lessonAssignments.id }))[0]?.id
      : (await tx.insert(lessonAssignments).values({
          id: randomUUID(),
          unitId,
          studentId: student.id,
          openSections: [...openSections],
          highlights: {},
          answers: {},
        }).returning({ id: lessonAssignments.id }))[0]?.id;
    if (!assignmentId) throw new Error("Could not assign lesson to Ksenia");

    return { unitId, assignmentId };
  });

  return {
    ...result,
    title: LESSON_TITLE,
    folder: FOLDER_NAME,
    teacher: author.name,
    student: student.name,
    studentLevel: student.level,
    vocabularyWords: a1CharacteristicsVocabulary.length,
    sections: a1CharacteristicsSections.length,
    homeworkExercises: a1CharacteristicsHomework.exercises.length,
    homeworkItems: a1CharacteristicsHomework.exercises.reduce((sum, exercise) => sum + exercise.items.length, 0),
  };
}
