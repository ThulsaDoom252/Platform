import { normalizeInteractiveHomework, type InteractiveHomeworkPlan } from "../lesson-homework";
import {
  addRegularLessonFocusIds, normalizeRegularLessonSections, regularAnswerMap,
  type RegularLessonSection, type RegularLessonTone,
} from "../regular-lesson";
import { cleanScriptHtml } from "../script-html";
import {
  DAILY_ROUTINES_WORDS, DAILY_ROUTINES_GUESSING, DAILY_ROUTINES_PERSONAL_QUESTIONS,
  DAILY_ROUTINES_GRAMMAR_GROUPS, DAILY_ROUTINES_CREATIVE, DAILY_ROUTINES_HOMEWORK,
} from "./b1-more-daily-routines-activities";
import { DAILY_ROUTINES_PASSAGES } from "./b1-more-daily-routines-passages";

export const MORE_DAILY_ROUTINES_LESSON_TITLE = "B1 · More daily routines";
export const MORE_DAILY_ROUTINES_REFERENCES = [
  { title: "British Council · Different uses of used to", url: "https://learnenglish.britishcouncil.org/free-resources/grammar/b1-b2-grammar/different-uses-of-used-to" },
  { title: "Cambridge · Used to", url: "https://dictionary.cambridge.org/us/grammar/british-grammar/used-to%C2%A0" },
];

const escape = (text: string) => text.replaceAll("&", "&amp;").replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;").replaceAll('"', "&quot;");
const safe = (html: string) => cleanScriptHtml(addRegularLessonFocusIds(html));
const possessive = "(?:my|your|his|her|our|their|one['’]s)";
const have = "(?:have|has|had|having)";
const make = "(?:make|makes|made|making)";

