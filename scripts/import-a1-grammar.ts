import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { copyFile, mkdir, writeFile } from "node:fs/promises";
import { basename, dirname, join, resolve, sep } from "node:path";
import { spawnSync } from "node:child_process";
import sharp from "sharp";
import { parseTestEnglishExercise, decodeTestHtml } from "./lib/test-english-html";
import { FOLDER_TESTS } from "../src/lib/tests/folder-tests";
import type { TestCatalogEntry, TestExercise } from "../src/lib/tests/types";

const root = process.argv.slice(2).find(argument => !argument.startsWith("--")) ?? "F:/TestEnglish/A1/Grammar";
const apply = process.argv.includes("--apply");
const contentOnly = process.argv.includes("--content-only");
const plan = JSON.parse(readFileSync(join(root, "_a1-grammar-download-plan.json"), "utf8")) as {
  topics: { source: string; folder: string; title: string; exerciseCount: number }[];
};
const ids: Record<string, string> = { "present-simple-forms-of-to-be": "a1-to-be", "this-that-these-those": "a1-demonstratives", "possessive-adjectives": "a1-possessives", "a-an-plurals": "a1-a-an-plurals", adjectives: "a1-adjectives" };
const coverLabels: Record<string, [string, string, string, string, string]> = {
  "present-simple": ["Present simple", "I do. She does.", "do", "does", "+s"],
  questions: ["Questions", "Words & order", "who", "what", "why"],
  "adverbs-frequency": ["Adverbs", "Frequency", "often", "never", "always"],
  "object-pronouns": ["Subject & object", "Pronouns", "me", "him", "them"],
  "whose-possessive-s": ["Whose?", "Possessive 's", "'s", "whose", "who's"],
  "at-in-on-prepositions-time": ["Prepositions", "Time", "at", "in", "on"],
  "at-in-on-prepositions-of-place": ["Prepositions", "Place", "at", "in", "on"],
  "can-cant": ["Can & can't", "Ability & permission", "can", "can't", "can I?"],
  "present-continuous": ["Present continuous", "Happening now", "am", "is", "-ing"],
  "present-simple-present-continuous": ["Simple or continuous?", "Habits & now", "do", "now", "-ing"],
  "imperative-sit-dont-talk": ["The imperative", "Instructions & suggestions", "do", "don't", "let's"],
  "was-were": ["Was & were", "Past simple of be", "was", "were", "past"],
  "past-simple-regular-irregular": ["Past simple", "Regular & irregular", "-ed", "went", "did"],
  "past-simple-negatives-questions": ["Past simple", "Negatives & questions", "did", "didn't", "past"],
  "verbs-infinitive-verbs-ing": ["Verbs", "To or -ing?", "to", "-ing", "like"],
  "would-like": ["Would like", "Wishes & offers", "would", "like", "to"],
  "have-got": ["Have got", "Possession", "have", "has", "got"],
  "a-some-any-countable-uncountable": ["A, some & any", "Countable & uncountable", "a", "some", "any"],
  "there-is-there-are": ["There is. There are.", "Present & past", "is", "are", "there"],
  "there-it": ["There or it?", "Existence & reference", "there", "it", "they"],
  "next-to-under-between-in-front-behind-etc": ["Prepositions of place", "Where is it?", "above", "under", "beside"],
  "much-many-lot-little-few": ["Much & many", "How much? How many?", "much", "many", "a few"],
  "comparative-adjectives": ["Comparatives", "Bigger. Better. Further.", "-er", "more", "than"],
  "superlative-adjectives": ["Superlatives", "The best of all", "-est", "most", "the"],
  "will-and-shall": ["Will & shall", "Future, offers & suggestions", "will", "won't", "shall"],
  "be-going-to-plans-predictions": ["Be going to", "Plans & predictions", "be", "going", "to"],
  "adverbs-manner": ["Adverbs of manner", "How do you do it?", "-ly", "well", "fast"],
  "a-an-the-no-article": ["Articles", "A, an, the or no article?", "a", "an", "the"],
  "conjunctions_and-but-or-so-because": ["Conjunctions", "Link your ideas", "and", "but", "so"],
  "basic-word-order-in-english": ["Word order", "Build a sentence", "subject", "verb", "object"],
  "the-difference-between-this-and-it": ["This or it?", "Pointing & referring", "this", "it", "refer"],
};
const tests: TestCatalogEntry[] = [];
const provenance: { id: string; folder: string; source: string; version: number; pages: { file: string; source: string; exercise: number; sha256: string; questions: number }[] }[] = [];
const imageSources: { output?: string; original: string; exercise: number; adaptation?: string; question?: string }[] = [];
function saveSource(file: string, value: string) {
  const exe = process.env.CODEX_PATCH_EXE;
  if (!exe) throw new Error("Set CODEX_PATCH_EXE to the Codex patch executable");
  const lines = value.trimEnd().split("\n");
  let offset = 0;
  while (offset < lines.length) {
    const previous = offset ? lines[offset - 1] : null;
    const chunk: string[] = [];
    let length = 0;
    while (offset < lines.length && length + lines[offset].length < 12000) { length += lines[offset].length + 2; chunk.push(lines[offset++]); }
    if (!chunk.length) throw new Error("Source line exceeds safe patch length");
    const patch = `*** Begin Patch\n*** ${previous === null ? "Add" : "Update"} File: ${file}\n${previous === null ? "" : "@@\n " + previous + "\n"}${chunk.map(line => "+" + line).join("\n")}\n${previous === null ? "" : "*** End of File\n"}*** End Patch\n`;
    const result = spawnSync(exe, ["--codex-run-as-apply-patch", patch], { encoding: "utf8" });
    if (result.status !== 0) throw new Error(result.stderr || result.stdout || "Patch failed");
  }
}
async function main() {
  for (const topic of plan.topics) {
    const slug = new URL(topic.source).pathname.split("/").filter(Boolean).at(-1)!;
    const id = ids[slug] ?? `a1-${slug}`;
    const previous = FOLDER_TESTS.find(test => test.id === id);
    const files = readdirSync(join(root, topic.folder)).filter(file => /\.html?$/i.test(file));
    const pages = files.map(file => {
      const full = join(root, topic.folder, file), html = readFileSync(full, "utf8");
      const canonical = html.match(/<link\b[^>]*rel=["']canonical["'][^>]*href=["']([^"']+)/i)?.[1];
      if (!canonical?.startsWith(topic.source)) throw new Error("Wrong topic: " + full);
      const suffix = canonical.slice(topic.source.length), number = Number(suffix.replace("/", "") || 1);
      if (!Number.isInteger(number) || number < 1 || number > topic.exerciseCount) throw new Error("Unexpected page: " + full);
      return { file, full, html, number, canonical };
    }).sort((a, b) => a.number - b.number);
    if (pages.length !== topic.exerciseCount || new Set(pages.map(page => page.number)).size !== topic.exerciseCount) throw new Error("Missing or duplicate exercises: " + slug);
    const exercises: TestExercise[] = [];
    for (const page of pages) {
      const exercise = parseTestEnglishExercise(page.html, page.number, true);
      const quiz = page.html.indexOf('<div id="watupro_quiz"');
      const header = page.html.slice(page.html.lastIndexOf("<h3", quiz), quiz);
      const images = [];
      for (const tag of header.match(/<img\b[^>]*>/gi) ?? []) {
        const src = decodeTestHtml(tag.match(/\bsrc=["']([^"']+)/i)?.[1] ?? "");
        const remote = tag.match(/\bsrcset=["'](https:\/\/[^\s,"']+)/i)?.[1] ?? (/^https:\/\//.test(src) ? src : null);
        const file = basename(src), output = `public/images/tests/a1-exercises/${id}-${page.number}-${file}`;
        if (id === "a1-imperative-sit-dont-talk" && page.number === 1 && file === "imperative-exercise-1.png") {
          exercise.instruction = "Read the numbered situations and complete the sentences using positive or negative imperatives. Use the verbs in the word bank.";
          exercise.context += "\n\nAccessible text adaptation of the unavailable sign illustration:\n1. A quiet area: talking is prohibited.\n2. Fishing is prohibited here.\n3. All mobile phones must be switched off.\n4. Follow the arrow pointing right.\n5. Smoking is prohibited here.\n6. Put your name on this form.\n7. Warning: wet floor.\n8. Hands must be cleaned before entering.\n9. Slow speed required.\n10. This water is not safe to drink.";
          imageSources.push({ original: remote ?? src, exercise: page.number, adaptation: "Numbered text situations retain the source word bank and gaps; right-turn situation explicitly uses a positive direction." });
          continue;
        }
        const local = resolve(dirname(page.full), src);
        if (!local.startsWith(resolve(dirname(page.full)) + sep)) throw new Error("Exercise image leaves its topic folder");
        if (remote && new URL(remote).hostname !== "test-english.com") throw new Error("Unexpected remote exercise image host");
        const alternate = readdirSync(dirname(page.full)).find(name => name === file || name.replace(/-\d+x\d+(?=\.[^.]+$)/, "").replace(/\.(?:png|webp|jpe?g)$/i, "") === file.replace(/\.(?:png|webp|jpe?g)$/i, ""));
        if (apply && !contentOnly && !existsSync(output)) {
          await mkdir(dirname(output), { recursive: true });
          if (existsSync(local)) await copyFile(local, output);
          else if (alternate) await sharp(join(dirname(page.full), alternate)).toFile(output);
          else if (remote) {
            const response = await fetch(remote);
            if (!response.ok || !response.headers.get("content-type")?.startsWith("image/")) throw new Error("Missing exercise image: " + remote);
            await writeFile(output, Buffer.from(await response.arrayBuffer()));
          } else throw new Error("Missing exercise image: " + local);
        }
        images.push({ src: "/" + output.replace(/^public\//, ""), alt: decodeTestHtml(tag.match(/\balt=["']([^"']+)/i)?.[1] ?? "Exercise illustration"), width: Number(tag.match(/\bwidth=["'](\d+)/i)?.[1] ?? 810), height: Number(tag.match(/\bheight=["'](\d+)/i)?.[1] ?? 500) });
        imageSources.push({ output, original: remote ?? src, exercise: page.number });
      }
      if (images.length) exercise.images = images;
      for (const question of exercise.questions) for (const image of question.images ?? []) {
        const local = resolve(dirname(page.full), image.src);
        if (!local.startsWith(resolve(dirname(page.full)) + sep)) throw new Error("Question image leaves its topic folder");
        const output = `public/images/tests/a1-exercises/${id}-${page.number}-${basename(image.src)}`;
        if (apply && !contentOnly && !existsSync(output)) {
          if (!existsSync(local)) throw new Error("Missing question image: " + local);
          await mkdir(dirname(output), { recursive: true });
          await copyFile(local, output);
        }
        imageSources.push({ output, original: image.src, exercise: page.number, question: question.id });
        image.src = "/" + output.replace(/^public\//, "");
        image.alt = `Illustration for question ${question.id.slice(1)}`;
      }
      exercises.push(exercise);
    }
    const definition: TestCatalogEntry = { id, version: id === "a1-adjectives" ? 2 : 1, level: "a1", category: "grammar",
      title: previous?.title ?? topic.title, subtitle: previous?.subtitle ?? "A1 grammar · all exercises",
      cover: previous?.cover ?? { src: `/images/tests/${id}-v1.webp`, width: 1200, height: 600, alt: "A1 Grammar: " + topic.title }, exercises };
    if (apply && !contentOnly && !previous) {
      // Reuse the project's original code-native cover template, not remote art.
      const labels = coverLabels[slug];
      if (!labels) throw new Error("Missing cover labels: " + slug);
      const escape = (value: string) => value.replaceAll("&", "&amp;").replaceAll("<", "&lt;");
      const svg = readFileSync("docs/assets/tests/a1-adjectives-v1.svg", "utf8")
        .replace("Adjectives:", escape(labels[0])).replace("the basics", escape(labels[1]))
        .replace(">new</text>", ">" + escape(labels[2]) + "</text>")
        .replace(">nice</text>", ">" + escape(labels[3]) + "</text>")
        .replace(">great</text>", ">" + escape(labels[4]) + "</text>")
        .replace("Make your sentences more colourful.", "Build your grammar. One sentence at a time.")
        .replace(/font-size="68"/g, 'font-size="38"');
      saveSource(`docs/assets/tests/${id}-v1.svg`, svg);
      await sharp(Buffer.from(svg)).webp({ quality: 88 }).toFile("public" + definition.cover.src);
    }
    tests.push(definition);
    provenance.push({ id, folder: topic.folder, source: topic.source, version: definition.version, pages: pages.map(page => ({ file: topic.folder + "/" + page.file, source: page.canonical, exercise: page.number, sha256: createHash("sha256").update(page.html).digest("hex"), questions: exercises.find(exercise => exercise.number === page.number)!.questions.length })) });
  }
  const report = { topics: tests.length, exercises: tests.flatMap(test => test.exercises).length, answers: tests.flatMap(test => test.exercises.flatMap(exercise => exercise.questions)).length, illustrations: imageSources.length };
  if (report.topics !== 36 || report.exercises !== 111) throw new Error("Unexpected A1 catalog totals");
  if (apply) {
    saveSource("src/lib/tests/a1-grammar-tests.ts", 'import type { TestCatalogEntry } from "./types";\n\n/** Inert A1 tasks from user-provided HTML; answer keys remain server-only. */\nexport const A1_GRAMMAR_TESTS: TestCatalogEntry[] = ' + JSON.stringify(tests, null, 2) + ";\n");
    saveSource("docs/assets/a1-grammar-import.json", JSON.stringify({ source: "User-provided F:/TestEnglish/A1/Grammar", report, tests: provenance, illustrations: imageSources, answerKeys: "Independently reviewed grammar answers, kept server-side", legacyAssignments: "Existing definitions/results are untouched; adjectives publishes version 2 with its new third exercise" }, null, 2) + "\n");
  }
  console.log(JSON.stringify(report));
}
void main();
