import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dictionaries, type Locale } from "../src/lib/i18n";

/*
 * Счётная строка — это лист словаря, а не ветка: у русского в ней есть
 * «few» и «many», которых в английском нет, и сравнивать их формы между
 * языками бессмысленно.
 */
function isPlural(value: object): boolean {
  return "one" in value && "other" in value;
}

/** Все пути до строк словаря: "classRoom.leave", "stats.hintTotal" и т.д. */
function paths(value: unknown, prefix = ""): string[] {
  if (typeof value !== "object" || value === null) return [prefix];
  if (isPlural(value)) return [prefix];
  return Object.entries(value).flatMap(([key, inner]) =>
    paths(inner, prefix ? `${prefix}.${key}` : key),
  );
}

const locales = Object.keys(dictionaries) as Locale[];

test("во всех языках один и тот же набор ключей", () => {
  const reference = paths(dictionaries.en).sort();

  for (const locale of locales) {
    const own = paths(dictionaries[locale]).sort();
    assert.deepEqual(
      own,
      reference,
      `${locale}: набор ключей разошёлся с английским`,
    );
  }
});

test("ни один перевод не пустой", () => {
  for (const locale of locales) {
    for (const path of paths(dictionaries[locale])) {
      const value = path
        .split(".")
        .reduce<unknown>(
          (node, key) => (node as Record<string, unknown>)[key],
          dictionaries[locale],
        );

      // У счётной строки проверяем каждую форму: пустое «many» так же
      // ломает подпись, как и пустая обычная строка.
      const forms =
        typeof value === "object" && value !== null
          ? Object.values(value as Record<string, unknown>)
          : [value];

      for (const form of forms) {
        assert.equal(typeof form, "string", `${locale}.${path}: не строка`);
        assert.ok(String(form).trim(), `${locale}.${path}: пусто`);
      }
    }
  }
});

/*
 * Страницы ломались не отсутствием перевода, а тем, что компонент вовсе не
 * заглядывал в словарь: главная учителя и класс были целиком написаны
 * по-русски и не менялись вместе с языком пользователя. Ловим именно это —
 * кириллицу в коде, а не в комментариях.
 */
const LOCALIZED_FILES = [
  "src/app/teacher/page.tsx",
  "src/app/teacher/materials/page.tsx",
  "src/components/class/class-room.tsx",
  "src/components/class/class-chat.tsx",
  "src/components/class/quick-verbs.tsx",
  "src/components/class/class-script.tsx",
];

/** Убирает блочные комментарии и строки-комментарии — остаётся сам код. */
function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .filter((line) => !/^\s*(\/\/|\*)/.test(line))
    .join("\n");
}

test("в локализованных экранах нет зашитых русских надписей", () => {
  for (const file of LOCALIZED_FILES) {
    const code = stripComments(readFileSync(new URL(`../${file}`, import.meta.url), "utf8"));
    const lines = code.split("\n");

    const guilty = lines
      .map((line, i) => ({ line: line.trim(), no: i + 1 }))
      .filter((row) => /[А-Яа-яЁё]/.test(row.line));

    assert.deepEqual(
      guilty,
      [],
      `${file}: надпись живёт в коде, а не в словаре — ` +
        guilty.map((row) => `строка ${row.no}: ${row.line}`).join(" | "),
    );
  }
});
