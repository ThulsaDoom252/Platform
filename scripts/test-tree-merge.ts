import assert from "node:assert/strict";
import { mergeImportTrees, type ImportNode } from "../src/lib/tree-import";

const file = (name: string, icon: string | null = null): ImportNode => ({
  name,
  icon,
  kind: "FILE",
  children: [],
});
const folder = (
  name: string,
  children: ImportNode[],
  icon: string | null = null,
): ImportNode => ({ name, icon, kind: "FOLDER", children });

const first = [
  folder("Vocabulary", [folder("Idioms", [file("Weather")]), file("Cities")], "📚"),
  folder("Rules", [file("Conditionals")], "✅"),
];
const second = [
  folder(" vocabulary ", [folder("Idioms", [file("Business")]), file("Travel")]),
  folder("Lexic", [file("Linking words")]),
];
const third = [
  folder("Vocabulary", [folder("IDIOMS", [file("Weather"), file("Work")])]),
  folder("Rules", [file("Passive voice")]),
];

const merged = mergeImportTrees(first, second, third);

assert.deepEqual(merged.map((node) => node.name), ["Vocabulary", "Rules", "Lexic"]);
assert.equal(merged[0].icon, "📚");
assert.deepEqual(merged[0].children.map((node) => node.name), ["Idioms", "Cities", "Travel"]);
assert.deepEqual(merged[0].children[0].children.map((node) => node.name), [
  "Weather",
  "Business",
  "Work",
]);
assert.equal(merged[0].children[0].children[0].mergeCount, 2);
assert.deepEqual(merged[1].children.map((node) => node.name), [
  "Conditionals",
  "Passive voice",
]);

// Файл с тем же именем становится папкой, если в другом документе у него есть дети.
const promoted = mergeImportTrees(
  [file("Grammar")],
  [folder("grammar", [file("Tenses")], "🔤")],
);
assert.equal(promoted.length, 1);
assert.equal(promoted[0].kind, "FOLDER");
assert.equal(promoted[0].icon, "🔤");
assert.equal(promoted[0].children[0].name, "Tenses");

console.log("multi-document tree merge: ok");
