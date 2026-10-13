import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import * as protect from "../src/lib/protect-terms";
import type { LearningSegment } from "../src/lib/learning-language-content";

function translator(fetch: typeof globalThis.fetch) {
  const exports = {};
  const code = ts.transpileModule(readFileSync("src/lib/material-translation.ts", "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  runInNewContext(code, { exports, require: (name: string) => name === "server-only" ? {} : name === "@/lib/protect-terms" ? protect : assert.fail(`Unexpected import ${name}`), fetch, AbortSignal, process: { env: { DEEPL_AUTH_KEY: "test-only:fx" } } });
  return exports as typeof import("../src/lib/material-translation");
}
test("the actual DeepL adapter bounds batches and bytes, keeps source groups and output order", async () => {
  const calls: { text: string[]; source_lang: string; target_lang: string; context: string }[] = [];
  const api = translator(async (_input, options) => {
    const body = String(options!.body); assert.ok(Buffer.byteLength(body) < 128 * 1024);
    const payload = JSON.parse(body); calls.push(payload); assert.ok(payload.text.length <= 50);
    return new Response(JSON.stringify({ translations: payload.text.map((text: string) => ({ text: "Переклад " + text })) }), { status: 200 });
  });
  const segments: LearningSegment[] = Array.from({ length: 110 }, (_, i) => ({ text: `english-${i} ` + "text ".repeat(100), source: "EN", context: "English learning item" }));
  segments.splice(20, 0, { text: "Используй don't после подлежащего", source: "RU", context: "Grammar explanation" });
  const result = await api.translateLearningSegments(segments, "UK");
  assert.equal(result.length, segments.length); assert.ok(calls.length >= 4);
  segments.forEach((segment, i) => assert.ok(result[i].endsWith(segment.text.trim())));
  assert.ok(calls.some(call => call.source_lang === "RU")); assert.ok(calls.every(call => call.target_lang === "UK"));
});
test("mixed Cyrillic explanations preserve English grammar terms through XML round trips", async () => {
  const api = translator(async (_input, options) => {
    const payload = JSON.parse(String(options!.body));
    assert.equal(payload.tag_handling, "xml"); assert.deepEqual(payload.ignore_tags, ["k"]);
    assert.ok(payload.text[0].includes("<k>Present Perfect</k>"));
    assert.ok(payload.text[0].includes("&amp;"));
    assert.doesNotMatch(payload.text[0], /&(?!(?:amp|lt|gt);)/, "DeepL v2 rejects malformed XML entities");
    return new Response(JSON.stringify({ translations: payload.text.map((text: string) => ({ text: text.replace("Используй", "Використовуй").replace("после", "після") })) }), { status: 200 });
  });
  const result = await api.translateLearningSegments([{ text: "Используй Present Perfect после already & just", source: "RU", context: "Grammar" }], "UK");
  assert.equal(result[0], "Використовуй Present Perfect після already & just");
  assert.ok(!result[0].includes("<k>"));
});

test("every string in a protected batch has valid XML escaping, even without English terms", async () => {
  const api = translator(async (_input, options) => {
    const payload = JSON.parse(String(options!.body));
    assert.equal(payload.tag_handling, "xml");
    for (const xml of payload.text) {
      assert.doesNotMatch(xml, /&(?!(?:amp|lt|gt);)/);
      assert.doesNotMatch(xml.replace(/<\/?k>/g, ""), /[<>]/);
    }
    return new Response(JSON.stringify({ translations: payload.text.map((text: string) => ({ text })) }), { status: 200 });
  });
  const values: LearningSegment[] = [
    { text: "Используй on <-> in & at.", source: "RU", context: "Grammar explanation" },
    { text: "Один < два & три > два", source: "RU", context: "Grammar explanation" },
    { text: "Буквальное &nbsp; и <b>word</b>", source: "RU", context: "Grammar explanation" },
  ];
  assert.deepEqual(await api.translateLearningSegments(values, "UK"), values.map(value => value.text));
});
test("quota failures and incomplete responses reject the batch instead of writing partial content", async () => {
  for (const response of [new Response("quota", { status: 456 }), new Response(JSON.stringify({ translations: [] }), { status: 200 })]) {
    const api = translator(async () => response);
    await assert.rejects(api.translateLearningSegments([{ text: "cat", source: "EN", context: "Vocabulary" }], "UK"), /лимит|неполный/);
  }
});
