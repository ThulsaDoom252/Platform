import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";
import React from "react";
import * as jsx from "react/jsx-runtime";
import { renderToStaticMarkup } from "react-dom/server";
import { en } from "../src/lib/i18n/en";
import { ru } from "../src/lib/i18n/ru";
import { uk } from "../src/lib/i18n/uk";
import { fmt } from "../src/lib/i18n";

type Element = React.ReactElement<Record<string, unknown>>;
const source = readFileSync("src/components/class/class-student-menu.tsx", "utf8");
const room = readFileSync("src/components/class/class-room.tsx", "utf8");
const Icon = () => React.createElement("svg", { "aria-hidden": true });
const Link = ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) => React.createElement("a", props, children);
const flatten = (tree: React.ReactNode): Element[] => !React.isValidElement(tree) ? []
  : [tree as Element, ...React.Children.toArray((tree.props as { children?: React.ReactNode }).children).flatMap(flatten)];

function harness(t = en) {
  let stateCursor = 0, refCursor = 0;
  const state: unknown[] = [];
  const refs: { current: unknown }[] = [];
  const effects: (() => void | (() => void))[] = [];
  const events = new Map<string, (event: Record<string, unknown>) => void>();
  const windowEvents = new Map<string, () => void>();
  const document = { body: {}, documentElement: { clientWidth: 360 }, activeElement: null as unknown,
    addEventListener: (key: string, handler: (event: Record<string, unknown>) => void) => events.set(key, handler),
    removeEventListener: (key: string) => events.delete(key),
  };
  const exports: Record<string, (props: Record<string, unknown>) => React.ReactNode> = {};
  const js = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  vm.runInNewContext(js, { exports, document,
    window: { innerHeight: 720, addEventListener: (key: string, handler: () => void) => windowEvents.set(key, handler), removeEventListener: (key: string) => windowEvents.delete(key) },
    requestAnimationFrame: (callback: () => void) => { callback(); return 1; }, cancelAnimationFrame() {},
    require: (name: string) => {
      if (name === "react/jsx-runtime") return jsx;
      if (name === "react") return {
        useState: (initial: unknown) => { const index = stateCursor++; if (!(index in state)) state[index] = initial;
          return [state[index], (value: unknown) => { state[index] = typeof value === "function" ? value(state[index]) : value; }]; },
        useRef: (value: unknown) => { const index = refCursor++; return refs[index] ?? (refs[index] = { current: value }); },
        useId: () => "student-actions", useCallback: (callback: unknown) => callback, useEffect: (effect: () => void) => effects.push(effect),
      };
      if (name === "react-dom") return { createPortal: (child: React.ReactNode) => child };
      if (name === "next/link") return { default: Link };
      if (name === "@/components/i18n-provider") return { useT: () => ({ t }) };
      if (name === "@/lib/i18n") return { fmt };
      if (name === "@/components/icons") return new Proxy({}, { get: () => Icon });
      if (name === "@/components/avatar") return { Avatar: ({ name }: { name: string }) => React.createElement("span", null, name[0]) };
      if (name === "@/components/student-presence") return { PresenceIndicator: () => React.createElement("i") };
      throw Error(`Unexpected import: ${name}`);
    },
  });
  let brought = 0, focused = 0;
  const props = { student: { id: "student & other?", name: "Victoria", avatarUrl: null, presence: "offline" }, summonBusy: false,
    onBringToClass: () => brought++ };
  const render = (patch: Record<string, unknown> = {}) => {
    stateCursor = 0; refCursor = 0; effects.length = 0;
    return exports.ClassStudentMenu({ ...props, ...patch });
  };
  const trigger = (tree: React.ReactNode) => flatten(tree).find(node => node.props["aria-haspopup"] === "menu")!;
  const open = () => {
    const tree = render();
    refs[0].current = { getBoundingClientRect: () => ({ left: 320, top: 30, bottom: 80 }), contains: () => false, focus: () => focused++ };
    (trigger(tree).props.onClick as () => void)();
    return render();
  };
  return { render, open, trigger, state, refs, effects, events, windowEvents, document,
    counts: () => ({ brought, focused }),
    leave: (busy = false) => exports.ClassLeaveButton({ busy, onLeave: () => brought++ }),
  };
}

