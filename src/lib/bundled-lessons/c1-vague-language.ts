import type { InteractiveHomeworkPlan } from "../lesson-homework";
import { normalizeInteractiveHomework } from "../lesson-homework";
import { feelingsVocabulary } from "./c1-feelings-and-emotions";
import {
  VAGUE_LANGUAGE_DIALOGUES,
  VAGUE_LANGUAGE_NEW_WORDS,
  VAGUE_LANGUAGE_READINGS,
} from "./c1-vague-language-content";
import {
  VAGUE_LANGUAGE_GRAMMAR_PRACTICE,
  VAGUE_LANGUAGE_HOMEWORK,
  VAGUE_LANGUAGE_LEXICAL_PRACTICE,
  VAGUE_LANGUAGE_SPEAKING,
} from "./c1-vague-language-activities";
import {
  addRegularLessonFocusIds,
  normalizeRegularLessonSections,
  regularAnswerMap,
  type RegularLessonSection,
  type RegularLessonTone,
} from "../regular-lesson";
import { cleanScriptHtml } from "../script-html";

export const VAGUE_LANGUAGE_LESSON_TITLE = "C1 · Vague language";
export const VAGUE_LANGUAGE_REFERENCE_LINKS = [
  { title: "Cambridge — Vague expressions", url: "https://dictionary.cambridge.org/grammar/british-grammar/vague-expressions" },
  { title: "Cambridge — Approximations", url: "https://dictionary.cambridge.org/grammar/british-grammar/approximations-around-four-o-clock" },
  { title: "British Council — Past perfect", url: "https://learnenglish.britishcouncil.org/free-resources/grammar/b1-b2/past-perfect" },
  { title: "British Council — Future perfect", url: "https://learnenglish.britishcouncil.org/free-resources/grammar/b1-b2/future-continuous-future-perfect" },
];

const escape = (value: string) => value.replaceAll("&", "&amp;").replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;").replaceAll('"', "&quot;");
const safe = (html: string) => cleanScriptHtml(addRegularLessonFocusIds(html));

