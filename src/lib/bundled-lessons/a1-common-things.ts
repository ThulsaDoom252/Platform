import type { InteractiveHomeworkPlan } from "../lesson-homework";
import type { LessonWord } from "../lesson-unit";
import {
  addRegularLessonFocusIds,
  normalizeRegularLessonSections,
  regularAnswerMap,
  type RegularLessonSection,
  type RegularLessonTone,
} from "../regular-lesson";
import { cleanScriptHtml } from "../script-html";

export const COMMON_THINGS_LESSON_TITLE = "A1 · Common things";
type WordContent = Omit<LessonWord, "id">;
type HtmlElement = { start: number; html: string; inner: string };
const plain = (html: string) => html.replace(/<br\s*\/?\s*>/gi, " ").replace(/<[^>]*>/g, "")
  .replace(/&amp;/gi, "&").replace(/&nbsp;/gi, " ").replace(/&#39;|&apos;/gi, "'")
  .replace(/&quot;/gi, '"').replace(/\s+/g, " ").trim();
const escape = (value: string) => value.replaceAll("&", "&amp;").replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;").replaceAll('"', "&quot;");

/** Balanced source elements; never execute source HTML or fetch its assets. */
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
    if (depth !== 0) throw new Error(`Unclosed Common things ${className} element`);
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

const sourceWords = ["book", "wallet", "backpack", "car", "TV", "umbrella", "computer", "house", "shoes", "mobile phone"];
const cardColors = ["#7c5cff", "#e64e98", "#1fb5d9"];

/** Preserve only the original ten cards, including both source pronunciation variants. */
export function commonThingsVocabulary(html: string): WordContent[] {
  const words = elements(html, "div", "vcard").map((card, index) => {
    const word = plain(elements(card.inner, "span", "vw")[0]?.inner ?? "");
    const pronunciation = elements(card.inner, "span", "ipa").map(ipa => plain(ipa.inner));
    const translation = plain(elements(card.inner, "div", "ua")[0]?.inner ?? "");
    const icon = plain(elements(card.inner, "div", "vicon")[0]?.inner ?? "");
    const note = plain(elements(card.inner, "div", "note")[0]?.inner ?? "");
    const examples = [...card.inner.matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/gi)].map(match => {
      const translated = match[1].match(/<span\b[^>]*>([\s\S]*?)<\/span>/i);
      if (!translated) throw new Error(`Missing Common things example translation: ${word}`);
      return { en: plain(match[1].replace(translated[0], "")), tr: plain(translated[1]).replace(/^—\s*/, "") };
    });
    const ipaUs = pronunciation.find(ipa => ipa.startsWith("US "))?.slice(3) ?? null;
    const ipaUk = pronunciation.find(ipa => ipa.startsWith("UK "))?.slice(3) ?? null;
    if (!word || !translation || !icon || !note || !ipaUs || examples.length !== 2 || examples.some(example => !example.en || !example.tr)) {
      throw new Error(`Incomplete Common things vocabulary: ${word}`);
    }
    return {
      word, category: "Common things", icon, translation, translationLang: "UK" as const,
      ipaUs, ipaUk, description: null, note, examples, sectionColor: cardColors[index % cardColors.length], imageUrl: null,
    };
  });
  if (words.length !== sourceWords.length || words.some((word, index) => word.word !== sourceWords[index])) {
    throw new Error("Common things requires all ten distinct original words in source order");
  }
  return words;
}

function sourceSections(source: string) {
  return [...source.matchAll(/<section\b[^>]*class=["']([^"']*)["'][^>]*>([\s\S]*?)<\/section>/gi)].map(match => {
    const heading = match[2].match(/<h2\b[^>]*>([\s\S]*?)<\/h2>/i);
    if (!heading) throw new Error("Missing Common things section heading");
    return { title: plain(heading[1]), teacherOnly: /\bteacher-section\b/.test(match[1]), html: match[2].replace(heading[0], "") };
  });
}

const lists = (html: string) => [...html.matchAll(/<ol\b[^>]*>([\s\S]*?)<\/ol>/gi)];
const listItems = (html: string) => [...html.matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/gi)].map(match => match[1]);
const withoutKeys = (html: string) => replaceElements(html, "div", "key", () => "");
const promptText = (html: string) => plain(["ans", "blank", "tfbox"].reduce(
  (body, className) => replaceElements(body, "span", className, () => ""), withoutKeys(html),
));

