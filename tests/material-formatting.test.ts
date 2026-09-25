import assert from "node:assert/strict";
import test from "node:test";
import {
  ruleHasFormattingIssue,
  vocabularyHasFormattingIssue,
} from "../src/lib/material-formatting";
import { parseMaterial } from "../src/lib/materials-parser";
import { parseRuleText } from "../src/lib/rule-parser";

const vocabularySource = [
  "🧪 Health",
  "🦠 epidemic /ˌep.ɪˈdem.ɪk/ — епідемія",
  "• The epidemic spread. — Епідемія поширилась.",
  "💡 outbreak /ˈaʊt.breɪk/ — спалах",
].join("\n");

test("a vocabulary that matches the current parser is clean", () => {
  const parsed = parseMaterial(vocabularySource, "vocabulary");
  assert.equal(vocabularyHasFormattingIssue(vocabularySource, parsed.phrases), false);
});

test("a formerly unparsed vocabulary row is reported", () => {
  const parsed = parseMaterial(vocabularySource, "vocabulary");
  const broken = parsed.phrases.map((phrase) => ({ ...phrase }));
  broken[1] = {
    ...broken[1],
    kind: "NOTE",
    phrase: "💡 outbreak /ˈaʊt.breɪk/ — спалах",
  };
  assert.equal(vocabularyHasFormattingIssue(vocabularySource, broken), true);
});

test("manual translation changes do not create a formatting warning", () => {
  const parsed = parseMaterial(vocabularySource, "vocabulary");
  const edited = parsed.phrases.map((phrase) => ({
    ...phrase,
    translation: phrase.translation ? `${phrase.translation} (уточнено)` : phrase.translation,
  }));
  assert.equal(vocabularyHasFormattingIssue(vocabularySource, edited), false);
});

test("exact duplicate records are reported even without a saved source", () => {
  const [phrase] = parseMaterial(vocabularySource, "vocabulary").phrases;
  assert.equal(vocabularyHasFormattingIssue(null, [phrase, { ...phrase }]), true);
});

test("a normal explanatory note with a dash is not a false positive", () => {
  assert.equal(
    vocabularyHasFormattingIssue(null, [
      {
        kind: "NOTE",
        phrase: "Зовнішній поштовх — людина або подія",
        transcription: null,
        translation: "Завжди є той, кому нагадують.",
        section: null,
        examples: [],
      },
    ]),
    false,
  );
});

test("rule scan compares structure rather than edited wording", () => {
  const source = "RULE\nUse have + V3.\nExample: I have finished. — Я закінчив.";
  const parsed = parseRuleText(source);
  const edited = parsed.blocks.map((block) =>
    block.type === "text" ? { ...block, text: `${block.text} Updated.` } : block,
  );
  assert.equal(ruleHasFormattingIssue(source, edited), false);
  assert.equal(ruleHasFormattingIssue(source, edited.slice(1)), true);
});
