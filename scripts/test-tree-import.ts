/**
 * Проверка разбора структуры: отступы, заголовки Google Docs, списки.
 * Запуск: npx tsx scripts/test-tree-import.ts
 */
import { parseTree, type ImportNode } from "../src/lib/tree-import";

function draw(nodes: ImportNode[], depth = 0): string {
  return nodes
    .map(
      (n) =>
        `${"  ".repeat(depth)}${n.kind === "FOLDER" ? "▸" : "·"} ${n.icon ?? "—"} ${n.name}\n` +
        draw(n.children, depth + 1),
    )
    .join("");
}

function run(title: string, input: { html?: string; text?: string }) {
  // Разбор HTML опирается на DOMParser, которого в Node нет, — такие
  // случаи проверяются в браузере, вставкой в само окно импорта.
  if (input.html && typeof DOMParser === "undefined") {
    console.log(`\n=== ${title} — только в браузере, пропуск`);
    return;
  }
  const res = parseTree(input);
  console.log(`\n=== ${title} — узлов: ${res.count}${res.flat ? ", ПЛОСКО" : ""}`);
  process.stdout.write(draw(res.nodes));
}

// 1. Ровно то дерево, что на скриншоте: отступами.
run("отступы", {
  text: `
📚 Vocabulary
✅ Rules
    👮 Must vs have to
    🔨 Conditionals
    📝 Infinitive vs Gerund
    💬 Words & phrases
    🕐 Tenses
    🔤 Grammar
    📕 Constructions
💥 Activities
🚀 Tests
`,
});

// 2. Со стрелками-раскрывашками, как их видно на скриншоте.
run("со стрелками", {
  text: `
▶ 📚 Vocabulary
▼ ✅ Rules
  · 👮 Must vs have to
  ▶ 🔨 Conditionals
▶ 💥 Activities
`,
});

// 3. Вставка из Google Docs: заголовки H1/H2/H3.
run("заголовки Docs", {
  html: `<meta charset="utf-8">
    <h1>✅ Rules</h1>
    <p>какой-то текст правила, он в дерево не идёт</p>
    <h2>🕐 Tenses</h2>
    <h3>Present Simple</h3>
    <h3>Past Simple</h3>
    <h2>🔨 Conditionals</h2>
    <h3>First conditional</h3>
    <h1>📚 Vocabulary</h1>
    <h2>Food</h2>`,
});

// 4. Маркированный список с вложенностью.
run("список", {
  html: `<ul>
      <li>📚 Vocabulary
        <ul><li>Food</li><li>Travel</li></ul>
      </li>
      <li>🚀 Tests</li>
    </ul>`,
});

// 5. Без эмодзи — значок должен подобраться сам.
run("без эмодзи", {
  text: `Grammar
  Tenses
  Words
Tests`,
});

// 6. Плоский список — должен честно сказать, что вложенности нет.
run("плоский", { text: `Vocabulary\nRules\nTests` });

// 7. Составные значки не должны разваливаться на половинки.
run("составные значки", {
  text: `👮‍♂️ Полицейский
🇬🇧 British English
👨‍👩‍👧 Family
👍🏽 Thumbs`,
});
