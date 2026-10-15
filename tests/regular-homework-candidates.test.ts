import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import test from "node:test";
import ts from "typescript";
import { buildA2PopularQuestionsLesson } from "../src/lib/bundled-lessons/a2-popular-questions";
import { buildB1MoreDailyRoutinesLesson } from "../src/lib/bundled-lessons/b1-more-daily-routines";
import * as regular from "../src/lib/regular-lesson";
import { regularHomeworkShowsWordBank } from "../src/lib/lesson-homework";
import { detectTranslationLang } from "../src/lib/translation-lang";

const source = readFileSync(new URL("../src/components/lessons/regular-lesson-view.tsx", import.meta.url), "utf8");
const file = ts.createSourceFile("regular-lesson-view.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const plain = (html: string) => html.replace(/<[^>]*>/g, "").replace(/&amp;/g, "&")
  .replace(/&nbsp;/g, " ").replace(/&#39;|&apos;/g, "'").replace(/&quot;/g, '"');
const classes = (attributes: string) => attributes.match(/\bclass=["']([^"']*)["']/i)?.[1].split(/\s+/) ?? [];

/** Small fixture DOM implementing only the browser operations used by the native extractor. */
class FixtureElement {
  previousElementSibling: FixtureElement | null = null;
  readonly appended: unknown[] = [];
  constructor(readonly tagName: string, public html: string, readonly ownClasses: string[] = [], readonly parents: string[] = []) {}
  get textContent() { return plain(this.html); }
  get classList() { return { contains: (name: string) => this.ownClasses.includes(name) }; }
  matches(selector: string) { return selector.startsWith(".") && this.ownClasses.includes(selector.slice(1)); }
  closest(selector: string) {
    return selector.split(",").some(value => [...this.ownClasses, ...this.parents].includes(value.trim().slice(1))) ? this : null;
  }
  cloneNode() { return new FixtureElement(this.tagName, this.html, this.ownClasses, this.parents); }
  append(value: unknown) { this.appended.push(value); }
  querySelector(selector: string) { return this.querySelectorAll(selector)[0] ?? null; }
  querySelectorAll(selector: string): (FixtureElement | FixtureControl)[] {
    if (selector === ":scope > li") return [...this.html.matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/gi)]
      .map(match => new FixtureElement("LI", match[1], [], this.parents));
    return [...this.html.matchAll(/<span\b([^>]*)>([\s\S]*?)<\/span>/gi)]
      .filter(match => selector.split(",").some(value => classes(match[1]).includes(value.trim().slice(1))))
      .map(match => new FixtureControl(this, match[0], match[2], classes(match[1])));
  }
}
class FixtureControl {
  constructor(readonly owner: FixtureElement, readonly original: string, readonly html: string, readonly ownClasses: string[]) {}
  get textContent() { return plain(this.html); }
  set textContent(value: string) { this.owner.html = this.owner.html.replace(this.original, value); }
  get classList() { return { contains: (name: string) => this.ownClasses.includes(name) }; }
  remove() { this.owner.html = this.owner.html.replace(this.original, ""); }
}
function parentClasses(html: string, offset: number) {
  const stack: { tag: string; names: string[] }[] = [];
  for (const match of html.slice(0, offset).matchAll(/<(\/?)([a-z][\w-]*)\b([^>]*)>/gi)) {
    const tag = match[2].toLowerCase();
    if (match[1]) {
      const at = stack.findLastIndex(entry => entry.tag === tag);
      if (at >= 0) stack.splice(at);
    } else if (!["br", "hr", "img", "input"].includes(tag)) stack.push({ tag, names: classes(match[3]) });
  }
  return stack.flatMap(entry => entry.names);
}
class FixtureDOMParser {
  parseFromString(html: string) {
    return { querySelectorAll: (tag: string) => [...html.matchAll(new RegExp(`<${tag}\\b([^>]*)>([\\s\\S]*?)<\\/${tag}>`, "gi"))].map(match => {
      const element = new FixtureElement(tag.toUpperCase(), match[2], classes(match[1]), parentClasses(html, match.index!));
      const previous = [...html.slice(0, match.index!).matchAll(/<(h3|p)\b([^>]*)>([\s\S]*?)<\/\1>/gi)]
        .map(node => new FixtureElement(node[1].toUpperCase(), node[3], classes(node[2])));
      previous.forEach((node, index) => { node.previousElementSibling = previous[index - 1] ?? null; });
      element.previousElementSibling = previous.at(-1) ?? null;
      return element;
    }) };
  }
}

const names = ["headingBefore", "instructionBefore", "homeworkInstruction", "homeworkReference", "homeworkCandidates", "isOpenQuestionList"];
const functions = names.map(name => {
  const node = file.statements.find(entry => ts.isFunctionDeclaration(entry) && entry.name?.text === name);
  assert.ok(node, `Execute the actual ${name} function`);
  return node.getText(file);
}).join("\n");
const exports = {} as {
  homeworkCandidates: (section: regular.RegularLessonSection, state: Record<string, string>) => {
    listIndex: number; exercise: { id: string; kind: string; items: { id: string; prompt: string }[]; referenceText?: string; referenceTitle?: string };
  }[];
  isOpenQuestionList: (list: FixtureElement, section: regular.RegularLessonSection) => boolean;
};
runInNewContext(ts.transpileModule(functions + "\nObject.assign(exports, { homeworkCandidates, isOpenQuestionList });", {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
}).outputText, {
  exports, ...regular, regularHomeworkShowsWordBank, detectTranslationLang, DOMParser: FixtureDOMParser,
  cleanText: (value: unknown) => String(value ?? "").replace(/\s+/g, " ").replace(/\s+([,.!?;:])/g, "$1").trim(),
});
const fixture = (name: string) => readFileSync(new URL(`../scripts/fixtures/${name}`, import.meta.url), "utf8");
const lesson = buildA2PopularQuestionsLesson(fixture("a2-popular-questions-student.html"), fixture("a2-popular-questions-teacher.html"));
const section = (number: number) => lesson.sections.find(entry => entry.id === `popular-questions-${String(number).padStart(2, "0")}`)!;
const json = <T>(value: T): T => JSON.parse(JSON.stringify(value));

test("all fifteen Popular questions practice groups are available to add individually, including Fruit revision", () => {
  const candidates = lesson.sections.filter(entry => entry.tone !== "vocab").flatMap(entry => exports.homeworkCandidates(entry, {}));
  assert.equal(candidates.length, 15);
  assert.deepEqual(json(exports.homeworkCandidates(section(1), {}).map(entry => entry.listIndex)), [1, 2, 3]);
  assert.deepEqual(candidates.map(entry => entry.exercise.items.length), [5, 5, 8, 9, 10, 10, 10, 10, 6, 10, 10, 8, 8, 10, 10]);
  assert.equal(new Set(candidates.map(entry => entry.exercise.id)).size, 15);
  const itemIds = candidates.flatMap(entry => entry.exercise.items.map(item => item.id));
  assert.equal(itemIds.length, 129);
  assert.equal(new Set(itemIds).size, itemIds.length, "Adding any combination must not merge students' response IDs");
  assert.equal(exports.homeworkCandidates(section(1), {})[1].exercise.kind, "question-text");
});

test("the shared open-question predicate recognizes real prompts but excludes ordinary notes and private sections", () => {
  const base = { ...section(1), title: "Revision" };
  const questions = new FixtureElement("OL", "<li>What fruit do you eat?</li><li>What should people eat?</li>");
  assert.equal(exports.isOpenQuestionList(questions, base), true);
  assert.equal(exports.isOpenQuestionList(new FixtureElement("OL", "<li>Read the example.</li><li>Use English.</li>"), base), false);
  for (const context of ["key", "key-wrap", "teacher-note", "instr", "note", "tip", "support", "vcard"]) {
    assert.equal(exports.isOpenQuestionList(new FixtureElement("OL", questions.html, [], [context]), base), false, context);
  }
  assert.equal(exports.isOpenQuestionList(questions, { ...base, teacherOnly: true }), false);
  assert.equal(exports.isOpenQuestionList(questions, { ...base, tone: "teacher" }), false);
  assert.deepEqual(json(exports.homeworkCandidates({ ...base, teacherOnly: true }, {})), []);
  assert.deepEqual(json(exports.homeworkCandidates({ ...base, tone: "teacher" }, {})), []);
  const compatibility = new FixtureElement("OL", "<li>Tell me about your town.</li>");
  assert.equal(exports.isOpenQuestionList(compatibility, { ...base, title: "Personal questions" }), true);
});

test("deleted classroom groups stay excluded and teacher keys never become homework candidates", () => {
  const state = { [regular.regularExerciseDeletedKey(section(1).id, 2)]: "1" };
  assert.deepEqual(json(exports.homeworkCandidates(section(1), state).map(entry => entry.listIndex)), [1, 3]);
  const publicSection = { ...section(4), studentHtml: section(4).studentHtml + '<div class="key"><ol><li>Why is this private?</li></ol></div>' };
  assert.equal(exports.homeworkCandidates(publicSection, {}).length, 1);
  assert(!JSON.stringify(exports.homeworkCandidates(publicSection, {})).includes("Why is this private?"));
});

test("both comprehension groups copy every public reading paragraph and dialogue turn with no teacher answers", () => {
  for (const [number, paragraphs] of [[8, 6], [9, 15], [10, 24]]) {
    const current = section(number);
    const candidates = exports.homeworkCandidates(current, {});
    assert.equal(candidates.length, 2);
    const expected = [...current.studentHtml.split(/<h3\b|<ol\b/i)[0].matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)]
      .map(match => plain(match[1]).replace(/\s+/g, " ").trim()).filter(Boolean);
    assert.equal(expected.length, paragraphs);
    for (const candidate of candidates) {
      assert.equal(candidate.exercise.referenceTitle, current.title);
      assert.equal(candidate.exercise.referenceText, expected.join("\n\n"));
      assert.doesNotMatch(candidate.exercise.referenceText!, /Ключі|Teacher notes|class=|<span|<div/);
    }
    assert.equal(candidates[0].exercise.referenceText, candidates[1].exercise.referenceText);
  }
});

