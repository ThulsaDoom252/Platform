import type { HomeworkExercise, InteractiveHomeworkPlan } from "../lesson-homework";
import type { LessonWord } from "../lesson-unit";
import { addRegularLessonFocusIds, normalizeRegularLessonSections, type RegularLessonSection, type RegularLessonTone } from "../regular-lesson";
import { cleanScriptHtml } from "../script-html";
import { organizeVocabularyHomework } from "../vocabulary-homework";

export const FEELINGS_LESSON_TITLE = "C1 · Feelings and emotions";
type WordContent = Omit<LessonWord, "id">;
type HtmlElement = { start: number; html: string; inner: string };
const plain = (html: string) => html.replace(/<br\s*\/?\s*>/gi, " ").replace(/<[^>]*>/g, "")
  .replace(/&amp;/gi, "&").replace(/&nbsp;/gi, " ").replace(/&#39;|&apos;/gi, "'").replace(/&quot;/gi, '"').replace(/\s+/g, " ").trim();
const escape = (text: string) => text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");

/** Balanced elements, including nested divs; source scripts are never executed. */
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
    if (depth !== 0) throw new Error(`Unclosed ${className} element`);
    result.push({ start: match.index!, html: html.slice(match.index!, end), inner: html.slice(match.index! + match[0].length, closingStart) });
  }
  return result;
}

function replaceElements(html: string, tag: string, className: string, replace: (element: HtmlElement) => string) {
  for (const element of elements(html, tag, className).reverse()) html = html.slice(0, element.start) + replace(element) + html.slice(element.start + element.html.length);
  return html;
}
const field = (card: string, className: string) => plain(elements(card, "div", className)[0]?.inner ?? "");

// Keep the original English definitions, examples, UK IPA, emojis and categories.
// Ukrainian is the source translation language; student language overlays handle RU.
const wordDetails: Record<string, [string, string, string?, string?]> = {
  "freak out": ["панікувати; втрачати контроль", "Не панікуй, але сервер не працює вже годину."],
  "be taken aback": ["бути приголомшеним; розгубитися від несподіванки", "Я був приголомшений, коли клієнт попросив повернення коштів у перший же день."],
  "be on edge": ["бути напруженим; не знаходити собі місця", "Уся команда цього тижня на нервах — ми чекаємо на відповідь інвесторів.", "/bi ɑːn ˈedʒ/"],
  "lose one’s temper": ["втрачати самовладання; виходити із себе", "Він рідко виходить із себе, але третій баг поспіль вивів його з рівноваги.", "/luːz wʌnz ˈtem.pɚ/", "lose, not loose; use the person's possessive: lose my/your/his/her temper."],
  "clam up": ["замовкнути; замкнутися в собі", "Вона замовкає щоразу, коли хтось питає про її зарплату.", undefined, "clam up → clammed up; no be: She clammed up, not She was clammed up."],
  "feel gutted": ["бути страшенно розчарованим; почуватися спустошеним", "Я страшенно розчарований — ми програли контракт конкуренту.", "/fiːl ˈɡʌt̬.ɪd/", "absolutely gutted; informal British English."],
  "cringe": ["ніяковіти; відчувати сильний сором або незручність", "Я досі ніяковію, коли дивлюся відео своєї першої презентації.", undefined, "cringe is the verb; cringed is its past form. cringey/cringeworthy are adjectives. make somebody cringe."],
  "be flustered": ["бути розгубленим; хвилюватися й плутатися", "Він розгубився, коли камера раптово ввімкнулася.", "/bi ˈflʌs.tɚd/", "get flustered"],
  "be mortified": ["згорати від сорому; бути вкрай збентеженим", "Я згорав від сорому, коли зрозумів, що надіслав повідомлення не в той чат.", "/bi ˈmɔːr.t̬ə.faɪd/", "utterly mortified; stronger than embarrassed."],
  "go red": ["почервоніти", "Вона почервоніла, коли всі почали аплодувати.", "/ɡoʊ ˈred/", "go bright red; go → went → gone."],
  "burst out laughing": ["вибухнути сміхом; раптово розсміятися", "Коли демонстраційна версія злетіла, генеральний директор просто вибухнув сміхом.", "/bɝːst aʊt ˈlæf.ɪŋ/"],
  "crack up": ["розреготатися; розсмішити когось", "Його пародії на наших клієнтів завжди мене смішать.", undefined, "crack somebody up = make somebody laugh a lot."],
  "laugh one’s head off": ["реготати до нестями", "Ми реготали до нестями на корпоративі.", "/læf wʌnz ˈhed ɑːf/", "Use your own possessive: laugh my head off / laugh our heads off."],
  "be thrilled to bits": ["бути в захваті; бути безмежно щасливим", "Мама була в захваті, коли я розповів їй про фінансування."],
  "be moved": ["бути зворушеним", "Його промова мене дуже зворушила.", undefined, "deeply/really moved"],
  "be overwhelmed": ["бути переповненим емоціями; не справлятися з навантаженням", "Вона була вражена такою підтримкою. / Я не справляюся з обсягом роботи.", "/bi ˌoʊ.vɚˈwelmd/", "completely overwhelmed; overwhelmed by support / overwhelmed with work."],
};