test("the student profile trigger starts closed with no loose Homework or Bring to class buttons", () => {
  const h = harness(); const tree = h.render();
  assert.equal(h.trigger(tree).props["aria-expanded"], false);
  assert.equal(flatten(tree).filter(node => node.props.role === "menu").length, 0);
  const html = renderToStaticMarkup(tree);
  assert(html.includes("Victoria") && html.includes("offline"));
  assert(!html.includes("Homework") && !html.includes("Bring to class"));
  assert.equal((room.match(/<ClassStudentMenu /g) ?? []).length, 1);
  assert(!room.includes('href={`/teacher/homeworks?student='));
  assert(/teacher\s*\?\s*\(\s*<div[^>]*>\s*<ClassStudentMenu/.test(room));
});

test("opening the dropdown exposes profile, homework, materials and bring actions without avatar preview", () => {
  const h = harness(); const tree = h.open();
  const html = renderToStaticMarkup(tree);
  assert.equal(h.trigger(tree).props["aria-expanded"], true);
  assert(html.includes('role="menu"'));
  assert(html.includes('href="/teacher/homeworks?student=student%20%26%20other%3F"'));
  assert(html.includes('href="/teacher/students/student%20%26%20other%3F/materials"'));
  assert(html.includes('href="/teacher/students/student%20%26%20other%3F"'));
  assert.equal(flatten(tree).filter(node => node.props.role === "menuitem").length, 4);
  assert(!html.includes("View Victoria") && !source.includes("onViewAvatar"));
  assert(!room.includes("avatarPreview"));
  const bring = flatten(tree).find(node => node.type === "button" && node.props.role === "menuitem" && !node.props.className?.toString().includes("border"))!;
  (bring.props.onClick as () => void)();
  assert.equal(h.counts().brought, 1);
  assert.equal(h.trigger(h.render()).props["aria-expanded"], false);
});

test("busy summons remain unavailable while homework and materials links stay usable", () => {
  const h = harness(); h.open(); const tree = h.render({ summonBusy: true });
  const html = renderToStaticMarkup(tree);
  assert(html.includes("Sending…") && html.includes('aria-busy="true"'));
  assert.equal(flatten(tree).filter(node => node.props.disabled === true).length, 1);
  assert.equal(flatten(tree).filter(node => node.type === Link && node.props.role === "menuitem").length, 3);
});

test("dropdown closes for outside clicks and Escape, restores keyboard focus, cleans listeners and clamps narrow layouts", () => {
  const h = harness(); h.open();
  const firstFocus = { focus() {} };
  h.refs[1].current = { contains: () => false, scrollHeight: 280, querySelector: () => firstFocus };
  const cleanup = h.effects[0]();
  const position = h.state[1] as { left: number; width: number; top: number; maxHeight: number };
  assert(position.left + position.width <= 348);
  assert(position.left >= 12 && position.top >= 12 && position.maxHeight <= 360);
  h.events.get("keydown")!({ key: "Escape", preventDefault() {} });
  assert.equal(h.state[0], false);
  assert.equal(h.counts().focused, 1);
  if (typeof cleanup === "function") cleanup();
  assert.equal(h.events.size, 0); assert.equal(h.windowEvents.size, 0);
  h.open(); h.refs[1].current = { contains: () => false, scrollHeight: 280, querySelector: () => firstFocus };
  const outsideCleanup = h.effects[0]();
  h.events.get("pointerdown")!({ target: {} }); assert.equal(h.state[0], false);
  if (typeof outsideCleanup === "function") outsideCleanup();
});

test("all menu entries and icon-only leave action retain accessible localized names", () => {
  for (const t of [en, ru, uk]) {
    const h = harness(t); const html = renderToStaticMarkup(h.open());
    assert(html.includes(t.nav.materials) && html.includes(t.nav.profile) && html.includes(t.classRoom.studentHomework));
    assert(html.includes(t.classRoom.bringToClass));
    const leave = h.leave() as Element;
    assert.equal(leave.props["aria-label"], t.classRoom.leave);
    assert.equal(leave.props.title, t.classRoom.leave);
    assert.equal(flatten(leave).filter(node => node.type === "svg").length, 1);
    assert(leave.props.className?.toString().includes("bg-rose-500"));
    assert(!leave.props.className?.toString().includes("ml-auto"));
    assert(!renderToStaticMarkup(leave).replace(/<[^>]*>/g, "").trim());
    assert.equal((h.leave(true) as Element).props.disabled, true);
  }
});

test("materials continue to use the existing role-restricted pages, without exposing editing to students", () => {
  const teacher = readFileSync("src/app/teacher/layout.tsx", "utf8");
  const materials = readFileSync("src/app/teacher/students/[id]/materials/page.tsx", "utf8");
  const student = readFileSync("src/app/student/materials/page.tsx", "utf8");
  assert(teacher.includes('session.role !== "TEACHER"'));
  assert(materials.includes("editable") && materials.includes('scope="STUDENT"'));
  assert(!student.includes("editable"));
});
