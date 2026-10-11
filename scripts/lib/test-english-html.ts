import type { TestExercise, TestPassagePart, TestQuestion } from "../../src/lib/tests/types";

type Node = { tag: string; attrs: Record<string, string>; children: (Node | string)[] };
const entities: Record<string, string> = { nbsp: " ", amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", rsquo: "’", lsquo: "‘", rdquo: "”", ldquo: "“", hellip: "…", rarr: "→", rArr: "⇒", ndash: "–", mdash: "—" };
export function decodeTestHtml(value: string) {
  return value.replace(/&(#x[\da-f]+|#\d+|[a-z]+);/gi, (all, key: string) => key.startsWith("#") ? String.fromCodePoint(parseInt(key.slice(key[1].toLowerCase() === "x" ? 2 : 1), key[1].toLowerCase() === "x" ? 16 : 10)) : entities[key] ?? all);
}
function parse(html: string): Node {
  const root: Node = { tag: "root", attrs: {}, children: [] }, stack = [root];
  const safe = html.replace(/<!--([\s\S]*?)-->/g, "").replace(/<(script|style|iframe)\b[^>]*>[\s\S]*?<\/\1>/gi, "");
  for (const token of safe.match(/<[^>]*>|[^<]+/g) ?? []) {
    if (!token.startsWith("<")) { stack.at(-1)!.children.push(decodeTestHtml(token)); continue; }
    const close = token.match(/^<\/([\w-]+)/);
    if (close) { const index = stack.findLastIndex((node) => node.tag === close[1].toLowerCase()); if (index > 0) stack.length = index; continue; }
    const open = token.match(/^<([\w-]+)/);
    if (!open) continue;
    const node: Node = { tag: open[1].toLowerCase(), attrs: {}, children: [] };
    for (const match of token.slice(open[0].length).matchAll(/([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g)) node.attrs[match[1].toLowerCase()] = decodeTestHtml(match[2] ?? match[3] ?? match[4]);
    stack.at(-1)!.children.push(node);
    if (!/^(input|br|img|hr|meta|link|source|wbr)$/.test(node.tag) && !token.endsWith("/>")) stack.push(node);
  }
  return root;
}
function find(node: Node, predicate: (node: Node) => boolean): Node[] {
  return [...(predicate(node) ? [node] : []), ...node.children.flatMap((child) => typeof child === "string" ? [] : find(child, predicate))];
}
const hasClass = (node: Node, value: string) => (node.attrs.class ?? "").split(/\s+/).includes(value);
function text(node: Node): string { return node.children.map((child) => typeof child === "string" ? child : child.tag === "br" ? "\n" : text(child)).join(""); }
const tidy = (value: string) => value.replace(/[\t\r\n ]+/g, " ").trim();

/** Read inert quiz markup only. Never execute its scripts or keep answer/session fields. */
export function parseTestEnglishExercise(html: string, number: number, supplements = false): TestExercise {
  const root = parse(html), quiz = find(root, (node) => node.attrs.id === "watupro_quiz")[0];
  const form = quiz && find(quiz, (node) => node.tag === "form" && hasClass(node, "quiz-form"))[0];
  if (!form) throw new Error("No saved quiz form");
  const header = html.slice(0, html.indexOf('<div id="watupro_quiz"'));
  const heading = [...header.matchAll(/<h5\b[^>]*>([\s\S]*?)<\/h5>/g)].at(-1)?.[1];
  const instruction = heading ? tidy(text(parse(heading))) : "Complete the sentences.";
  const exercise: TestExercise = { id: `exercise-${number}`, number, instruction, questions: [] };
  if (supplements && heading) {
    const headingEnd = header.lastIndexOf("</h5>") + 5;
    const context = tidy(text(parse(header.slice(headingEnd).replace(/<\/(?:p|div|td|tr|table)>/gi, " "))));
    if (context) exercise.context = context;
  }
  const passage: TestPassagePart[][] = [];
  for (const block of find(form, (node) => hasClass(node, "watu-question"))) {
    const content = find(block, (node) => hasClass(node, "question-content"))[0];
    if (!content) throw new Error("Missing question content");
    const fields = find(content, (node) => node.tag === "select" || node.tag === "input" && node.attrs.type === "text");
    const options = [...new Set(find(block, (node) => node.tag === "label").map((node) => tidy(text(node))).filter(Boolean))];
    if (!fields.length) {
      const promptNode = structuredClone(content);
      promptNode.children = promptNode.children.filter((node) => typeof node === "string" || node.tag !== "input");
      const prompt = tidy(text(promptNode)).replace(/^\d+\s+/, "");
      if (!prompt || options.length < 2 || new Set(options).size !== options.length) throw new Error("Invalid saved choices");
      const multiple = find(block, (node) => node.tag === "input" && node.attrs.type === "checkbox").length > 0;
      const images = supplements ? find(content, node => node.tag === "img").map(node => ({
        src: node.attrs.src, alt: node.attrs.alt || "Exercise illustration", width: Number(node.attrs.width || 500), height: Number(node.attrs.height || 300),
      })) : [];
      exercise.questions.push({ id: `q${exercise.questions.length + 1}`, before: "", after: "", prompt, options, ...(multiple ? { kind: "multiple", selectionCount: 2 } : {}), ...(images.length ? { images } : {}) });
      continue;
    }
    const parts: TestPassagePart[] = [];
    const addText = (value: string) => { const previous = parts.at(-1); if (previous && "text" in previous) previous.text += value; else parts.push({ text: value }); };
    const walk = (node: Node) => {
      if (hasClass(node, "watupro_num") || hasClass(node, "numBox") || node.tag === "input" && node.attrs.type !== "text") return;
      if (node.tag === "select" || node.tag === "input" && node.attrs.type === "text") {
        const id = `q${exercise.questions.length + 1}`;
        const choices = node.tag === "select" ? find(node, (child) => child.tag === "option").map((child) => tidy(text(child))).filter(Boolean) : [];
        if (node.tag === "select" && (choices.length < 2 || new Set(choices).size !== choices.length)) throw new Error("Invalid saved dropdown");
        exercise.questions.push({ id, before: "", after: "", options: choices, ...(node.tag === "input" ? { kind: "text" } : {}) });
        parts.push({ questionId: id }); return;
      }
      if (node.tag === "br") { addText("\n"); return; }
      if (node.tag === "img") throw new Error("Question image requires explicit import");
      const underlined = supplements && (node.tag === "u" || /text-decoration[^;]*underline/i.test(node.attrs.style ?? ""));
      if (underlined) addText("⟦");
      for (const child of node.children) typeof child === "string" ? addText(child.replace(/[\t\r\n ]+/g, " ")) : walk(child);
      if (underlined) addText("⟧");
      if (node.tag === "p") addText("\n\n");
    };
    walk(content);
    const paragraphs: TestPassagePart[][] = [[]];
    for (const part of parts) {
      if ("questionId" in part) { paragraphs.at(-1)!.push(part); continue; }
      part.text.split(/\n\s*\n/).forEach((chunk, index) => { if (index) paragraphs.push([]); if (chunk) paragraphs.at(-1)!.push({ text: chunk }); });
    }
    for (const paragraph of paragraphs) {
      if (!paragraph.some((part) => "questionId" in part || part.text.trim())) continue;
      if (paragraph[0] && "text" in paragraph[0]) paragraph[0].text = paragraph[0].text.trimStart();
      const last = paragraph.at(-1); if (last && "text" in last) last.text = last.text.trimEnd();
      for (const [index, part] of paragraph.entries()) {
        if (!("questionId" in part)) continue;
        const question = exercise.questions.find((question) => question.id === part.questionId)!;
        const context = (items: TestPassagePart[]) => items.map((item) => "text" in item ? item.text : "…").join("");
        question.before = context(paragraph.slice(0, index)); question.after = context(paragraph.slice(index + 1));
      }
      passage.push(paragraph);
    }
  }
  if (!exercise.questions.length) throw new Error("Empty saved exercise");
  if (passage.length) {
    const gaps = passage.flat().filter((part) => "questionId" in part);
    if (gaps.length !== exercise.questions.length) throw new Error("Mixed formats require explicit review");
    exercise.passage = passage;
  }
  if (supplements && JSON.stringify(exercise.passage ?? []).includes("⟦")) exercise.instruction += " Underlined words are marked with ⟦ ⟧.";
  return exercise;
}