export function feelingsVocabulary(html: string): WordContent[] {
  const groups = elements(html, "span", "vgroup-title");
  const words = elements(html, "div", "vcard").map(card => {
    const word = field(card.inner, "w"), details = wordDetails[word];
    if (!details) throw new Error(`Unknown feelings expression: ${word}`);
    const category = groups.filter(group => group.start < card.start).at(-1);
    if (!category) throw new Error(`Missing category: ${word}`);
    const ipa = field(card.inner, "tr");
    return {
      word, category: plain(category.inner), icon: field(card.inner, "emo"), ipaUk: ipa, ipaUs: details[2] ?? ipa,
      translation: details[0], translationLang: "UK" as const, description: field(card.inner, "def"),
      note: [field(card.inner, "pos"), details[3]].filter(Boolean).join(" · "),
      examples: [{ en: field(card.inner, "ex"), tr: details[1] }],
      sectionColor: card.html.match(/--c:\s*(#[a-f0-9]{6})/i)?.[1] ?? null, imageUrl: null,
    };
  });
  if (words.length !== 16 || new Set(words.map(word => word.word)).size !== 16) throw new Error("Feelings requires all sixteen distinct expressions");
  return words;
}

function sourceSections(html: string) {
  return [...html.matchAll(/<section\b[^>]*>([\s\S]*?)<\/section>/gi)].map(match => {
    const heading = match[1].match(/<h2\b[^>]*>([\s\S]*?)<\/h2>/i);
    if (!heading) throw new Error("Missing feelings heading");
    const number = Number(heading[1].match(/class=["']num["'][^>]*>(\d+)/)?.[1]);
    const title = plain(heading[1].replace(/<span\b[^>]*class=["'](?:num|score)["'][^>]*>[\s\S]*?<\/span>/gi, ""));
    return { number, title, html: match[1].replace(heading[0], "") };
  });
}
type SourceSection = ReturnType<typeof sourceSections>[number];
const keyHtml = (html: string) => elements(html, "div", "key")[0]?.inner ?? "";
const keyAnswer = (html: string) => plain(replaceElements(keyHtml(html), "span", "cite", () => "").replace(/<b\b[^>]*class=["']k["'][^>]*>[\s\S]*?<\/b>/i, ""));

const presentAnswers: string[][] = [
  ["are you being"], ["tastes"], ["is tasting"], ["cuts"], ["tells"],
  ["am regretting", "'m regretting", "regret"], ["don't deny", "do not deny", "am not denying", "'m not denying"],
  ["are hoping", "'re hoping", "hope"], ["are always interrupting", "'re always interrupting"],
  ["am thinking", "'m thinking"], ["think"], ["freaks out"], ["am loving", "'m loving", "love"],
  ["apologise", "apologize"], ["is having", "'s having"],
];
const correctionAnswers: string[][] = [
  ["I believe you now."], ["He is always forgetting his keys.", "He's always forgetting his keys."],
  ["I want you to call me back."], ["She clammed up during the interview."],
  ["I was very taken aback by his reaction.", "Correct"], ["Don't lose your temper!", "Do not lose your temper!"],
  ["I know what you mean."], ["I don't want you working late.", "I don't want you to work late.", "I do not want you working late.", "I do not want you to work late."],
  ["Prime minister resigns after scandal."], ["You're being very patient with them lately.", "You are being very patient with them lately.", "Correct"],
];
const bonusAnswers = [
  ["to show"], ["working", "to work"], ["finished"], ["checking"], ["go", "going"], ["crying"],
  ["asking"], ["to call"], ["freaking out", "to freak out"], ["losing"], ["to meet"], ["laughing"],
];
const translationAnswers = [
  ["You're always losing your temper over little things!", "You are always losing your temper over little things!", "You're constantly losing your temper over little things!", "You are constantly losing your temper over little things!"],
  ["I'm regretting agreeing to this project.", "I am regretting agreeing to this project.", "I'm starting to regret agreeing to this project.", "I am starting to regret agreeing to this project."],
  ["I hear you're thrilled to bits with your new flat.", "I hear you are thrilled to bits with your new flat.", "I hear you're thrilled to bits with your new apartment."],
  ["I don't want you freaking out about this deadline.", "I don't want you to freak out about this deadline.", "I do not want you freaking out about this deadline.", "I do not want you to freak out about this deadline."],
  ["You're really on edge today — has something happened?", "You are really on edge today — has something happened?"],
  ["So I walk into the room, and everyone bursts out laughing."],
  ["I was mortified when I realised the mic was on.", "I was mortified when I realized the mic was on.", "I was mortified when I realised the microphone was on."],
  ["I saw him go red when she thanked him.", "I saw him going red when she thanked him."],
  ["We're hoping you can send the contract by Friday.", "We are hoping you can send the contract by Friday."],
  ["She clams up whenever anyone asks about her past.", "She clams up whenever someone asks about her past."],
  ["I was really moved by his speech — I almost cried."], ["I want this bug fixed by the morning.", "I want this bug fixed by morning."],
];

function answers(number: number, index: number, teacherItem: string): string[] {
  if (number === 7) return presentAnswers[index] ?? [];
  if (number === 8) return correctionAnswers[index] ?? [];
  if (number === 9) return bonusAnswers[index] ?? [];
  if (number === 10) return translationAnswers[index] ?? [];
  if (number === 6) return [keyAnswer(teacherItem).match(/^([AB])\b/)?.[1] ?? ""];
  if (number === 4 || number >= 11) return [keyAnswer(teacherItem).match(/^(TRUE|FALSE)\b/i)?.[1]?.toLowerCase() === "true" ? "True" : "False"];
  const word = keyAnswer(teacherItem);
  return [word, word.replaceAll("’", "'"), `to ${word}`];
}

function convertedBody(source: SourceSection, teacher: SourceSection, showAnswers: boolean) {
  let html = source.html.replace(/<textarea\b[^>]*>[\s\S]*?<\/textarea>/gi, "").replace(/<input\b[^>]*>/gi, "");
  const teacherLists = [...teacher.html.matchAll(/<ol\b[^>]*>([\s\S]*?)<\/ol>/gi)];
  let listIndex = 0;
  html = html.replace(/<ol\b[^>]*>([\s\S]*?)<\/ol>/gi, (_list, body: string) => {
    const teacherItems = [...(teacherLists[listIndex++]?.[1] ?? "").matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/gi)].map(match => match[1]);
    let itemIndex = 0, autoList = false, tfList = false;
    const items = body.replace(/<li\b[^>]*>([\s\S]*?)<\/li>/gi, (_item, raw: string) => {
      const index = itemIndex++, teacherItem = teacherItems[index];
      if (!teacherItem) throw new Error(`Missing teacher item ${source.number}/${listIndex}/${index + 1}`);
      const tf = source.number === 4 || /class=["']tf["']/.test(raw) || (source.number >= 11 && /class=["'][^"']*\b(?:ok|no)\b/.test(keyHtml(teacherItem)));
      const auto = tf || [2, 6, 7, 8, 9, 10].includes(source.number);
      if (!auto) return `<li>${raw}</li>`;
      autoList = true; tfList ||= tf;
      const accepted = answers(source.number, index, teacherItem);
      if (!accepted[0]) throw new Error(`Missing canonical answer ${source.number}/${index + 1}`);
      // Keep original teacher explanations, but don't leave original answer controls.
      raw = replaceElements(raw, "div", "key", () => "");
      raw = replaceElements(raw, "div", "tf", () => "");
      raw = raw.replace(/<label\b[^>]*>/gi, "<p>").replace(/<\/label>/gi, "</p>");
      const control = showAnswers ? `<span class="ans">${escape([...new Set(accepted)].join(" / "))}</span>` : `<span class="${tf ? "tfbox" : "blank"}"></span>`;
      if (source.number === 7 && index === 0) raw = raw.replace(/___\s+you\s+___\s*\(be\)/, "___ (you / be)");
      raw = /___/.test(raw) ? raw.replace(/___/g, control) : `${raw} ${tf ? "" : "→ "}${control}`;
      return `<li>${raw}${showAnswers ? elements(teacherItem, "div", "key")[0]?.html ?? "" : ""}</li>`;
    });
    return `<ol${source.number === 10 ? ' class="sentence-check translation-check"' : autoList && !tfList ? ' class="sentence-check"' : ""}>${items}</ol>`;
  });
  html = replaceElements(html, "div", "dlg", element => {
    const lines = [...element.inner.matchAll(/<div\b[^>]*class=["']sp["'][^>]*>([\s\S]*?)<\/div>\s*<div\b[^>]*>([\s\S]*?)<\/div>/gi)];
    if (!lines.length) throw new Error("Missing dialogue turns");
    return `<div class="lines">${lines.map(line => `<p><b class="sp">${line[1]}</b> ${line[2]}</p>`).join("")}</div>`;
  });
  html = replaceElements(html, "div", "headline", element => `<h3>${element.inner}</h3>`);
  if (source.number === 15) html = html.replace(/<ol\b/, "<h3>Speaking questions</h3><ol");
  return html;
}

function sectionTone(number: number): RegularLessonTone {
  return number === 1 ? "vocab" : number === 5 ? "grammar" : [11, 13].includes(number) ? "reading" : [12, 14].includes(number) ? "dialogue" : "exercise";
}
const safe = (html: string) => cleanScriptHtml(addRegularLessonFocusIds(html));
const sectionId = (number: number) => `feelings-${String(number).padStart(2, "0")}`;

function homeworkFor(sections: RegularLessonSection[], words: WordContent[]): InteractiveHomeworkPlan {
  const clozeForms = ["freak out", "was taken aback", "is on edge", "loses his temper", "clams up", "feel absolutely gutted", "cringe", "got flustered", "was mortified", "went red", "burst out laughing", "crack me up", "laughed our heads off", "was thrilled to bits", "was really moved", "was overwhelmed"];
  const exercises: HomeworkExercise[] = [{ id: "feelings-vocab-fill", title: "Vocabulary — Fill in the gaps", kind: "fill", instruction: "Complete each example with the correct form of the expression.",
    items: words.map((word, index) => {
      const example = word.examples[0].en.split(" / ")[0], form = clozeForms[index];
      if (!example.includes(form)) throw new Error(`Missing cloze expression: ${word.word}`);
      return { id: `feelings-vocab-cloze-${index + 1}`, prompt: example.replace(form, "___"), answer: form, vocabularyWord: word.word };
    }) }];
  for (const section of sections) {
    if (section.teacherOnly || ["vocab", "grammar", "warm"].includes(section.tone)) continue;
    const lists = [...section.studentHtml.matchAll(/<ol\b[^>]*>([\s\S]*?)<\/ol>/gi)];
    const teacherLists = [...section.teacherHtml.matchAll(/<ol\b[^>]*>([\s\S]*?)<\/ol>/gi)];
    for (const [listIndex, list] of lists.entries()) {
      const teacherItems = [...teacherLists[listIndex][1].matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/gi)].map(match => match[1]);
      const studentItems = [...list[1].matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/gi)].map(match => match[1]);
      const tf = list[1].includes('class="tfbox"'), fill = list[1].includes('class="blank"');
      const number = Number(section.id.slice(-2)), vocabulary = number === 2;
      const instruction = plain(section.studentHtml.match(/<p\b[^>]*class=["']instr["'][^>]*>([\s\S]*?)<\/p>/i)?.[1] ?? "");
      const hasContext = section.tone === "reading" || section.tone === "dialogue";
      // These are complete student passages, not teacher keys or clipped excerpts.
      const contextHtml = hasContext ? elements(section.studentHtml, "div", section.tone === "reading" ? "reading" : "lines")[0]?.inner : undefined;
      if (hasContext && !contextHtml) throw new Error(`Missing reference text: ${section.title}`);
      const referenceText = contextHtml?.replace(/<\/(?:p|h[1-6])>/gi, "\n").split("\n").map(plain).filter(Boolean).join("\n\n");
      const title = vocabulary ? "Vocabulary — Guess the expression" : number === 4 ? "Meaning check — True or false?" : `${section.title}${hasContext ? tf ? " — True or false?" : " — Questions" : ""}`;
      const kind = vocabulary ? "definition" : number === 10 ? "translate" : number === 15 ? "question-audio" : fill || tf ? "fill" : "question-text";
      exercises.push({
        id: `regular-${section.id}-${listIndex + 1}`, title, kind,
        instruction: tf ? "Choose True or False. For false statements, explain the correction to your teacher." : instruction,
        ...(number === 10 ? { translationDirection: "to-english" as const, translationLanguage: "UK" as const } : {}),
        ...(hasContext ? { referenceTitle: section.title, referenceText } : {}),
        items: studentItems.map((item, index) => {
          const answerNode = [...teacherItems[index].matchAll(/<span\b[^>]*class=["'][^"']*\bans\b[^"']*["'][^>]*>([\s\S]*?)<\/span>/gi)][0]?.[1];
          const accepted = answerNode ? plain(answerNode).split(/\s+\/\s+/) : [];
          if ((fill || tf) && !accepted[0]) throw new Error(`Missing homework answer: ${section.id}/${index + 1}`);
          let prompt = plain(item.replace(/<span\b[^>]*class=["']blank["'][^>]*>[\s\S]*?<\/span>/gi, "___").replace(/<span\b[^>]*class=["']tfbox["'][^>]*>[\s\S]*?<\/span>/gi, ""));
          if (vocabulary || number === 10) prompt = prompt.replace(/\s*→\s*___$/, "");
          if (tf) prompt += " → ___";
          return {
            id: `feelings-hw-${number}-${listIndex + 1}-${index + 1}`, prompt,
            ...(accepted.length && kind !== "question-text" && kind !== "question-audio" ? { answer: accepted[0], accepted: accepted.slice(1) } : {}),
            ...(vocabulary ? { vocabularyWord: accepted[0] } : {}),
            ...(tf ? { choices: ["True", "False"] } : number === 6 ? { choices: ["A", "B"] } : {}),
          };
        }),
      });
    }
  }
  return organizeVocabularyHomework({ kind: "INTERACTIVE_HOMEWORK_V1", title: `${FEELINGS_LESSON_TITLE} — Homework`,
    intro: "Vocabulary, advanced present forms, object + -ing, translations, two readings and two dialogues. Read the complete reference text inside each comprehension exercise. Record your Speaking answers in the built-in recorder.", exercises }, words, { includeAllWords: true });
}

export function feelingsLessonFromHtml(studentSource: string, teacherSource: string) {
  const student = sourceSections(studentSource), teacher = sourceSections(teacherSource);
  if (student.length !== 15 || teacher.length !== 16 || teacher[0].number !== 0 || student.some((item, index) => item.number !== index + 1)) throw new Error("Feelings requires all fifteen student sections and the separate teacher warm-up");
  const warmup: RegularLessonSection = { id: "feelings-00", title: teacher[0].title, tone: "warm", studentHtml: "", teacherHtml: safe(teacher[0].html), teacherOnly: true, defaultOpen: false };
  const sections: RegularLessonSection[] = [warmup];
  for (const source of student) {
    const answer = teacher.find(section => section.number === source.number);
    if (!answer || answer.title !== source.title) throw new Error(`Feelings section mismatch: ${source.number}`);
    if (/class=["'][^"']*\bkey\b/i.test(source.html)) throw new Error("Teacher keys found in student source");
    const publicTips = new Set(elements(source.html, "div", "tip").map(tip => plain(tip.inner)));
    const answerHtml = replaceElements(answer.html, "div", "tip", tip => publicTips.has(plain(tip.inner)) ? tip.html : tip.html.replace(/class=["']tip["']/, 'class="tip key"'));
    sections.push({ id: sectionId(source.number), title: source.title, tone: sectionTone(source.number), defaultOpen: source.number === 1,
      studentHtml: safe(convertedBody(source, answer, false)), teacherHtml: safe(convertedBody({ ...answer, html: answerHtml }, answer, true)) });
    if (source.number === 1) {
      const guide = `${source.html.match(/<p\b[^>]*class=["']instr["'][^>]*>[\s\S]*?<\/p>/i)?.[0] ?? ""}${elements(source.html, "div", "tip").map(tip => tip.html).join("")}`;
      sections.push({ id: "feelings-vocabulary-guide", title: "Vocabulary — Collocations & lead-in", tone: "warm", studentHtml: safe(guide), teacherHtml: safe(guide), defaultOpen: false });
    }
  }
  const words = feelingsVocabulary(student[0].html);
  const normalized = normalizeRegularLessonSections(sections);
  return { title: FEELINGS_LESSON_TITLE, description: "16 emotion expressions · advanced Present Simple / Continuous · object + -ing · translation · two texts, two dialogues, Speaking & complete interactive homework.", sections: normalized, words, homework: [homeworkFor(normalized, words)] };
}