/** Covers the actual inflections of all nineteen screenshot targets, not unrelated routine verbs. */
export const DAILY_ROUTINES_LEXICAL_PATTERNS: Readonly<Record<string, string>> = {
  "to hit the snooze button": "(?:hit|hits|hitting) the snooze button",
  "to have a shave": `${have} a shave`,
  "to commute": "commut(?:e|es|ed|ing)",
  "to make one's own dinner": `${make} ${possessive} own dinner`,
  "to run errands": "(?:run|runs|ran|running) errands",
  "to set one's alarm": `(?:set|sets|setting) ${possessive} alarm`,
  "to make one's own lunch": `${make} ${possessive} own lunch`,
  "to have an early night": `${have} an early night`,
  "to feed the dog": "(?:feed|feeds|fed|feeding) the dog",
  "to chill on the sofa": "chill(?:s|ed|ing)? on the sofa",
  "to walk the dog": "walk(?:s|ed|ing)? the dog",
  "to check one's messages": `check(?:s|ed|ing)? ${possessive} messages`,
  "to check one's phone": `check(?:s|ed|ing)? ${possessive} phone`,
  "to have a nap": `${have} a nap`,
  "to stay up late": "stay(?:s|ed|ing)? up late",
  "to feed the cat": "(?:feed|feeds|fed|feeding) the cat",
  "to make one's own breakfast": `${make} ${possessive} own breakfast`,
  "to sleep in": "(?:sleep|sleeps|slept|sleeping) in",
  "to grab a coffee": "grab(?:s|bed|bing)? a coffee",
};
const lexical = new RegExp(`(?<![\\p{L}\\p{N}])(?:${Object.values(DAILY_ROUTINES_LEXICAL_PATTERNS).join("|")})(?![\\p{L}\\p{N}])`, "giu");
const grammar = /\b(?:(?:(?:am|is|are|was|were|be|been|being|get|gets|got|gotten|getting)(?:\s+not)?|(?:I'm|you're|he's|she's|we're|they're|isn't|aren't|wasn't|weren't)|(?:didn't|did not)|did\s+(?:I|you|he|she|it|we|they))\s+)?(?:used|use)\s+to(?:\s+[\p{L}]+)?/giu;

/** Escape plain authored text first; merge overlaps so grammar and vocabulary both remain bold. */
export function highlightDailyRoutinesText(text: string) {
  const ranges = [lexical, grammar].flatMap(pattern => [...text.matchAll(new RegExp(pattern))]
    .map(match => ({ start: match.index, end: match.index + match[0].length })));
  ranges.sort((left, right) => left.start - right.start || right.end - left.end);
  const merged: { start: number; end: number }[] = [];
  for (const range of ranges) {
    const previous = merged.at(-1);
    if (previous && range.start <= previous.end) previous.end = Math.max(previous.end, range.end);
    else merged.push({ ...range });
  }
  let result = "", cursor = 0;
  for (const range of merged) {
    result += escape(text.slice(cursor, range.start)) + `<strong>${escape(text.slice(range.start, range.end))}</strong>`;
    cursor = range.end;
  }
  return result + escape(text.slice(cursor));
}

type PracticeItem = { prompt: string; answer: string; accepted?: string[]; explanation: string };
function answerControl(item: PracticeItem, teacher: boolean) {
  return teacher
    ? `<span class="ans">${escape([...new Set([item.answer, ...(item.accepted ?? [])])].join(" / "))}</span>`
    : '<span class="blank"></span>';
}
function guessingHtml(teacher: boolean) {
  return `<h3>Guess the routine</h3><p class="instr">Read the description and write the matching expression. Use the infinitive with to; the base form without to is also accepted. For one's, you may use my or your. There is no word bank: recall the lesson phrases.</p>
    <ol class="sentence-check">${DAILY_ROUTINES_GUESSING.map(item => `<li>${escape(item.prompt)} → ${answerControl(item, teacher)}${teacher ? `<div class="key">${escape(item.explanation)}</div>` : ""}</li>`).join("")}</ol>`;
}
function grammarPracticeHtml(teacher: boolean) {
  return DAILY_ROUTINES_GRAMMAR_GROUPS.map(group => `<h3>${escape(group.title)}</h3><p class="instr">${escape(group.instruction)}</p>
    <ol class="sentence-check">${group.items.map(item => {
      if (item.prompt.split("___").length !== 2) throw new Error(`Invalid daily routines gap: ${group.id}`);
      const [before, after] = item.prompt.split("___");
      return `<li>${highlightDailyRoutinesText(before)}${answerControl(item, teacher)}${highlightDailyRoutinesText(after)}${teacher ? `<div class="key">${escape(item.explanation)}</div>` : ""}</li>`;
    }).join("")}</ol>`).join("");
}
function passageHtml(passage: typeof DAILY_ROUTINES_PASSAGES[number], teacher: boolean) {
  const body = passage.kind === "reading"
    ? passage.paragraphs!.map((paragraph, index) => `<p><span class="pn">${index + 1}</span> ${highlightDailyRoutinesText(paragraph)}</p>`).join("")
    : `<div class="lines">${passage.turns!.map((turn, index) => `<p><span class="ln">${index + 1}</span> <span class="sp">${escape(turn.speaker)}:</span> ${highlightDailyRoutinesText(turn.text)}</p>`).join("")}</div>`;
  return `${body}<h3>True or False? · Find the evidence</h3><p class="instr">Choose True or False. Correct each false statement and point to the relevant part of the passage.</p>
    <ol class="tf">${passage.trueFalse.map(item => `<li>${escape(item.prompt)} ${teacher ? `<span class="ans">${item.answer ? "True / T" : "False / F"}</span><div class="key">${escape(item.explanation)}</div>` : '<span class="tfbox"></span>'}</li>`).join("")}</ol>
    <h3>Questions · Talk about the passage</h3><p class="instr">Answer the eight questions in your own words. A clear short answer is enough. The teacher has suggested answers, not a script to memorise.</p>
    <ol>${passage.questions.map(item => `<li>${escape(item.prompt)}${teacher ? `<div class="key">Suggested answer: ${escape(item.suggestedAnswer)}</div>` : ""}</li>`).join("")}</ol>`;
}

const grammarGuide = `<h3>Three different meanings</h3>
  <table><thead><tr><th>Pattern</th><th>Meaning</th><th>Routine example</th></tr></thead><tbody>
  <tr><td><strong>used to + base verb</strong></td><td>An old habit or state that is different now.</td><td>I <strong>used to stay up late</strong>, but now I go to bed at ten.</td></tr>
  <tr><td><strong>be used to + -ing</strong></td><td>Something is already familiar or normal for someone.</td><td>She <strong>is used to commuting</strong>; the journey does not bother her.</td></tr>
  <tr><td><strong>get used to + -ing</strong></td><td>The process of becoming comfortable with a new situation.</td><td>We <strong>are getting used to making our own lunch</strong>; it is becoming easier.</td></tr></tbody></table>
  <h3>Build the sentence</h3>
  <table><thead><tr><th></th><th>Old habit</th><th>Familiar situation</th><th>Adapting</th></tr></thead><tbody>
  <tr><th>Positive</th><td>I used to sleep in.</td><td>I am used to getting up early.</td><td>I am getting used to getting up early.</td></tr>
  <tr><th>Negative</th><td>I didn't use to set an alarm.</td><td>I am not used to getting up early.</td><td>I can't get used to getting up early.</td></tr>
  <tr><th>Question</th><td>Did you use to sleep in?</td><td>Are you used to getting up early?</td><td>Are you getting used to getting up early?</td></tr></tbody></table>
  <p><strong>After did / didn't, write use to</strong> in the standard form practised here. In an ordinary positive sentence, write <strong>used to</strong>, not use to. The old-habit construction refers to the past; it is not a form for a current routine. Use the present simple for that: “I check my messages every morning.”</p>
  <p>In <strong>be/get used to</strong>, to is a preposition: follow it with a noun, a pronoun or <strong>-ing</strong>, not a base verb. Compare “I used to make lunch” with “I'm used to making lunch”. Change be or get to show the time: “I wasn't used to it”; “I got used to it”; “I'll get used to it”.</p>
  <p>When adaptation is complete by now, you can say “I've <strong>got used to making my own dinner</strong>” (British English) or “I've <strong>gotten used to making my own dinner</strong>” (American English). Both describe the change that has happened; “I'm used to making dinner” describes the resulting familiar state.</p>
  <p class="note">Meaning check: “I'm used to commuting” does not mean I enjoy it, only that it is familiar. “I'm getting used to commuting” describes adaptation in progress. “I used to commute” describes an earlier routine that has changed. Sleep in means wake or get up later than usual; have a nap means a short sleep, often during the day. Neither means the same as stay up late.</p>`;

/** Portable lesson content only. No student is assigned or moved into class by this builder. */
export function buildB1MoreDailyRoutinesLesson() {
  if (DAILY_ROUTINES_WORDS.length !== 19 || DAILY_ROUTINES_GUESSING.length !== 19 || DAILY_ROUTINES_PERSONAL_QUESTIONS.length !== 19 ||
    DAILY_ROUTINES_GRAMMAR_GROUPS.length !== 3 || DAILY_ROUTINES_GRAMMAR_GROUPS.some(group => group.items.length !== 6)) {
    throw new Error("More daily routines requires all nineteen targets and eighteen grammar items");
  }
  if (DAILY_ROUTINES_PASSAGES.length !== 3 || DAILY_ROUTINES_PASSAGES.filter(passage => passage.kind === "reading").length !== 1 ||
    DAILY_ROUTINES_PASSAGES.filter(passage => passage.kind === "dialogue").length !== 2 ||
    DAILY_ROUTINES_PASSAGES.some(passage => passage.questions.length !== 8 || passage.trueFalse.length !== 8)) {
    throw new Error("More daily routines requires one reading and two dialogues, each with eight questions and eight True/False items");
  }
  const sections: RegularLessonSection[] = [];
  const add = (id: string, title: string, tone: RegularLessonTone, studentHtml: string, teacherHtml = studentHtml, options: { teacherOnly?: boolean; defaultOpen?: boolean } = {}) => {
    sections.push({ id, title, tone, studentHtml: safe(studentHtml), teacherHtml: safe(teacherHtml), defaultOpen: options.defaultOpen === true, ...(options.teacherOnly ? { teacherOnly: true } : {}) });
  };
  add("daily-teacher", "Teacher route & answer guidance", "warm", "", `<h3>Flexible route</h3><p>This is a complete lesson pack; do not rush through all three passages in one sitting. Use one passage in class and keep the others for another meeting or select their exercises for homework. Each passage has all nineteen target expressions and the three grammar patterns.</p><p>The teacher's Answers control reveals canonical gap answers, True/False evidence and model answers to all twenty-four comprehension questions. Accept equivalent clear answers in discussion. In personal and creative tasks, the private notes are guidance rather than fixed correct personal answers.</p><p>No assumption is made about a student's job, pets, gender, shaving, coffee or family. They may use an imagined example. Commute means regular travel between home and work or a place of study; it does not mean every journey.</p><p>Grammar references; all lesson stories, examples and exercises are original:</p><ul>${MORE_DAILY_ROUTINES_REFERENCES.map(link => `<li><a href="${escape(link.url)}" target="_blank" rel="noopener noreferrer">${escape(link.title)}</a></li>`).join("")}</ul>`, { teacherOnly: true });
  add("daily-warmup", "Warm-up · Your day, your way", "warm", `<h3>Warm-up questions</h3><p class="instr">Speak about yourself or invent a character. You can pass on any personal detail.</p><ol><li>Which part of a normal day feels easiest for you, and which feels busiest?</li><li>What is one small routine that makes your day better?</li><li>How is your daily life different from a few years ago?</li><li>What change would take you a little time to adapt to?</li></ol>`);
  add("daily-vocabulary", "Vocabulary · More daily routines", "vocab", `<p>Nineteen expressions for mornings, travel, everyday tasks and evenings. Verbs are shown in the infinitive. In phrases with one's, change one's to my, your, his, her, our or their to match the person. “To commute” stays a general headword: to school, to work, etc.</p>`, undefined, { defaultOpen: true });
  add("daily-guess", "1 · Guess the routine", "exercise", guessingHtml(false), guessingHtml(true));
  const personal = `<h3>Questions · Your routines</h3><p class="instr">Use the phrase in bold in your answer where possible. If a situation does not apply to you, say so and describe an alternative or an imaginary example.</p><ol>${DAILY_ROUTINES_PERSONAL_QUESTIONS.map(question => `<li>${highlightDailyRoutinesText(question)}</li>`).join("")}</ol>`;
  add("daily-personal", "2 · Personal questions", "exercise", personal, `${personal}<div class="key">Answers are personal. Encourage a clear answer plus a reason or example. Do not assume the student works, has pets, drinks coffee or shaves. Model the target expression naturally and accept an appropriate alternative.</div>`);
  add("daily-grammar", "3 · Grammar · used to / be used to / get used to", "grammar", grammarGuide);
  add("daily-grammar-practice", "Grammar practice · Then, familiar, adapting", "exercise", grammarPracticeHtml(false), grammarPracticeHtml(true));
  for (const passage of DAILY_ROUTINES_PASSAGES) add(passage.id, passage.title, passage.kind, passageHtml(passage, false), passageHtml(passage, true));
  const creative = `<h3>Questions · ${escape(DAILY_ROUTINES_CREATIVE.title)}</h3><p class="instr">${escape(DAILY_ROUTINES_CREATIVE.instruction)}</p><ol>${DAILY_ROUTINES_CREATIVE.prompts.map(prompt => `<li>${escape(prompt)}</li>`).join("")}</ol>`;
  add("daily-creative", "Creative task · Routine remix", "exercise", creative, `${creative}<div class="key">${escape(DAILY_ROUTINES_CREATIVE.teacherNotes)}</div>`);
  const normalized = normalizeRegularLessonSections(sections);
  const count = normalized.reduce((sum, section) => sum + regularAnswerMap(section).size, 0);
  if (count !== 61) throw new Error(`More daily routines must have 61 private automatic keys; found ${count}`);
  const homework = normalizeInteractiveHomework(DAILY_ROUTINES_HOMEWORK);
  if (!homework || homework.exercises.length !== 7 || homework.exercises.reduce((sum, exercise) => sum + exercise.items.length, 0) !== 22) {
    throw new Error("More daily routines homework must remain seven short blocks and twenty-two items");
  }
  return {
    title: MORE_DAILY_ROUTINES_LESSON_TITLE,
    description: "19 daily-routine phrases · used to / be used to / get used to · definition guessing, personal questions & grammar practice · one reading and two dialogues with 8 True/False + 8 questions each · creative task & light homework.",
    sections: normalized, words: DAILY_ROUTINES_WORDS,
    homework: [JSON.parse(JSON.stringify(homework)) as InteractiveHomeworkPlan],
  };
}