// Highlight only escaped text, never execute source HTML or replace inside tags.
const targetPhrases = /(?<![\p{L}\p{N}])(?:on the order of|in the region of|a ballpark figure|somewhere around|or thereabouts|thereabouts|give or take|in excess of|no less than|no more than|to some extent|to an extent|broadly speaking|in the low (?:\d+s|[a-z]+)|kind of|sort of|roughly|just over|at least|at most|or so|(?:\d+|[a-z]+)-(?:odd|something)|freak(?:s|ed|ing)? out|taken aback|on edge|(?:lose|loses|losing|lost) (?:my|your|his|her|our|their|one['’]s) temper|clam(?:s|med|ming)? up|(?:feel|feels|feeling|felt)(?: absolutely)? gutted|cring(?:e[ds]?|ing)|flustered|mortified|(?:go|goes|going|went|gone)(?: bright)? red|burst(?:s|ing)? out laughing|crack(?:s|ed|ing)?(?: (?:me|you|him|her|us|them))? up|laugh(?:s|ed|ing)? (?:my|your|his|her|our|their) heads? off|thrilled to bits|moved|overwhelmed)(?![\p{L}\p{N}])/giu;

export function highlightVagueLanguageText(text: string) {
  let result = "", last = 0;
  for (const match of text.matchAll(targetPhrases)) {
    result += escape(text.slice(last, match.index)) + `<strong>${escape(match[0])}</strong>`;
    last = match.index + match[0].length;
  }
  return result + escape(text.slice(last));
}

type PracticeItem = {
  prompt: string;
  answer: string;
  accepted?: string[];
  choices?: string[];
  explanation: string;
};
type PracticeGroup = { id: string; title: string; instruction: string; items: PracticeItem[] };
type Comprehension = {
  questions: { prompt: string; suggestedAnswer: string }[];
  trueFalse: { prompt: string; answer: boolean; explanation: string }[];
};

function practiceHtml(groups: readonly PracticeGroup[], teacher: boolean) {
  return groups.map(group => `<h3>${escape(group.title)}</h3><p class="instr">${escape(group.instruction)}</p>
    <ol class="sentence-check">${group.items.map(item => {
      if ((item.prompt.match(/___/g) ?? []).length !== 1 || !item.answer || !item.explanation) {
        throw new Error(`Incomplete Vague language practice item: ${group.id}`);
      }
      const variants = [...new Set([item.answer, ...(item.accepted ?? [])])];
      const control = teacher ? `<span class="ans">${escape(variants.join(" / "))}</span>` : '<span class="blank"></span>';
      const parts = item.prompt.split("___");
      return `<li>${highlightVagueLanguageText(parts[0])}${control}${highlightVagueLanguageText(parts[1])}
        ${item.choices?.length ? `<p class="note">Options: ${item.choices.map(escape).join(" · ")}</p>` : ""}
        ${teacher ? `<div class="key">${escape(item.explanation)}</div>` : ""}</li>`;
    }).join("")}</ol>`).join("");
}

function comprehensionHtml(content: Comprehension, teacher: boolean) {
  return `<h3>Questions · Discuss the meaning</h3><p class="instr">Answer in your own words. Refer to the text, and explain what the estimates do and do not promise.</p>
    <ol>${content.questions.map(item => `<li>${escape(item.prompt)}${teacher ? `<div class="key">Suggested answer: ${escape(item.suggestedAnswer)}</div>` : ""}</li>`).join("")}</ol>
    <h3>True or false? Find the evidence</h3><p class="instr">Choose True or False. Correct false statements orally.</p>
    <ol class="tf">${content.trueFalse.map(item => `<li>${escape(item.prompt)} ${teacher ? `<span class="ans">${item.answer ? "True / T" : "False / F"}</span><div class="key">${escape(item.explanation)}</div>` : '<span class="tfbox"></span>'}</li>`).join("")}</ol>`;
}

const warmup = `<h3>Warm-up questions</h3><p class="instr">You do not need exact figures. Give a useful estimate, then say how confident you are.</p>
  <ol><li>Roughly how many messages had you received before you started work yesterday?</li>
  <li>When did you last feel on edge because somebody gave you an unclear deadline?</li>
  <li>By this time next month, what will you have finished? Give an approximate amount or date.</li>
  <li>Think back to Oliver's difficult investor pitch in Feelings and emotions. What had gone wrong before he started speaking?</li>
  <li>When is an estimate helpful, and when would you insist on an exact number?</li></ol>`;

const vagueGuide = `<p>Vague language can make an estimate honest, soften a claim or summarise a complex situation. It is not a licence to conceal important facts. Use an exact figure for a confirmed payment, safety limit or contractual deadline.</p>
  <h3>Put the expression in the right place</h3>
  <table><thead><tr><th>Pattern</th><th>Original example</th><th>Meaning / register</th></tr></thead><tbody>
  <tr><td>roughly / somewhere around + number</td><td>We had invited roughly sixty people.</td><td>An estimate, not an exact total.</td></tr>
  <tr><td>in the region of / on the order of + number</td><td>The repairs will cost in the region of €800.</td><td>More formal estimates; on the order of is especially common in US English.</td></tr>
  <tr><td>a ballpark figure for something</td><td>Could you give me a ballpark figure for the cost?</td><td>The phrase is a noun, not a substitute for about before a bare number.</td></tr>
  <tr><td>number (+ noun) + or so / or thereabouts</td><td>We had waited twenty minutes or so. Fifty or so people came. The meeting ended at six or thereabouts.</td><td>Approximation after the number, quantity or clock time. Thereabouts can also stand alone after an estimate.</td></tr>
  <tr><td>estimate, give or take + margin</td><td>It will take an hour, give or take ten minutes.</td><td>A stated allowance on either side of the estimate.</td></tr>
  <tr><td>round number + -odd</td><td>We had sold forty-odd tickets.</td><td>Informal: a little more than forty, not an exact number. Not for a clock time such as six o'clock.</td></tr>
  <tr><td>decade number + -something</td><td>She is thirty-something.</td><td>Somewhere in her thirties. Twenty-something covers ages from twenty to twenty-nine; it does not mean exactly twenty.</td></tr>
  <tr><td>in the low + decade / range</td><td>Temperatures will be in the low 30s.</td><td>The lower part of that range, not a precise upper limit.</td></tr></tbody></table>
  <h3>An approximation is not a minimum or maximum</h3>
  <table><thead><tr><th>Expression</th><th>Commitment</th><th>Example</th></tr></thead><tbody>
  <tr><td>at least / no less than</td><td>A lower limit: the stated amount or more. No less than can emphasise a surprisingly high amount.</td><td>At least fifty people had registered: fifty is possible; forty-nine is not.</td></tr>
  <tr><td>at most / no more than</td><td>An upper limit: the stated amount or less.</td><td>At most fifty people can enter: fifty is possible; fifty-one is not.</td></tr>
  <tr><td>in excess of</td><td>Strictly more than, often formal.</td><td>In excess of fifty excludes exactly fifty.</td></tr>
  <tr><td>just over</td><td>Slightly more than.</td><td>Just over fifty is above fifty, but not far above it.</td></tr></tbody></table>
  <h3>Soften the claim, not the number</h3>
  <p><strong>Broadly speaking</strong> introduces a generalisation; <strong>to some extent / to an extent</strong> limits how far something is true. <strong>Kind of / sort of</strong> are informal softeners: “I felt sort of overwhelmed.” In a formal report, prefer a more precise description.</p>
  <p class="note">Quick contrast: “We will have finished roughly half” is an estimate. “We will have finished at least half” promises a minimum. An estimate should not silently turn into a guarantee.</p>`;

const perfectGuide = `<h3>One viewpoint, two different time frames</h3>
  <table><thead><tr><th></th><th>Past Perfect</th><th>Future Perfect</th></tr></thead><tbody>
  <tr><th>Form</th><td>had + past participle</td><td>will have + past participle</td></tr>
  <tr><th>Negative</th><td>had not / hadn't + participle</td><td>will not have / won't have + participle</td></tr>
  <tr><th>Question</th><td>Had they checked the figures?</td><td>Will they have checked them by Friday?</td></tr>
  <tr><th>Viewpoint</th><td>Look back from a past point to something earlier or already true by then.</td><td>Look back from a future point to a result expected by then.</td></tr>
  <tr><th>In context</th><td>By the time Oliver entered the room, Ben had corrected roughly half the slides.</td><td>By the time Margaret arrives tomorrow, Ben will have corrected the remaining slides.</td></tr></tbody></table>
  <p class="note">Past: correction → past meeting → now. Future: now → expected correction → tomorrow's meeting. The perfect connects a result to the relevant viewpoint; the age of an event alone does not require it.</p>
  <h3>Time clauses and completed results</h3>
  <p>Use the Present Simple in an ordinary future time clause: “By the time the guests <strong>arrive</strong>, we <strong>will have prepared</strong> roughly forty meals.” Not “by the time they will arrive”. In the past: “By the time they <strong>arrived</strong>, we <strong>had prepared</strong> the meals.”</p>
  <p>Use <strong>by</strong> for a completion deadline: “We will have finished by six.” <strong>Until</strong> describes continuation: “We will keep checking until six.” Future Perfect is useful for projected completed totals: “By Friday, we will have interviewed thirty-odd people.” It does not mean the work is happening at that exact moment.</p>
  <h3>Avoid mechanical tense rules</h3>
  <p>A chronological list usually works in the Past Simple: “She arrived, opened her laptop and smiled.” Words such as before and after can already make the order clear; they do not automatically force the Past Perfect. Here, use the perfect when the task explicitly asks you to look back from a past or future reference point.</p>
  <p>Past Simple versus Past Perfect can change the sequence: “When I arrived, she left” versus “When I arrived, she had left.” Discuss who was still present. A completed result and a continuing activity are different: “will have checked ten files” is not “will be checking files”.</p>
  <p class="note">Participle reminders for this lesson: go → gone; take → taken; write → written; see → seen; speak → spoken; lose → lost; leave → left; feel → felt; burst → burst. Had / will have do not change with the subject.</p>`;

const feelingsBridge = `<p>This is a sequel to Feelings and emotions, not a replacement for that lesson. The sixteen expressions are in the dictionary's Review categories. Reuse them to describe the human reaction behind an uncertain figure or deadline.</p>
  <h3>Short grammar bridge from lesson one</h3>
  <table><thead><tr><th>Previous pattern</th><th>New context</th><th>Meaning</th></tr></thead><tbody>
  <tr><td>Present state / temporary behaviour</td><td>I think the estimate is fair. You're being unusually cautious today.</td><td>Think is an opinion; being describes current behaviour, not a permanent character.</td></tr>
  <tr><td>Continuous for irritation</td><td>You're always changing the ballpark figure!</td><td>Repeated behaviour with the speaker's emotional attitude.</td></tr>
  <tr><td>Tentative hope / enquiry</td><td>We're hoping to agree a realistic deadline. I'm wondering if you could give us a range.</td><td>A softer proposal, not a completed result.</td></tr>
  <tr><td>want + object + to-infinitive / -ing</td><td>I don't want you to panic. I don't want you losing your temper over an estimate.</td><td>The first is a neutral request; the second focuses on the unwanted activity. Do not use a bare infinitive after want + object.</td></tr>
  <tr><td>see + object + bare infinitive / -ing</td><td>I saw Jack go red. I saw Jack checking the figures.</td><td>The whole event versus an action observed in progress.</td></tr></tbody></table>
  <p>Retell a moment from Oliver's pitch, Emma and Jack's bug discussion, the founders' stress report or the wedding speech. What <strong>had happened</strong> before someone became flustered? What <strong>will have changed</strong> before the next meeting or celebration?</p>`;

const teacherRoute = `<h3>Teacher route and flexible timing</h3>
  <p>Original C1 lesson pack: approximately 90–120 minutes if every discussion is used. For a shorter class, choose one reading and one dialogue; keep the remaining material for the next meeting, not as compulsory extra homework. The core is meaning and placement, perfect-time viewpoints, and an estimate the student can justify.</p>
  <ul><li>Activate Feelings: ask for a short retelling, not a memorised list.</li><li>Teach twenty new expression cards in groups; sixteen emotion cards are review, not sixteen extra new targets.</li><li>Check that students distinguish approximation, inclusive limits and strictly more than.</li><li>Show answers only after a first attempt. Accept a reasonable synonym in discussion, but automatic tasks use the stated choices or requested form.</li><li>Ask for evidence and a correction in True/False tasks. Suggested discussion answers are models, not exact strings to memorise.</li><li>The homework is deliberately short: sixteen automatic responses and one brief production. Do not append all classroom lists.</li></ul>
  <h3>Source continuity and references</h3><p>New original texts and tasks draw on the user's cropped vocabulary screenshots and revisit situations from C1 Feelings and emotions. Missing screenshot question stems have not been reconstructed or presented as originals. Past Perfect and Future Perfect are the main new grammar; advanced present forms and object constructions are recycled from lesson one.</p>
  <p>Grammar and usage references; examples, stories and exercises in this pack are independently written:</p>
  <ul>${VAGUE_LANGUAGE_REFERENCE_LINKS.map(link => `<li><a href="${escape(link.url)}" target="_blank" rel="noopener noreferrer">${escape(link.title)}</a></li>`).join("")}</ul>`;

/** Pure native lesson definition; the existing Feelings reference is never changed. */
export function buildC1VagueLanguageLesson(feelingsStudentSource: string) {
  const reviewWords = feelingsVocabulary(feelingsStudentSource).map(word => ({ ...word, category: `Review · Feelings · ${word.category}` }));
  const words = [...VAGUE_LANGUAGE_NEW_WORDS, ...reviewWords];
  if (VAGUE_LANGUAGE_NEW_WORDS.length !== 20 || reviewWords.length !== 16 || new Set(words.map(word => word.word)).size !== 36) {
    throw new Error("Vague language requires twenty new expressions and all sixteen Feelings review words");
  }
  const sections: RegularLessonSection[] = [];
  const add = (id: string, title: string, tone: RegularLessonTone, studentHtml: string, teacherHtml = studentHtml, options: { teacherOnly?: boolean; defaultOpen?: boolean } = {}) => {
    sections.push({ id, title, tone, studentHtml: safe(studentHtml), teacherHtml: safe(teacherHtml), defaultOpen: options.defaultOpen === true, ...(options.teacherOnly ? { teacherOnly: true } : {}) });
  };
  add("vague-teacher", "Teacher route & references", "warm", "", teacherRoute, { teacherOnly: true });
  add("vague-warmup", "Warm-up · How precise do you need to be?", "warm", warmup);
  add("vague-vocabulary", "Vocabulary · Vague language & Feelings review", "vocab", "<p>Twenty new vague-language expressions and sixteen familiar emotion expressions. Read examples, compare the patterns, and say which belong in an informal conversation or a report.</p>", undefined, { defaultOpen: true });
  add("vague-usage", "Vague language · Position, limits & tone", "grammar", vagueGuide);
  add("vague-lexical-practice", "Language practice · Meaning and placement", "exercise", practiceHtml(VAGUE_LANGUAGE_LEXICAL_PRACTICE, false), practiceHtml(VAGUE_LANGUAGE_LEXICAL_PRACTICE, true));
  add("vague-perfect-grammar", "Grammar · Past Perfect & Future Perfect", "grammar", perfectGuide);
  add("vague-perfect-practice", "Grammar practice · Before then, by then", "exercise", practiceHtml(VAGUE_LANGUAGE_GRAMMAR_PRACTICE, false), practiceHtml(VAGUE_LANGUAGE_GRAMMAR_PRACTICE, true));
  add("vague-feelings-bridge", "Feelings · Grammar and story bridge", "grammar", feelingsBridge);
  for (let index = 0; index < 2; index++) {
    const reading = VAGUE_LANGUAGE_READINGS[index], dialogue = VAGUE_LANGUAGE_DIALOGUES[index];
    if (!reading || !dialogue) throw new Error("Both complete readings and dialogues are required");
    const readingBody = `<div class="reading">${reading.paragraphs.map(paragraph => `<p>${highlightVagueLanguageText(paragraph)}</p>`).join("")}</div>`;
    add(`vague-reading-${index + 1}`, `Text ${index + 1} · ${reading.title}`, "reading", readingBody + comprehensionHtml(reading, false), readingBody + comprehensionHtml(reading, true));
    const dialogueBody = `<div class="lines">${dialogue.turns.map(turn => `<p><b class="sp">${escape(turn.speaker)}</b> ${highlightVagueLanguageText(turn.text)}</p>`).join("")}</div>`;
    add(`vague-dialogue-${index + 1}`, `Dialogue ${index + 1} · ${dialogue.title}`, "dialogue", dialogueBody + comprehensionHtml(dialogue, false), dialogueBody + comprehensionHtml(dialogue, true));
  }
  add("vague-speaking", "Speaking · Estimate, explain, reassure", "exercise", `<h3>Speaking questions</h3><p class="instr">Choose two or three prompts. Use vague language deliberately, at least one perfect form, and an emotion expression. Your teacher responds to the meaning, not a single fixed answer.</p>
    <ol>${VAGUE_LANGUAGE_SPEAKING.map(prompt => `<li>${escape(prompt)}</li>`).join("")}</ol>
    <h3>Final role-play</h3><p>You are planning a second attempt after an event went wrong. Partner A asks for realistic numbers and deadlines; Partner B explains what had happened before the previous problem and what will have been completed by the next checkpoint. Swap roles. Clarify any estimate that sounds like a guarantee.</p>`);
  const normalized = normalizeRegularLessonSections(sections);
  for (const section of normalized) {
    const controls = (section.studentHtml.match(/class="(?:blank|tfbox)"/g) ?? []).length;
    if (regularAnswerMap(section).size !== controls) throw new Error(`Unbound Vague language answer in ${section.id}`);
  }
  const homework = normalizeInteractiveHomework(VAGUE_LANGUAGE_HOMEWORK);
  if (!homework || homework.exercises.reduce((sum, exercise) => sum + exercise.items.length, 0) !== 17) {
    throw new Error("Vague language homework must stay a light seventeen-item plan after native normalization");
  }
  return {
    title: VAGUE_LANGUAGE_LESSON_TITLE,
    description: "20 vague-language expressions + 16 Feelings review cards · Past Perfect & Future Perfect · advanced present/object-pattern recap · two original texts, two dialogues, discussion & light 15–20-minute homework.",
    sections: normalized, words,
    homework: [homework] as InteractiveHomeworkPlan[],
  };
}
