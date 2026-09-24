/**
 * Проверка чистки выгрузки Google Docs на «тяжёлом» документе.
 * Запуск: npx tsx scripts/test-docs-export.ts
 */
import { headingsOnly, stripHeavy } from "../src/lib/docs-export";

const mb = (s: string) => (s.length / 1048576).toFixed(1) + " МБ";
const kb = (s: string) => (s.length / 1024).toFixed(1) + " КБ";

// Так выглядит настоящая выгрузка: заголовки со span-ами внутри,
// абзацы текста и картинки, вшитые прямо в разметку.
const picture = `<img src="data:image/png;base64,${"iVBORw0KGgo".repeat(180_000)}" style="width:600px">`;

const doc =
  `<html><head><style>.c1{margin-left:36pt}.c2{font-weight:700}</style></head><body>` +
  `<h1 class="c5"><span class="c2">✅ Rules</span></h1>` +
  picture +
  `<p class="c1"><span>Длинный текст правила, в дерево он попасть не должен.</span></p>` +
  `<h2 class="c7"><span class="c2">🕐 Tenses</span></h2>` +
  `<h3><span>Present Simple</span></h3>` +
  picture +
  `<h3><span>Past Simple</span></h3>` +
  `<h1><span>📚 Vocabulary</span></h1>` +
  `<h2><span>Food</span></h2>` +
  `<script>var x = 1;</script>` +
  `</body></html>`;

console.log("выгрузка целиком:", mb(doc));

const stripped = stripHeavy(doc);
console.log("после выкидывания картинок:", kb(stripped));
console.log("картинок не осталось:", !/<img|data:image/i.test(stripped));
console.log("скриптов не осталось:", !/<script/i.test(stripped));

const slim = headingsOnly(stripped);
console.log("только заголовки:", slim ? kb(slim) : "нет заголовков");
console.log("---");
console.log(slim);

// Документ без заголовков — огрызок строить не из чего.
const noHeadings = `<body><ul><li>Vocabulary<ul><li>Food</li></ul></li></ul></body>`;
console.log("---");
console.log("без заголовков вернулся null:", headingsOnly(noHeadings) === null);