test("the actual classroom open-answer block creates and saves response fields for all five Fruit revision questions", async () => {
  let openBlock: ts.IfStatement | undefined;
  const visit = (node: ts.Node) => {
    if (ts.isIfStatement(node) && node.expression.getText(file).includes("isOpenQuestionList(list, active)")) openBlock = node;
    ts.forEachChild(node, visit);
  };
  visit(file);
  assert.ok(openBlock);
  const active = section(1);
  const list = new FixtureDOMParser().parseFromString(active.studentHtml).querySelectorAll("ol")[1];
  const items = list.querySelectorAll(":scope > li") as FixtureElement[];
  const saves: [string, string][] = [];
  const fields: { value: string; listeners: Map<string, () => void> }[] = [];
  const context = {
    list, items, active, listIndex: 1, isOpenQuestionList: exports.isOpenQuestionList,
    regularResponseKey: regular.regularResponseKey, cleanups: [] as (() => void)[],
    read: () => "", save: async (key: string, value: string) => { saves.push([key, value]); }, addNote() {},
    document: { createElement: () => {
      const field = { value: "", listeners: new Map<string, () => void>(),
        addEventListener: (event: string, handler: () => void) => field.listeners.set(event, handler),
        removeEventListener: (event: string) => field.listeners.delete(event), remove() {},
      };
      fields.push(field);
      return field;
    } },
  };
  runInNewContext(ts.transpileModule(openBlock.getText(file), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  }).outputText, context);
  assert.equal(fields.length, 5);
  fields[0].value = " I eat apples. ";
  fields[0].listeners.get("blur")!();
  await Promise.resolve();
  assert.deepEqual(saves, [[regular.regularResponseKey(active.id, "list-2-item-1-open"), "I eat apples."]]);
  context.cleanups.forEach(cleanup => cleanup());
  assert(fields.every(field => field.listeners.size === 0));
});