/** Expand valid equivalents, but never contract affirmative short answers (Yes, I'm). */
function contractionVariants(value: string) {
  const variants = new Set([value]);
  const rules: [RegExp, string][] = [
    [/\bdon't\b/gi, "do not"], [/\bdoesn't\b/gi, "does not"], [/\bhaven't\b/gi, "have not"], [/\bhasn't\b/gi, "has not"],
    [/\bisn't\b/gi, "is not"], [/\baren't\b/gi, "are not"],
    [/\bdo not\b/gi, "don't"], [/\bdoes not\b/gi, "doesn't"], [/\bhave not\b/gi, "haven't"], [/\bhas not\b/gi, "hasn't"],
    [/\bis not\b/gi, "isn't"], [/\bare not\b/gi, "aren't"],
    [/\bI'm\b/gi, "I am"], [/\b(I) am\b(?=\s+\p{L})/giu, "$1'm"],
    [/\b(you|we|they)'re\b/gi, "$1 are"], [/\b(you|we|they) are\b(?=\s+\p{L})/giu, "$1're"],
    [/\b(I|you|we|they)'ve\b/gi, "$1 have"], [/\b(I|you|we|they) have\b(?=\s+(?:not\s+)?got\b)/gi, "$1've"],
    [/\b(he|she|it|Ben|Emma)'s\b(?=\s+(?:not\s+)?got\b)/gi, "$1 has"], [/\b(he|she|it|Ben|Emma) has\b(?=\s+(?:not\s+)?got\b)/gi, "$1's"],
    [/\b(he|she|it|Ben|Emma)'s\b(?!\s+(?:not\s+)?got\b)/gi, "$1 is"], [/\b(he|she|it|Ben|Emma) is\b(?=\s+\p{L})/giu, "$1's"],
  ];
  for (const variant of variants) {
    for (const [pattern, replacement] of rules) {
      variants.add(variant.replace(pattern, replacement));
    }
    if (variants.size > 128) throw new Error("Too many Common things contraction equivalents");
  }
  return [...variants];
}

function answerVariants(raw: string, sectionIndex: number, listIndex: number) {
  const original = plain(raw);
  let variants = original.split(/\s+\/\s+/).map(value => value.replace(/\s*\(не have!\)\s*$/, "").trim());
  variants = variants.flatMap(value => {
    if (/\(got\)/.test(value)) return [value.replace(/\s*\(got\)/, ""), value.replace(/\(got\)/, "got")];
    const alternative = value.match(/\b(I|You|We|They|He|She|It) (?:have|has) got \(([^)]+)\)/i);
    if (alternative) return [value.replace(/\s*\([^)]+\)/, ""), value.replace(alternative[0], alternative[2])];
    return [value];
  });
  // Guess-the-word answers should accept the word as well as the source's a/an phrase.
  if (sectionIndex === 2 && listIndex === 0) variants.push(...variants.map(value => value.replace(/^an?\s+/i, "")));
  return [...new Set(variants.flatMap(contractionVariants))];
}

const formalHaveQuestionNote = "📌 Has she a computer? — граматично правильно, але формально й нетипово для повсякденної англійської. Звичайні форми для цього уроку: Has she got a computer? / Does she have a computer?";

function correctedBody(html: string, sectionIndex: number) {
  if (sectionIndex === 2) return html.replace("You live in a house.", "People can live in a house.")
    .replace("You need a computer for the internet.", "You can use a computer for the internet.");
  if (sectionIndex === 3) return replaceElements(html, "div", "trap", trap =>
    trap.inner.includes("Has she a computer?") ? `<div class="note">${escape(formalHaveQuestionNote)}</div>` : trap.html);
  return html;
}

/** One source row asks for both constructions and their matching short answers. */
function questionAnswerControls(studentItem: string, teacherItem: string, teacher: boolean) {
  const sourceAnswers = elements(teacherItem, "span", "ans");
  if (sourceAnswers.length !== 1) throw new Error("Missing Common things paired question answer");
  const pairs = plain(sourceAnswers[0].inner).split(/\s+\/\s+/).map(pair => pair.match(/^(.+?\?)\s*—\s*(.+)$/));
  if (pairs.length !== 2 || pairs.some(pair => !pair)) throw new Error("Incomplete Common things question/short-answer pair");
  const prompt = replaceElements(studentItem, "span", "blank", () => "");
  const control = (answer: string) => teacher ? `<span class="ans">${escape(contractionVariants(answer).join(" / "))}</span>` : '<span class="blank"></span>';
  return `${prompt}${pairs.map((pair, index) => `<p><b>${index === 0 ? "have" : "have got"} · question:</b> ${control(pair![1])} <b>Short answer:</b> ${control(pair![2])}</p>`).join("")}`;
}

/** Source prose and all private key blocks survive; native markers bind every control. */
function convertedBody(source: string, student: string, teacherSource: string, sectionIndex: number, teacher: boolean) {
  const studentLists = lists(student);
  const teacherLists = lists(withoutKeys(teacherSource));
  const keys = elements(source, "div", "key");
  let html = source;
  for (const [index, key] of [...keys.entries()].reverse()) {
    html = html.slice(0, key.start) + `<div class="key">COMMON_THINGS_KEY_${index}</div>` + html.slice(key.start + key.html.length);
  }
  let listIndex = 0;
  html = html.replace(/<ol\b[^>]*>([\s\S]*?)<\/ol>/gi, (_list, body: string) => {
    const index = listIndex++, sourceList = studentLists[index];
    if (!sourceList) throw new Error(`Unexpected Common things teacher list ${sectionIndex + 1}/${index + 1}`);
    const studentItems = listItems(sourceList[1]), sourceItems = listItems(body);
    if (studentItems.length !== sourceItems.length) throw new Error(`Common things list length mismatch ${sectionIndex + 1}/${index + 1}`);
    const fill = /class=["'][^"']*\bblank\b/.test(sourceList[1]);
    const tf = /class=["'][^"']*\btfbox\b/.test(sourceList[1]);
    let itemIndex = 0;
    const items = body.replace(/<li\b[^>]*>([\s\S]*?)<\/li>/gi, (_item, content: string) => {
      const current = itemIndex++;
      if (sectionIndex === 4 && index === 2) {
        const answer = listItems(teacherLists[index]?.[1] ?? "")[current];
        if (!answer) throw new Error(`Missing Common things paired question item ${current + 1}`);
        return `<li>${questionAnswerControls(studentItems[current], answer, teacher)}</li>`;
      }
      if (!teacher || !fill && !tf) return `<li>${content}</li>`;
      const controls = elements(studentItems[current], "span", tf ? "tfbox" : "blank");
      const answers = elements(content, "span", "ans");
      if (answers.length !== controls.length || !answers.length) throw new Error(`Missing Common things answer ${sectionIndex + 1}/${index + 1}/${current + 1}`);
      let item = replaceElements(content, "span", "ans", element => {
        const variants = answerVariants(element.inner, sectionIndex, index);
        if (!variants[0]) throw new Error("Empty Common things answer");
        const original = plain(element.inner);
        const sourceAnnotation = /\([^)]*\)/.test(original) ? `<span class="key">${escape(original)}</span>` : "";
        return `<span class="ans">${escape(variants.join(" / "))}</span>${sourceAnnotation}`;
      });
      if (tf) item = replaceElements(item, "span", "tfbox", () => "");
      return `<li>${item}</li>`;
    });
    return `<ol${sectionIndex === 4 && index === 3 ? ' class="sentence-check translation-check"' : fill ? ' class="sentence-check"' : tf ? ' class="tf"' : ""}>${items}</ol>`;
  });
  for (const [index, key] of keys.entries()) html = html.replace(`<div class="key">COMMON_THINGS_KEY_${index}</div>`, key.html);
  if (listIndex !== studentLists.length) throw new Error(`Missing Common things exercise list ${sectionIndex + 1}`);
  // Word speech is rendered by the native vocabulary component, never Cambridge links.
  return replaceElements(html, "a", "snd", () => "");
}

const safe = (html: string) => cleanScriptHtml(addRegularLessonFocusIds(html));
const sectionId = (index: number) => `common-things-${String(index + 1).padStart(2, "0")}`;
const expectedListSizes = [[8, 8], [], [10, 10, 10], [], [8, 8, 6, 8], [10], [10, 5], [8], [10, 10], [8, 8], [10, 10]];
const expectedTones: RegularLessonTone[] = ["warm", "vocab", "exercise", "grammar", "exercise", "grammar", "grammar", "grammar", "reading", "dialogue", "dialogue"];

export function buildA1CommonThingsLesson(studentSource: string, teacherSource: string) {
  const student = sourceSections(studentSource), teacher = sourceSections(teacherSource);
  if (student.length !== 11 || student.some(section => section.teacherOnly) || teacher.length !== 12 || !teacher.at(-1)?.teacherOnly || teacher.at(-1)?.title !== "🔑 Homework keys") {
    throw new Error("Common things requires eleven student sections and separate private Homework keys");
  }
  const sections: RegularLessonSection[] = [];
  for (const [index, source] of student.entries()) {
    const answer = teacher[index];
    if (source.title !== answer.title || answer.teacherOnly) throw new Error(`Common things section mismatch at ${index + 1}`);
    if (/class=["'][^"']*\b(?:ans|key|key-wrap|teacher-note|teacher-section)\b/i.test(source.html)) throw new Error("Private teacher answers found in Common things student source");
    if (promptText(source.html) !== promptText(answer.html)) throw new Error(`Common things student/teacher prompt mismatch at ${index + 1}`);
    const sizes = lists(source.html).map(list => listItems(list[1]).length);
    if (sizes.join() !== expectedListSizes[index].join()) throw new Error(`Incomplete Common things exercise groups at ${index + 1}`);
    const studentBody = correctedBody(source.html, index), teacherBody = correctedBody(answer.html, index);
    const current: RegularLessonSection = {
      id: sectionId(index), title: source.title, tone: expectedTones[index], defaultOpen: index === 1,
      studentHtml: safe(convertedBody(studentBody, studentBody, teacherBody, index, false)),
      teacherHtml: safe(convertedBody(teacherBody, studentBody, teacherBody, index, true)),
    };
    const controls = (current.studentHtml.match(/class="(?:blank|tfbox)"/g) ?? []).length;
    if (regularAnswerMap(current).size !== controls) throw new Error(`Unbound Common things answers in ${source.title}`);
    sections.push(current);
    if (index === 1) {
      const helpers = elements(source.html, "div", "helpers");
      if (helpers.length !== 1) throw new Error("Common things helper bank missing");
      const hero = studentSource.match(/<header\b[^>]*class=["']hero["'][^>]*>([\s\S]*?)<\/header>/i)?.[1] ?? "";
      if (!hero) throw new Error("Common things lesson introduction missing");
      const guidance = safe(`${hero}<h3>🧩 Слова-помічники</h3>${helpers[0].html}`);
      sections.push({ id: "common-things-vocabulary-guide", title: "Vocabulary · Helpers & lesson guide", tone: "warm", studentHtml: guidance, teacherHtml: guidance, defaultOpen: false });
    }
  }
  const notes = teacher.at(-1)!;
  sections.push({ id: "common-things-homework-keys", title: notes.title, tone: "teacher", studentHtml: "", teacherHtml: safe(notes.html), defaultOpen: false, teacherOnly: true });
  const words = commonThingsVocabulary(student[1].html);
  if (JSON.stringify(words) !== JSON.stringify(commonThingsVocabulary(teacher[1].html))) throw new Error("Common things vocabulary versions do not match");
  const normalized = normalizeRegularLessonSections(sections);
  // The six paired rows intentionally expand from one source blank to four fields.
  if (normalized.reduce((total, section) => total + regularAnswerMap(section).size, 0) !== 137) throw new Error("Common things requires all 137 native keyed controls");
  return {
    title: COMMON_THINGS_LESSON_TITLE,
    description: "10 common things & helper words · have / have got · short answers · I – me – my – mine · questions about people · a complete reading, two dialogues & role-play.",
    sections: normalized, words,
    // Only homework answers/rubric were provided, without complete student tasks.
    homework: [] as InteractiveHomeworkPlan[],
  };
}

export const commonThingsLessonFromHtml = buildA1CommonThingsLesson;
