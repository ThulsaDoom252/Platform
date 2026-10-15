import { buildPopularQuestionsHomework } from "./a2-popular-questions-homework";
import type { LessonWord } from "../lesson-unit";
import {
  addRegularLessonFocusIds,
  normalizeRegularLessonSections,
  regularAnswerMap,
  type RegularLessonSection,
  type RegularLessonTone,
} from "../regular-lesson";
import { cleanScriptHtml } from "../script-html";

export const POPULAR_QUESTIONS_LESSON_TITLE = "A2 · Popular questions";
type WordContent = Omit<LessonWord, "id">;
type HtmlElement = { start: number; html: string; inner: string };
const plain = (html: string) => html.replace(/<br\s*\/?\s*>/gi, " ").replace(/<[^>]*>/g, "")
  .replace(/&amp;/gi, "&").replace(/&nbsp;/gi, " ").replace(/&#39;|&apos;/gi, "'")
  .replace(/&quot;/gi, '"').replace(/\s+/g, " ").trim();
const escape = (value: string) => value.replaceAll("&", "&amp;").replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;").replaceAll('"', "&quot;");

/** Read balanced source elements without executing HTML or loading its assets. */
function elements(html: string, tag: string, className: string): HtmlElement[] {
  const result: HtmlElement[] = [];
  const starts = new RegExp(`<${tag}\\b[^>]*class=["'][^"']*\\b${className}\\b[^"']*["'][^>]*>`, "gi");
  for (const match of html.matchAll(starts)) {
    const tokens = new RegExp(`<\\/?${tag}\\b[^>]*>`, "gi");
    tokens.lastIndex = match.index! + match[0].length;
    let depth = 1, end = tokens.lastIndex, closingStart = end;
    for (let token = tokens.exec(html); token; token = tokens.exec(html)) {
      depth += token[0].startsWith("</") ? -1 : 1;
      if (depth === 0) { closingStart = token.index; end = tokens.lastIndex; break; }
    }
    if (depth !== 0) throw new Error(`Unclosed Popular questions ${className} element`);
    result.push({ start: match.index!, html: html.slice(match.index!, end), inner: html.slice(match.index! + match[0].length, closingStart) });
  }
  return result;
}

function replaceElements(html: string, tag: string, className: string, replace: (element: HtmlElement) => string) {
  for (const element of elements(html, tag, className).reverse()) {
    html = html.slice(0, element.start) + replace(element) + html.slice(element.start + element.html.length);
  }
  return html;
}

const questionWords = [
  "Where are you from?", "How old are you?", "What languages do you speak?", "Do you have a job?",
  "What job would you like to have?", "What is your phone number?", "Where do you live?",
  "What is your favourite food?", "What are your hobbies?",
];
const fromQuestionNote = "📌 Зазвичай from — у кінці питання: Where are you from? From where are you? — граматично правильно, але формально й нетипово для повсякденного знайомства.";

/** Only source-provided question cards: no invented definitions or pronunciation. */
export function popularQuestionsVocabulary(html: string): WordContent[] {
  const cards = elements(html, "div", "vcard");
  const words = cards.map(card => {
    const heading = elements(card.inner, "div", "vhead")[0]?.inner ?? "";
    const word = plain(heading.match(/<b\b[^>]*>([\s\S]*?)<\/b>/i)?.[1] ?? "");
    const translation = plain(elements(heading, "span", "ua")[0]?.inner ?? "");
    const sourceNote = plain(elements(card.inner, "div", "note")[0]?.inner ?? "");
    const note = word === "Where are you from?" ? fromQuestionNote : sourceNote;
    const examples = [...card.inner.matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/gi)].map(match => ({ en: plain(match[1]), tr: "" }));
    if (!word || !translation || !sourceNote || examples.length !== 2) throw new Error(`Incomplete Popular questions vocabulary: ${word}`);
    return {
      word, category: "Popular questions", icon: plain(elements(heading, "span", "em")[0]?.inner ?? ""),
      translation, translationLang: "UK" as const, description: null, note, examples,
      ipaUk: null, ipaUs: null, sectionColor: "#2f6fdb", imageUrl: null,
    };
  });
  if (words.length !== questionWords.length || words.some((word, index) => word.word !== questionWords[index])) {
    throw new Error("Popular questions requires all nine original question cards in source order");
  }
  return words;
}

function tone(className: string): RegularLessonTone {
  if (/\bwarm\b/.test(className)) return "warm";
  if (/\bvocab\b/.test(className)) return "vocab";
  if (/\bgram\b/.test(className)) return "grammar";
  if (/\bread\b/.test(className)) return "reading";
  if (/\bdlg\b/.test(className)) return "dialogue";
  if (/\bteacher-note\b/.test(className)) return "teacher";
  return "exercise";
}

function sourceSections(source: string) {
  return [...source.matchAll(/<section\b[^>]*class=["']([^"']*)["'][^>]*>([\s\S]*?)<\/section>/gi)].map(match => {
    const heading = match[2].match(/<h2\b[^>]*>([\s\S]*?)<\/h2>/i);
    if (!heading && tone(match[1]) !== "teacher") throw new Error("Missing Popular questions section heading");
    return { title: heading ? plain(heading[1]) : "Teacher notes", tone: tone(match[1]), html: heading ? match[2].replace(heading[0], "") : match[2] };
  });
}

