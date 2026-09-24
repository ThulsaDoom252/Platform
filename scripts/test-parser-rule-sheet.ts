import assert from "node:assert/strict";
import { parseRuleText } from "../src/lib/rule-parser";

const input = `REMEMBER І FORGET
Infinitive та gerund без плутанини
НАЙПРОСТІШЕ ГОЛОВНА ІДЕЯ: форма показує порядок двох подій.
TO + V = дію ще треба зробити\tV ING = дія вже відбулася
1ПОДИВИМСЯ НА ПОРЯДОК ПОДІЙ
ПЕРША ПОДІЯ\tДРУГА ПОДІЯ\tЛОГІКА
REMEMBER FORGET\tTO + V\tСпочатку згадуємо, потім виконуємо.
V ING\tREMEMBER FORGET\tСпочатку дія, потім спогад.
2 REMEMBER TO DO
REMEMBER + TO + V = не забути зробити потрібну дію.
ПРИКЛАД\tРЕЗУЛЬТАТ
Remember to call Anna.\tНе забудь зателефонувати Анні.
3 REMEMBER DOING
REMEMBER + V ING = пам'ятати минулу дію.
4 REMEMBER У ДВОХ СХОЖИХ РЕЧЕННЯХ
5 FORGET TO DO
FORGET + TO + V = забути зробити потрібну дію.
6 FORGET DOING
FORGET + V ING = забути минулу дію.
7 УСІ ЧОТИРИ ФОРМИ В ОДНІЙ ТАБЛИЦІ
ФОРМА\tЗНАЧЕННЯ\tЧАСОВА ЛОГІКА
remember to do\tзгадати про завдання\tдія після згадування
8 ТИПОВІ ПОМИЛКИ
✗ I forgot calling her. ✓ I forgot to call her.
МІНІ ПЕРЕВІРКА
Постав дієслово у формі to + V або V ing.
1. Remember ___ the lights. turn off
2. I remember ___ this song. sing
ВІДПОВІДІ 1 to turn off · 2 singing`;

const parsed = parseRuleText(input);

assert.equal(parsed.format, "structured-study-sheet");
assert.equal(parsed.title, "REMEMBER | FORGET");
assert.equal(parsed.subtitle, "Infinitive та gerund без плутанини");
assert(parsed.blocks.some((block) => block.variant === "sheet-lead"));
assert(parsed.blocks.some((block) => block.variant === "sheet-formula-grid"));
assert(parsed.blocks.some((block) => block.variant === "sheet-section"));
assert(parsed.blocks.some((block) => block.variant === "sheet-formula"));
assert(parsed.blocks.some((block) => block.variant === "sheet-table"));
assert(parsed.blocks.some((block) => block.variant === "sheet-mistake"));
assert(parsed.blocks.some((block) => block.variant === "sheet-quiz"));
assert(parsed.blocks.some((block) => block.variant === "sheet-answers"));

const sectionTitles = parsed.blocks
  .filter((block) => block.type === "heading")
  .map((block) => block.text);
assert(sectionTitles.includes("1. ПОДИВИМСЯ НА ПОРЯДОК ПОДІЙ"));

console.log("structured rule-sheet parser: ok");