test("all More daily routines classroom groups can be copied individually and comprehension retains its full text", () => {
  const daily = buildB1MoreDailyRoutinesLesson();
  const groups = daily.sections.flatMap(section => exports.homeworkCandidates(section, {}));
  assert.equal(groups.length, 13);
  assert.equal(new Set(groups.map(group => group.exercise.id)).size, 13);
  const ids = groups.flatMap(group => group.exercise.items.map(item => item.id));
  assert.equal(ids.length, 112);
  assert.equal(new Set(ids).size, ids.length);
  assert(!groups.some(group => /teacher/i.test(group.exercise.id)));
  for (const section of daily.sections.filter(section => section.tone === "reading" || section.tone === "dialogue")) {
    const copies = exports.homeworkCandidates(section, {});
    assert.equal(copies.length, 2);
    assert(copies.every(copy => copy.exercise.items.length === 8));
    const expected = [...section.studentHtml.split(/<h3\b|<ol\b/i)[0].matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)]
      .map(match => plain(match[1]).replace(/\s+/g, " ").trim()).filter(Boolean).join("\n\n");
    assert(copies.every(copy => copy.exercise.referenceText === expected && copy.exercise.referenceTitle === section.title));
    assert(!copies.some(copy => copy.exercise.referenceText!.includes("Suggested answer:")));
  }
});