const lists = (html: string) => [...html.matchAll(/<ol\b([^>]*)>([\s\S]*?)<\/ol>/gi)];
const listItems = (html: string) => [...html.matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/gi)].map(match => match[1]);
const promptText = (html: string) => plain(["ans", "blank", "tfbox"].reduce(
  (body, className) => replaceElements(body, "span", className, () => ""),
  replaceElements(html, "div", "key", () => ""),
));

function answerVariants(raw: string, sectionIndex: number, listIndex: number, itemIndex: number) {
  const answer = plain(raw);
  const variants = answer.split(/\s+\/\s+/);
  // The source's optional wording and contraction equivalents must be usable in a native checker.
  if (sectionIndex === 6 && listIndex === 1 && itemIndex === 1) variants.splice(0, variants.length, "I'm twenty-nine.", "I'm twenty-nine years old.");
  if (sectionIndex === 6 && listIndex === 1 && itemIndex === 3) variants.push("You should study English every day.");
  for (const variant of [...variants]) {
    const expanded = variant.replace(/\bI'm\b/gi, "I am").replace(/\bI'd\b/gi, "I would")
      .replace(/\bI'll\b/gi, "I will").replace(/\bdon't\b/gi, "do not")
      .replace(/\bshouldn't\b/gi, "should not").replace(/\bcan't\b/gi, "cannot")
      .replace(/^'d better/i, "had better");
    variants.push(expanded);
    variants.push(expanded.replace(/\bI am\b/g, "I'm").replace(/\bI would\b/g, "I'd")
      .replace(/\bI will\b/g, "I'll").replace(/\bdo not\b/gi, "don't")
      .replace(/\bshould not\b/gi, "shouldn't").replace(/\bcannot\b/gi, "can't")
      .replace(/^had better\b/i, "'d better"));
    if (/^What is\b/.test(variant)) variants.push(variant.replace(/^What is\b/, "What's"));
    if (/\bfavourite\b/.test(variant)) {
      variants.push(variant.replace(/\bfavourite\b/g, "favorite"));
      if (/^What is\b/.test(variant)) variants.push(variant.replace(/^What is\b/, "What's").replace(/\bfavourite\b/g, "favorite"));
    }
  }
  return [...new Set(variants)];
}

/** Preserve source prose and private explanations; add only native exercise markers. */
function convertedBody(source: string, student: string, sectionIndex: number, teacher: boolean) {
  const studentLists = lists(student);
  // Key lists are not exercises. They remain byte-for-byte source content inside the private block.
  const keys = elements(source, "div", "key");
  let html = source;
  for (const [index, key] of [...keys.entries()].reverse()) {
    html = html.slice(0, key.start) + `<div class="key">POPULAR_QUESTIONS_KEY_${index}</div>` + html.slice(key.start + key.html.length);
  }
  let listIndex = 0;
  html = html.replace(/<ol\b[^>]*>([\s\S]*?)<\/ol>/gi, (_list, body: string) => {
    const index = listIndex++, sourceList = studentLists[index];
    if (!sourceList) throw new Error(`Unexpected Popular questions teacher list ${sectionIndex + 1}/${index + 1}`);
    const studentItems = listItems(sourceList[2]), sourceItems = listItems(body);
    if (studentItems.length !== sourceItems.length) throw new Error(`Popular questions list length mismatch ${sectionIndex + 1}/${index + 1}`);
    const fill = /class=["'][^"']*\bblank\b/.test(sourceList[2]);
    const tf = /class=["'][^"']*\btfbox\b/.test(sourceList[2]);
    const translation = sectionIndex === 6 && index === 1;
    let itemIndex = 0;
    const items = body.replace(/<li\b[^>]*>([\s\S]*?)<\/li>/gi, (_item, content: string) => {
      const current = itemIndex++;
      if (!teacher || !fill && !tf) return `<li>${content}</li>`;
      const answers = elements(content, "span", "ans");
      if (answers.length !== 1) throw new Error(`Missing Popular questions answer ${sectionIndex + 1}/${index + 1}/${current + 1}`);
      let item = replaceElements(content, "span", "ans", element => `<span class="ans">${escape(answerVariants(element.inner, sectionIndex, index, current).join(" / "))}</span>`);
      if (tf) item = replaceElements(item, "span", "tfbox", () => "");
      return `<li>${item}</li>`;
    });
    return `<ol${translation ? ' class="sentence-check translation-check"' : fill ? ' class="sentence-check"' : tf ? ' class="tf"' : ""}>${items}</ol>`;
  });
  for (const [index, key] of keys.entries()) html = html.replace(`<div class="key">POPULAR_QUESTIONS_KEY_${index}</div>`, key.html);
  if (listIndex !== studentLists.length) throw new Error(`Missing Popular questions exercise list ${sectionIndex + 1}`);
  return html;
}

const safe = (html: string) => cleanScriptHtml(addRegularLessonFocusIds(html));
const sectionId = (index: number) => `popular-questions-${String(index + 1).padStart(2, "0")}`;
const expectedListSizes = [[5, 5, 8], [], [9], [10], [10], [10], [10, 6], [10, 10], [8, 8], [10, 10]];
const expectedTones: RegularLessonTone[] = ["warm", "vocab", "exercise", "exercise", "exercise", "grammar", "grammar", "reading", "dialogue", "dialogue"];

export function buildA2PopularQuestionsLesson(studentSource: string, teacherSource: string) {
  const student = sourceSections(studentSource), teacher = sourceSections(teacherSource);
  if (student.length !== 10 || teacher.length !== 11 || teacher.at(-1)?.tone !== "teacher") {
    throw new Error("Popular questions requires ten student sections and separate private teacher notes");
  }
  const sections: RegularLessonSection[] = [];
  for (const [index, source] of student.entries()) {
    const answer = teacher[index];
    if (source.title !== answer.title || source.tone !== expectedTones[index] || answer.tone !== source.tone) {
      throw new Error(`Popular questions section mismatch at ${index + 1}`);
    }
    if (/class=["'][^"']*\b(?:ans|key|key-wrap|teacher-note)\b/i.test(source.html)) throw new Error("Private teacher answers found in Popular questions student source");
    if (promptText(source.html) !== promptText(answer.html)) throw new Error(`Popular questions student/teacher prompt mismatch at ${index + 1}`);
    const sizes = source.tone === "vocab" ? [] : lists(source.html).map(list => listItems(list[2]).length);
    if (sizes.join() !== expectedListSizes[index].join()) throw new Error(`Incomplete Popular questions exercise groups at ${index + 1}`);
    // Teacher keys are private; main list structure and readable prompts must match the student file.
    // "In the kitchen" is not contradicted by "on the table". Keep the source fixture
    // unchanged, but make the native false statement unambiguous for auto-checking.
    const correctedNotes = (html: string) => replaceElements(html, "div", "note", note =>
      note.inner.includes("✗ From where are you?") ? `<div class="note">${escape(fromQuestionNote)}</div>` : note.html);
    const studentSourceBody = index === 9 ? source.html.replace("The cake is in the kitchen.", "The cake is not on the table.") : index === 1 ? correctedNotes(source.html) : source.html;
    const teacherSourceBody = index === 9 ? answer.html.replace("The cake is in the kitchen.", "The cake is not on the table.")
      .replace("<li><b>F</b> — on the table — репліка 23</li>", "<li><b>F</b> — the cake is on the table — репліка 23</li>") : index === 1 ? correctedNotes(answer.html) : answer.html;
    const studentBody = convertedBody(studentSourceBody, studentSourceBody, index, false);
    const teacherBody = convertedBody(teacherSourceBody, studentSourceBody, index, true);
    const current: RegularLessonSection = { id: sectionId(index), title: source.title, tone: source.tone,
      studentHtml: safe(studentBody), teacherHtml: safe(teacherBody), defaultOpen: source.tone === "vocab" };
    const controls = (current.studentHtml.match(/class="(?:blank|tfbox)"/g) ?? []).length;
    if (regularAnswerMap(current).size !== controls) throw new Error(`Unbound Popular questions answers in ${source.title}`);
    sections.push(current);
    if (source.tone === "vocab") {
      const support = elements(source.html, "div", "support"), tips = elements(source.html, "div", "tip");
      if (support.length !== 1 || tips.length !== 1) throw new Error("Popular questions helper bank or question guidance missing");
      const hero = studentSource.match(/<header\b[^>]*class=["']hero["'][^>]*>([\s\S]*?)<\/header>/i)?.[1] ?? "";
      const guidance = safe(`${hero}${support[0].html}${tips[0].html}`);
      sections.push({ id: "popular-questions-vocabulary-guide", title: "Vocabulary · Helpers & question tips", tone: "warm", studentHtml: guidance, teacherHtml: guidance, defaultOpen: false });
    }
  }
  const notes = teacher.at(-1)!;
  sections.push({ id: "popular-questions-teacher-notes", title: notes.title, tone: "teacher", studentHtml: "", teacherHtml: safe(notes.html), defaultOpen: false, teacherOnly: true });
  const words = popularQuestionsVocabulary(student[1].html);
  const teacherWords = popularQuestionsVocabulary(teacher[1].html);
  if (JSON.stringify(words) !== JSON.stringify(teacherWords)) throw new Error("Popular questions vocabulary versions do not match");
  const normalized = normalizeRegularLessonSections(sections);
  if (normalized.reduce((total, section) => total + regularAnswerMap(section).size, 0) !== 81) throw new Error("Popular questions requires all 81 keyed controls");
  return {
    title: POPULAR_QUESTIONS_LESSON_TITLE,
    description: "Getting to Know People · 9 popular questions & helper words · can / should / had better · conditionals 0 / 1 / 2 · translation · a complete reading & two dialogues.",
    sections: normalized, words,
    homework: [buildPopularQuestionsHomework()],
  };
}

export const popularQuestionsLessonFromHtml = buildA2PopularQuestionsLesson;
