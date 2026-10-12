import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";
import React from "react";
import * as jsxRuntime from "react/jsx-runtime";
import { renderToStaticMarkup } from "react-dom/server";
import { en } from "../src/lib/i18n/en";
import { ru } from "../src/lib/i18n/ru";
import { uk } from "../src/lib/i18n/uk";
import { fmt } from "../src/lib/i18n";
import * as homeworkOrder from "../src/lib/teacher-homework-order";

function compile(source: string, require: (name: string) => unknown) {
  const exports: Record<string, unknown> = {};
  const js = ts.transpileModule(source, { compilerOptions: {
    jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
  } }).outputText;
  vm.runInNewContext(js, { exports, require, Intl, console });
  return exports;
}

const Link = ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) => React.createElement("a", props, children);
const Icon = () => React.createElement("svg", { "aria-hidden": true });
const room = readFileSync("src/components/class/class-room.tsx", "utf8");
const ast = ts.createSourceFile("class-room.tsx", room, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const candidates: string[] = [];
function visit(node: ts.Node) {
  if (ts.isJsxExpression(node)) {
    const text = node.getText(ast);
    if (text.startsWith("{teacher && partner && (") && text.includes('href={`/teacher/homeworks?student=')) candidates.push(text);
  }
  ts.forEachChild(node, visit);
}
visit(ast);
assert.equal(candidates.length, 1, "class header must expose one teacher-only student shortcut");
const shortcutModule = compile(`import Link from 'next/link'; import {IconFile} from '@/components/icons'; import {fmt} from '@/lib/i18n';
export default function Shortcut({teacher,partner,t}) { return <>${candidates[0]}</>; }`, name => {
  if (name === "react/jsx-runtime") return jsxRuntime;
  if (name === "next/link") return { default: Link };
  if (name === "@/components/icons") return { IconFile: Icon };
  if (name === "@/lib/i18n") return { fmt };
  throw new Error(`Unexpected shortcut import: ${name}`);
});
const Shortcut = shortcutModule.default as React.ComponentType<{ teacher: boolean; partner: { id: string; name: string; presence: string } | null; t: typeof en }>;

test("teacher shortcut opens the selected student's homework, even while offline", () => {
  const html = renderToStaticMarkup(React.createElement(Shortcut, {
    teacher: true, partner: { id: "student & other?", name: "Illya", presence: "offline" }, t: en,
  }));
  assert.ok(html.includes('href="/teacher/homeworks?student=student%20%26%20other%3F"'));
  assert.ok(html.includes("All homework — Illya"));
  assert.ok(html.includes("Homework"));
  assert.ok(!html.includes("disabled"));
});

test("shortcut is not shown to students or before selecting a class partner", () => {
  assert.equal(renderToStaticMarkup(React.createElement(Shortcut, { teacher: false, partner: { id: "teacher", name: "Vlad", presence: "online" }, t: en })), "");
  assert.equal(renderToStaticMarkup(React.createElement(Shortcut, { teacher: true, partner: null, t: en })), "");
});

test("homework shortcut has localized text and an accessible student-specific label", () => {
  for (const t of [en, ru, uk]) {
    const html = renderToStaticMarkup(React.createElement(Shortcut, { teacher: true, partner: { id: "a", name: "Illya", presence: "offline" }, t }));
    assert.ok(html.includes(t.classRoom.studentHomework));
    assert.ok(html.includes(`aria-label="${fmt(t.classRoom.studentHomeworkTitle, { name: "Illya" })}"`));
  }
});

const items = [
  { id: "a-first", title: "First homework", studentId: "a", studentName: "Alla" },
  { id: "a-second", title: "Second homework", studentId: "a", studentName: "Alla" },
  { id: "b-other", title: "Other student homework", studentId: "b", studentName: "Bogdan" },
].map(row => ({ ...row, kind: "TEST", studentAvatarUrl: null, assignedAt: "2026-10-12T12:00:00.000Z", nextLessonAt: null,
  submittedAt: null, reviewedAt: null, started: false }));

const pageModule = compile(readFileSync("src/app/teacher/homeworks/page.tsx", "utf8"), name => {
  if (name === "react/jsx-runtime") return jsxRuntime;
  if (name === "next/link") return { default: Link };
  if (name === "next/navigation") return { notFound: () => { throw new Error("NOT_FOUND"); } };
  if (name === "@/lib/teacher-homework-order") return homeworkOrder;
  if (name === "@/lib/actions/lesson-homework") return { teacherHomeworkAssignmentsAction: async () => [] };
  if (name === "@/lib/actions/word-deck") return { teacherWordDeckHomeworkAssignmentsAction: async () => [],
    listWordDeckStudentsAction: async () => [{ id: "a", name: "Alla" }, { id: "b", name: "Bogdan" }, { id: "empty", name: "Empty Student" }] };
  if (name === "@/lib/actions/revision") return { teacherRevisionHomeworkAssignmentsAction: async () => [] };
  if (name === "@/lib/actions/tests") return { testHomeworkCardsAction: async () => items };
  if (name === "@/lib/i18n/server") return { getDict: async () => ({ t: en, locale: "en" }) };
  if (name === "@/lib/session") return { getSession: async () => ({ userId: "teacher", role: "TEACHER" }) };
  if (name === "@/lib/schedule-time") return { SCHOOL_TIME_ZONE: "UTC", SCHEDULE_FORMAT_TIME_ZONE: "UTC" };
  if (name === "@/lib/utils") return { cn: (...values: unknown[]) => values.filter(Boolean).join(" ") };
  if (name === "@/components/icons") return new Proxy({}, { get: () => Icon });
  if (name === "@/components/teacher/homework-source-assigner") return { HomeworkSourceAssigner: ({ studentId }: { studentId: string }) => React.createElement("div", { "data-assigner-student": studentId }) };
  if (name === "@/components/tests/test-assignment-card") return { TestAssignmentCard: ({ item }: { item: typeof items[number] }) => React.createElement("article", { "data-homework": item.id }, item.title) };
  if (name === "@/components/teacher/homework-grouped-list") return { HomeworkGroupedList: ({ cards }: { cards: { id: string; card: React.ReactNode }[] }) => React.createElement("div", null, cards.map(card => React.createElement(React.Fragment, { key: card.id }, card.card))) };
  if (name === "@/components/teacher/homework-sorted-folders") return { HomeworkSortedFolders: ({ folders }: { folders: { studentId: string; card: React.ReactNode }[] }) => React.createElement("div", null, folders.map(folder => React.createElement(React.Fragment, { key: folder.studentId }, folder.card))) };
  if (name.startsWith("@/components/")) return new Proxy({}, { get: () => ({ children }: React.PropsWithChildren) => React.createElement(React.Fragment, null, children) });
  if (name === "@/lib/homework-feedback") return {};
  throw new Error(`Unexpected homework page import: ${name}`);
});
const Page = pageModule.default as (props: { searchParams: Promise<{ student?: string }> }) => Promise<React.ReactElement>;

test("direct student folder includes all of that student's homework, and no other student's assignments", async () => {
  const html = renderToStaticMarkup(await Page({ searchParams: Promise.resolve({ student: "a" }) }));
  assert.ok(html.includes('data-homework="a-first"'));
  assert.ok(html.includes('data-homework="a-second"'));
  assert.ok(!html.includes("Other student homework"));
  assert.ok(!html.includes("Bogdan"));
  assert.ok(html.includes('data-assigner-student="a"'));
});

test("an existing student without homework gets an empty personal folder, not all other folders", async () => {
  const html = renderToStaticMarkup(await Page({ searchParams: Promise.resolve({ student: "empty" }) }));
  assert.ok(html.includes("Empty Student"));
  assert.ok(html.includes(en.teacherHomeworks.empty));
  assert.ok(html.includes('data-assigner-student="empty"'));
  assert.ok(!html.includes("Alla"));
  assert.ok(!html.includes("Bogdan"));
  assert.ok(!html.includes("data-homework"));
});

test("a stale or invalid student shortcut returns not found instead of silently showing everyone's homework", async () => {
  await assert.rejects(Page({ searchParams: Promise.resolve({ student: "deleted-or-invalid" }) }), /NOT_FOUND/);
});

test("the main homework page still lists all student folders when no student is selected", async () => {
  const html = renderToStaticMarkup(await Page({ searchParams: Promise.resolve({}) }));
  assert.ok(html.includes("Alla"));
  assert.ok(html.includes("Bogdan"));
  assert.ok(html.includes("/teacher/homeworks?student=a"));
  assert.ok(html.includes("/teacher/homeworks?student=b"));
});
