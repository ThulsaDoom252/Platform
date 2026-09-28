import { test } from "node:test";
import assert from "node:assert/strict";
import {
  sortTree,
  sortInsideRoots,
  captureOrder,
  siblingsOf,
  DEFAULT_SORT,
  type SortableNode,
} from "../src/lib/tree-sort";

const node = (
  name: string,
  type: "FOLDER" | "FILE",
  createdAt: string,
  children: SortableNode[] = [],
): SortableNode => ({ id: name, name, icon: null, type, createdAt, children });

/** Дерево, в котором перемешаны папки и файлы, а имена идут не по порядку. */
const tree: SortableNode[] = [
  node("Яблоки", "FILE", "2026-01-03"),
  node("Rules", "FOLDER", "2026-01-05", [
    node("Zero", "FILE", "2026-02-02"),
    node("Articles", "FILE", "2026-02-01"),
    node("Tenses", "FOLDER", "2026-02-03"),
  ]),
  node("Activities", "FOLDER", "2026-01-01"),
  node("Бананы", "FILE", "2026-01-02"),
];

const names = (list: SortableNode[]) => list.map((n) => n.name);

test("папки всегда впереди файлов", () => {
  for (const mode of ["manual", "name-asc", "name-desc", "added-asc", "added-desc"] as const) {
    const out = sortTree(tree, mode);
    const types = out.map((n) => n.type);
    assert.deepEqual(
      types,
      ["FOLDER", "FOLDER", "FILE", "FILE"],
      `режим ${mode}: порядок групп нарушен`,
    );
  }
});

test("по умолчанию — папки по алфавиту, потом файлы", () => {
  const out = sortTree(tree, DEFAULT_SORT);
  assert.deepEqual(names(out), ["Activities", "Rules", "Бананы", "Яблоки"]);
});

test("алфавит разворачивается", () => {
  assert.deepEqual(names(sortTree(tree, "name-desc")), [
    "Rules",
    "Activities",
    "Яблоки",
    "Бананы",
  ]);
});

test("порядок добавления считается по времени создания", () => {
  assert.deepEqual(names(sortTree(tree, "added-asc")), [
    "Activities",
    "Rules",
    "Бананы",
    "Яблоки",
  ]);
  assert.deepEqual(names(sortTree(tree, "added-desc")), [
    "Rules",
    "Activities",
    "Яблоки",
    "Бананы",
  ]);
});

test("сортировка идёт вглубь", () => {
  const out = sortTree(tree, "name-asc");
  const rules = out.find((n) => n.name === "Rules");
  assert.ok(rules);
  assert.deepEqual(names(rules.children), ["Tenses", "Articles", "Zero"]);
});

test("свой порядок не трогает ничего, кроме групп", () => {
  const out = sortTree(tree, "manual");
  assert.deepEqual(names(out), ["Rules", "Activities", "Яблоки", "Бананы"]);
});

test("сохранённая расстановка сильнее режима", () => {
  const preset = captureOrder(sortTree(tree, "name-desc"));
  const out = sortTree(tree, "name-asc", preset);
  assert.deepEqual(names(out), ["Rules", "Activities", "Яблоки", "Бананы"]);
});

test("незнакомые узлы встают после известных", () => {
  const preset = { Activities: 0 };
  const out = sortTree(tree, "name-asc", preset);
  assert.equal(out[0].name, "Activities");
  // Остальные папки идут следом, файлы — после всех папок.
  assert.deepEqual(out.map((n) => n.type), ["FOLDER", "FOLDER", "FILE", "FILE"]);
});

test("исходное дерево не меняется", () => {
  const before = JSON.stringify(tree);
  sortTree(tree, "name-desc");
  assert.equal(JSON.stringify(tree), before);
});

test("главные разделы сортировка не трогает", () => {
  for (const mode of ["name-asc", "name-desc", "added-asc", "added-desc"] as const) {
    const out = sortInsideRoots(tree, mode);
    assert.deepEqual(
      names(out),
      names(tree),
      `режим ${mode}: верхний уровень переставился`,
    );
  }
});

test("внутри главных разделов порядок всё равно меняется", () => {
  const out = sortInsideRoots(tree, "name-asc");
  const rules = out.find((n) => n.name === "Rules");
  assert.ok(rules);
  assert.deepEqual(names(rules.children), ["Tenses", "Articles", "Zero"]);
});

test("расстановка не запоминает верхний уровень", () => {
  const order = captureOrder(sortInsideRoots(tree, "name-asc"));
  for (const root of tree) {
    assert.ok(!(root.id in order), `${root.name} попал в расстановку`);
  }
  assert.ok("Tenses" in order, "вложенные узлы должны сохраняться");
});

test("соседи берутся в том порядке, что на экране", () => {
  /*
   * Ради этого порядок и передаётся вместе с переносом: учитель кладёт
   * файл «после вот этого», глядя на отсортированный список, а в базе
   * порядок другой и та же команда означала бы другое место.
   */
  const tree = [
    node("root", "FOLDER", "2026-01-01", [
      node("b", "FILE", "2026-01-01"),
      node("a", "FILE", "2026-01-02"),
      node("c", "FILE", "2026-01-03"),
    ]),
  ];

  assert.deepEqual(siblingsOf(tree, "a"), ["b", "a", "c"]);
  assert.deepEqual(siblingsOf(tree, "c"), ["b", "a", "c"]);
});

test("у корневого раздела соседей не спрашиваем", () => {
  // Расстановка верхнего уровня не меняется — там и переставлять нечего.
  const tree = [node("root", "FOLDER", "2026-01-01", [node("a", "FILE", "2026-01-01")])];
  assert.deepEqual(siblingsOf(tree, "root"), []);
});

test("соседи находятся на любой глубине", () => {
  const tree = [
    node("root", "FOLDER", "2026-01-01", [
      node("mid", "FOLDER", "2026-01-01", [
        node("x", "FILE", "2026-01-01"),
        node("y", "FILE", "2026-01-02"),
      ]),
    ]),
  ];
  assert.deepEqual(siblingsOf(tree, "y"), ["x", "y"]);
});

test("неизвестный узел даёт пустой список", () => {
  const tree = [node("root", "FOLDER", "2026-01-01", [node("a", "FILE", "2026-01-01")])];
  assert.deepEqual(siblingsOf(tree, "нет-такого"), []);
});
