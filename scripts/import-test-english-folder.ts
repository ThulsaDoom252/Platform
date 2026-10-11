import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { parseTestEnglishExercise } from "./lib/test-english-html";
import type { TestCatalogEntry } from "../src/lib/tests/types";

const definitions = [
  ["a1-to-be", "A1/Grammar/Am is are", "Present simple: to be", "Am, is, are · statements, negatives & questions", 4],
  ["a1-a-an-plurals", "A1/Grammar/a vs an. Singualar and plural forms", "A/an & plurals", "Singular and plural forms", 3],
  ["a1-demonstratives", "A1/Grammar/Demonstrative pronouns", "This, that, these, those", "Demonstrative pronouns · near & far", 3],
  ["a1-possessives", "A1/Grammar/Possesive adjectives vs subject pronouns", "Possessive adjectives & pronouns", "I/my, you/your · subjects & possession", 3],
  ["a1-adjectives", "A1/Grammar/Adjectives  (basics)", "Adjectives: the basics", "Old, interesting, expensive · adjective order", 3],
  ["third-conditional", "B1/Grammar/Third conditional Past unreal situations", "Third conditional", "Past unreal situations", 3],
] as const;
const input = process.argv[2];
if (!input) throw new Error("Usage: npx tsx scripts/import-test-english-folder.ts <source-folder> [--apply]");
const tests: TestCatalogEntry[] = [];
const sources: { id: string; pages: { file: string; sha256: string; exercise: number; questions: number }[]; missing: number[] }[] = [];
for (const [id, folder, title, subtitle, expected] of definitions) {
  const files = readdirSync(join(input, folder)).filter((file) => file.endsWith(".html"));
  const pages = files.map((file) => ({ file, number: Number(file.match(/ - Page (\d+) of \d+ - /)?.[1] ?? 1) })).sort((a, b) => a.number - b.number);
  if (new Set(pages.map((page) => page.number)).size !== pages.length || pages.some((page) => page.number < 1 || page.number > expected)) throw new Error(`Duplicate or unexpected pages: ${id}`);
  const sourcePages: (typeof sources)[number]["pages"] = [];
  const exercises = pages.map(({ file, number }) => {
    const html = readFileSync(join(input, folder, file), "utf8"), exercise = parseTestEnglishExercise(html, number);
    sourcePages.push({ file: `${folder}/${file}`, sha256: createHash("sha256").update(html).digest("hex"), exercise: number, questions: exercise.questions.length });
    return exercise;
  });
  tests.push({ id, version: 1, level: id === "third-conditional" ? "b1" : "a1", category: "grammar", title, subtitle,
    cover: { src: `/images/tests/${id}-v1.webp`, width: 1200, height: 600, alt: `${id === "third-conditional" ? "B1" : "A1"} Grammar: ${title}` }, exercises });
  sources.push({ id, pages: sourcePages, missing: Array.from({ length: expected }, (_, index) => index + 1).filter((number) => !pages.some((page) => page.number === number)) });
}
console.log(JSON.stringify(sources.map((source) => ({ id: source.id, exercises: source.pages.length, questions: source.pages.reduce((sum, page) => sum + page.questions, 0), missing: source.missing })), null, 2));
if (process.argv.includes("--apply")) {
  const outputs = {
    "src/lib/tests/folder-tests.ts": `import type { TestCatalogEntry } from "./types";\n\n/** Inert public content imported from the user's saved HTML; no answers or scripts. */\nexport const FOLDER_TESTS: TestCatalogEntry[] = ${JSON.stringify(tests, null, 2)};\n`,
    "docs/assets/test-english-folder-import.json": JSON.stringify({ source: "User-provided TestEnglish folder", answerKeys: "Reviewed independently: saved HTML contains tasks/options but no answer keys", tests: sources }, null, 2) + "\n",
  };
  // Use the normal patch tool, never shell redirection, to save imported source.
  const exe = process.env.CODEX_PATCH_EXE;
  if (!exe) throw new Error("Set CODEX_PATCH_EXE to the available Codex apply-patch executable");
  // Windows limits command-line length. Append bounded, line-aligned patch chunks.
  for (const [file, value] of Object.entries(outputs)) {
    const lines = value.trimEnd().split("\n");
    let offset = 0;
    while (offset < lines.length) {
      const previous = offset ? lines[offset - 1] : null;
      const chunk: string[] = [];
      let length = 0;
      while (offset < lines.length && length + lines[offset].length < 12000) { length += lines[offset].length + 2; chunk.push(lines[offset++]); }
      if (!chunk.length) throw new Error("Import line exceeds safe patch length");
      const patch = `*** Begin Patch\n*** ${previous === null ? "Add" : "Update"} File: ${file}\n${previous === null ? "" : "@@\n " + previous + "\n"}${chunk.map((line) => "+" + line).join("\n")}\n${previous === null ? "" : "*** End of File\n"}*** End Patch\n`;
      const result = spawnSync(exe, ["--codex-run-as-apply-patch", patch], { stdio: "inherit" });
      if (result.status !== 0) throw new Error("Could not apply imported content");
    }
  }
}
