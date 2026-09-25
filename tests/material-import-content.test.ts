import assert from "node:assert/strict";
import test from "node:test";
import { parseImportedFileContent } from "../src/lib/material-import-content";
import {
  mergeImportTrees,
  prepareImportContentPayload,
  type ImportNode,
} from "../src/lib/tree-import";

test("nearest vocabulary folder wins over a Rules root", () => {
  const result = parseImportedFileContent(
    "remember /rɪˈmem.bər/ — пам’ятати\nrecall /rɪˈkɔːl/ — пригадувати",
    ["Rules", "Lexic", "Remember vs recall"],
    "MATERIAL",
  );
  assert.equal("kind" in result ? result.kind : null, "VOCAB");
});

test("a grammar branch is parsed as rule blocks", () => {
  const result = parseImportedFileContent(
    "PRESENT PERFECT\nhave + V3\nI have finished. — Я закінчив.",
    ["Rules", "Tenses", "Present Perfect"],
    "MATERIAL",
  );
  assert.equal("kind" in result ? result.kind : null, "RULE");
});

test("content is omitted entirely when the option is off", () => {
  const nodes: ImportNode[] = [
    { name: "Food", icon: null, kind: "FILE", children: [], content: "apple — яблуко" },
  ];
  assert.equal(prepareImportContentPayload(nodes, false).nodes[0]?.content, null);
});

test("payload limit never sends a chopped file", () => {
  const nodes: ImportNode[] = [
    { name: "One", icon: null, kind: "FILE", children: [], content: "12345" },
    { name: "Two", icon: null, kind: "FILE", children: [], content: "67890" },
  ];
  const result = prepareImportContentPayload(nodes, true, 7);
  assert.equal(result.nodes[0]?.content, "12345");
  assert.equal(result.nodes[1]?.content, null);
  assert.equal(result.omitted, 1);
});

test("payload limit counts UTF-8 bytes, not JavaScript characters", () => {
  const nodes: ImportNode[] = [
    { name: "Українська", icon: null, kind: "FILE", children: [], content: "слово" },
  ];
  const result = prepareImportContentPayload(nodes, true, 5);
  assert.equal(result.nodes[0]?.content, null);
  assert.equal(result.omitted, 1);
});

test("same-named files merge their text and receive a count marker", () => {
  const first: ImportNode = {
    name: "Health",
    icon: null,
    kind: "FILE",
    children: [],
    content: "fever — температура",
  };
  const second: ImportNode = {
    name: " health ",
    icon: null,
    kind: "FILE",
    children: [],
    content: "rash — висип",
  };

  const [merged] = mergeImportTrees([first], [second]);
  assert.equal(merged.mergeCount, 2);
  assert.equal(merged.content, "fever — температура\n\nrash — висип");
});

test("same-named folders merge without a file-count marker", () => {
  const folder = (child: string): ImportNode => ({
    name: "Vocabulary",
    icon: null,
    kind: "FOLDER",
    children: [{ name: child, icon: null, kind: "FILE", children: [] }],
  });

  const [merged] = mergeImportTrees([folder("Food")], [folder("Health")]);
  assert.equal(merged.mergeCount, undefined);
  assert.deepEqual(merged.children.map((node) => node.name), ["Food", "Health"]);
});
