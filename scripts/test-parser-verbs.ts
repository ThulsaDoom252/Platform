/**
 * Разбор неправильных глаголов на всех известных формах вставки.
 * Запуск: npx tsx scripts/test-parser-verbs.ts
 */
import { parseIrregularVerbs } from "../src/lib/verbs-parser";
import * as fx from "./fixtures/irregular-verbs";

function check(ok: unknown, what: string) {
  if (!ok) throw new Error(`не сошлось: ${what}`);
}

function show(name: string, raw: string, expected: number) {
  const { verbs, title, warnings } = parseIrregularVerbs(raw);
  console.log(`\n=== ${name}: ${verbs.length} глаголов${title ? `, заголовок «${title}»` : ""}`);
  if (warnings.length) console.log(`    предупреждения: ${warnings.join("; ")}`);

  for (const v of verbs.slice(0, 3)) {
    const ipa = (s: string | null) => (s ? ` ${s}` : "");
    console.log(
      `    ${v.icon ?? " "} ${v.base}${ipa(v.baseIpa)} → ${v.past}${ipa(v.pastIpa)} → ` +
        `${v.participle}${ipa(v.participleIpa)} — ${v.translation ?? "?"}`,
    );
  }
  if (verbs.length > 3) console.log(`    …ещё ${verbs.length - 3}`);

  check(verbs.length === expected, `${name}: ${expected} глаголов, а не ${verbs.length}`);
  check(warnings.length === 0, `${name}: без предупреждений (${warnings.join("; ")})`);
  return verbs;
}

const inline = show("транскрипция в ячейке", fx.withInlineIpa, 7);
check(inline[0].base === "buy" && inline[0].baseIpa === "/baɪ/", "buy отделён от транскрипции");
check(inline[0].icon === "🛒", "значок взят из первой колонки, а не динамик");
check(inline[0].translation === "купувати", "перевод на месте");
check(inline[4].participle === "forgotten", "третья форма forgotten");

const grouped = show("с названием группы", fx.withGroupTitle, 8);
check(grouped[0].base === "freeze", "первый глагол freeze");
check(
  parseIrregularVerbs(fx.withGroupTitle).title?.startsWith("GROUP 2"),
  "название группы подхвачено",
);

const plain = show("без транскрипции", fx.withoutIpa, 8);
check(plain[0].base === "swear" && plain[0].baseIpa === null, "swear без транскрипции");
check(plain[0].icon === null, "динамик не стал значком");

const speakerCol = show("колонка с динамиком", fx.withSpeakerColumn, 11);
check(speakerCol[0].base === "dream (of/about)", "скобки сохранены");
check(speakerCol[1].past === "dealt", "вторая форма dealt");
check(speakerCol[7].base === "read" && speakerCol[7].past === "read", "три одинаковых read");

const perLine = show("по ячейке на строку", fx.cellPerLine, 5);
check(perLine[0].base === "smell", "smell найден");
check(perLine[0].past === "smelt / smelled", "два варианта второй формы");
check(perLine[4].translation === "надсилати / відправляти", "перевод последнего");

const below = show("транскрипция под формой", fx.ipaBelowForm, 3);
check(below[0].base === "begin" && below[0].baseIpa === "/bɪˈɡɪn/", "begin с транскрипцией");
check(below[0].pastIpa === "/bɪˈɡæn/", "транскрипция второй формы");
check(below[0].participleIpa === "/bɪˈɡʌn/", "транскрипция третьей формы");

const wrapped = show("шапка в две строки", fx.wrappedHeader, 3);
check(wrapped[0].base === "understand", "understand не съеден шапкой");
check(wrapped[2].participle === "taken", "taken на месте");

const everyForm = show("динамик у каждой формы", fx.speakerOnEveryForm, 3);
check(everyForm[0].base === "lose" && everyForm[0].baseIpa === "/luːz/", "lose с транскрипцией");
check(everyForm[0].past === "lost" && everyForm[0].pastIpa === "/lɒst/", "динамик не помешал");
check(everyForm[2].translation === "продавать", "перевод sell");

console.log("\nразбор глаголов: OK");
