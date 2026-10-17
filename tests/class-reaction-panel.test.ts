import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";
import React from "react";
import * as jsx from "react/jsx-runtime";
import { renderToStaticMarkup } from "react-dom/server";
import * as reactions from "../src/lib/class-reaction";
import * as localStore from "../src/lib/local-json-store";
import { uiPreferenceKey } from "../src/lib/ui-preferences";
import { en } from "../src/lib/i18n/en";

type Element = React.ReactElement<Record<string, unknown>>;
const Icon = () => React.createElement("svg");
function compile(path: string, imports: Record<string, unknown>, globals: Record<string, unknown> = {}) {
  const exports: Record<string, unknown> = {};
  vm.runInNewContext(ts.transpileModule(readFileSync(path, "utf8"), { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX,
  } }).outputText, { exports, require: (name: string) => {
    if (name in imports) return imports[name];
    throw Error(`Unexpected dependency: ${name}`);
  }, ...globals });
  return exports;
}
const shared = {
  "react/jsx-runtime": jsx,
  "@/components/icons": { IconGrip: Icon, IconX: Icon },
  "lucide-react": new Proxy({}, { get: () => Icon }),
  "@/components/i18n-provider": { useT: () => ({ t: en }) },
  "@/lib/class-reaction": reactions,
  "@/lib/utils": { cn: (...values: unknown[]) => values.filter(Boolean).join(" ") },
};
function children(element: unknown): Element[] {
  if (Array.isArray(element)) return element.flatMap(children);
  if (!React.isValidElement(element)) return [];
  const node = element as Element;
  return [node, ...children(node.props.children)];
}

test("reactions use the same compact docked size as chat; old layout records use the new fallback", () => {
  const compiled = compile("src/components/class/dockable-panel.tsx", { ...shared, react: React });
  const layouts = compiled.DEFAULT_CLASS_PANEL_LAYOUT as Record<string, Record<string, number | boolean>>;
  assert.equal(layouts.reactions.width, 360); assert.equal(layouts.reactions.height, 420);
  assert.equal(layouts.reactions.width, layouts.chat.width);
  assert.equal(layouts.reactions.height, layouts.chat.height);
  assert.equal(layouts.reactions.floating, false);
  const normalize = compiled.normalizeClassPanelPlacement as (value: unknown, fallback: unknown) => Record<string, unknown>;
  assert.deepEqual({ ...normalize(undefined, layouts.reactions) }, { ...layouts.reactions });
  const restored = normalize({ floating: true, x: 120, y: 160, width: 480, height: 500 }, layouts.reactions);
  assert.deepEqual({ ...restored }, { floating: true, x: 120, y: 160, width: 480, height: 500 });
  assert.equal(normalize({ width: -10, height: NaN }, layouts.reactions).width, 280);
  assert.equal(normalize({ width: -10, height: NaN }, layouts.reactions).height, 420);
});

test("actual reaction preferences survive close/reopen and stay isolated by account, with validated fallbacks", async () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  const storage = new Map<string, string>();
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, value),
  } });
  try {
    let account = "reaction-panel-teacher-a";
    const pending: Promise<unknown>[] = [], sent: unknown[][] = [];
    const react = { ...React,
      createContext: (value: unknown) => ({ value }),
      useContext: (context: { value: unknown }) => context.value === "anonymous" ? account : null,
      useMemo: (read: () => unknown) => read(),
      useCallback: (callback: unknown) => callback,
      useSyncExternalStore: (_subscribe: unknown, read: () => unknown) => read(),
      useState: (value: unknown) => [value, () => {}],
      useTransition: () => [false, (action: () => Promise<unknown>) => pending.push(action())],
    };
    const localHook = compile("src/lib/use-local-json.ts", {
      react, "@/lib/local-json-store": localStore,
    });
    const prefs = compile("src/components/ui-preferences-provider.tsx", {
      ...shared, react, "@/lib/use-local-json": localHook,
      "@/lib/ui-preferences": { uiPreferenceKey },
    });
    const compiled = compile("src/components/class/class-reactions.tsx", { ...shared, react,
      "@/components/ui-preferences-provider": prefs,
      "@/lib/actions/class-tools": { sendClassReactionAction: async (...args: unknown[]) => { sent.push(args); return {}; } },
    }, { window: { setTimeout: () => 0 } });
    const Panel = compiled.TeacherReactionPanel as () => Element;
    const nodes = () => children(Panel());
    const button = (name: string) => nodes().find(node => node.type === "button" && children(node).some(child => child.props.children === name))!;
    const sound = () => nodes().find(node => node.props.role === "switch")!;
    assert.equal(button(en.classRoom.reactionEmerge).props["aria-pressed"], true);
    assert.equal(sound().props["aria-checked"], false);
    (button(en.classRoom.reactionFloat).props.onClick as () => void)();
    (sound().props.onClick as () => void)();
    assert.equal(storage.get(uiPreferenceKey(account, "class:reactions:mode")), '"float"');
    assert.equal(storage.get(uiPreferenceKey(account, "class:reactions:sound")), "true");
    assert.equal(button(en.classRoom.reactionFloat).props["aria-pressed"], true);
    assert.equal(sound().props["aria-checked"], true);
    (button("Thumbs up").props.onClick as () => void)();
    await Promise.all(pending);
    assert.deepEqual(sent, [["thumbs-up", true, "float"]]);
    account = "reaction-panel-teacher-b";
    assert.equal(sound().props["aria-checked"], false);
    assert.equal(button(en.classRoom.reactionEmerge).props["aria-pressed"], true);
    account = "reaction-panel-teacher-a";
    assert.equal(sound().props["aria-checked"], true);
    (sound().props.onClick as () => void)();
    assert.equal(sound().props["aria-checked"], false);
    assert.equal(storage.get(uiPreferenceKey(account, "class:reactions:sound")), "false");
    account = "reaction-panel-invalid";
    storage.set(uiPreferenceKey(account, "class:reactions:mode"), '"unsupported"');
    storage.set(uiPreferenceKey(account, "class:reactions:sound"), '"true"');
    assert.equal(sound().props["aria-checked"], false);
    assert.equal(button(en.classRoom.reactionEmerge).props["aria-pressed"], true);
    const html = renderToStaticMarkup(Panel());
    assert(!html.includes("fixed") && !html.includes("44rem"));
    assert(html.includes("repeat(auto-fit, minmax(min(100%, 5rem), 1fr))"));
    assert(html.includes("overflow-y-auto"));
  } finally {
    if (original) Object.defineProperty(globalThis, "localStorage", original);
    else Reflect.deleteProperty(globalThis, "localStorage");
  }
});

test("shared floating header moves, resizes within viewport, docks and closes without triggering drag", () => {
  const compiled = compile("src/components/class/dockable-panel.tsx", {
    ...shared, react: { ...React,
      useRef: (value: unknown) => ({ current: value }),
      useState: (value: unknown) => [value, () => {}], useEffect: () => {},
    },
  }, { window: { innerWidth: 1000, innerHeight: 800 } });
  const Panel = compiled.DockablePanel as (props: Record<string, unknown>) => Element;
  const moves: number[][] = [], sizes: number[][] = [];
  let docked = 0, closed = 0, captured = 0, released = 0, stopped = 0;
  const element = Panel({ title: "Reactions", placement: { floating: true, x: 20, y: 30, width: 360, height: 420 },
    dockedClassName: "h-[420px]", detachLabel: "Detach", dockLabel: "Dock", resizeLabel: "Resize", closeLabel: "Close",
    onDetach() {}, onDock: () => docked++, onClose: () => closed++,
    onMove: (...point: number[]) => moves.push(point), onResize: (...size: number[]) => sizes.push(size), children: null,
  });
  (element.props.ref as { current: unknown }).current = { getBoundingClientRect: () => ({ width: 360, height: 420 }) };
  const header = children(element).find(node => node.type === "header")!;
  const resize = children(element).find(node => node.props["aria-label"] === "Resize")!;
  const close = children(element).find(node => node.props["aria-label"] === "Close")!;
  const dock = children(element).find(node => node.props["aria-label"] === "Dock")!;
  const event = (x: number, y: number) => ({ pointerId: 1, button: 0, clientX: x, clientY: y,
    currentTarget: { setPointerCapture: () => captured++, releasePointerCapture: () => released++ },
    stopPropagation: () => stopped++,
  });
  const call = (node: Element, key: string, x = 0, y = 0) => (node.props[key] as (event: unknown) => void)(event(x, y));
  call(header, "onPointerDown", 40, 45); call(header, "onPointerMove", 9999, 9999); call(header, "onPointerUp");
  assert.deepEqual(moves, [[628, 308]]);
  call(resize, "onPointerDown", 0, 0); call(resize, "onPointerMove", 9999, 9999); call(resize, "onPointerCancel");
  assert.deepEqual(sizes, [[360, 420]]);
  call(close, "onPointerDown"); call(close, "onClick"); call(dock, "onClick");
  assert.equal(closed, 1); assert.equal(docked, 1); assert.equal(captured, 2); assert.equal(released, 2); assert.equal(stopped, 2);
});

test("floating panels leave space for a wrapped Notes utility bar when moving and resizing", () => {
  const compiled = compile("src/components/class/dockable-panel.tsx", {
    ...shared, react: { ...React, useRef: (value: unknown) => ({ current: value }), useState: (value: unknown) => [value, () => {}], useEffect: () => {} },
  }, { window: { innerWidth: 1000, innerHeight: 800 }, document: { querySelector: () => ({ getBoundingClientRect: () => ({ top: 650 }) }) } });
  const Panel = compiled.DockablePanel as (props: Record<string, unknown>) => Element;
  const moves: number[][] = [], sizes: number[][] = [];
  const tree = Panel({ title: "Notes", placement: { floating: true, x: 20, y: 30, width: 360, height: 420 }, dockedClassName: "",
    detachLabel: "Detach", dockLabel: "Dock", resizeLabel: "Resize", onDetach() {}, onDock() {},
    onMove: (...point: number[]) => moves.push(point), onResize: (...size: number[]) => sizes.push(size), children: null });
  (tree.props.ref as { current: unknown }).current = { getBoundingClientRect: () => ({ width: 360, height: 420 }) };
  const header = children(tree).find(node => node.type === "header")!;
  const resize = children(tree).find(node => node.props["aria-label"] === "Resize")!;
  const call = (node: Element, handler: string, y: number) => (node.props[handler] as (event: unknown) => void)({ pointerId: 1, button: 0, clientX: 40, clientY: y, currentTarget: { setPointerCapture() {}, releasePointerCapture() {} }, stopPropagation() {} });
  call(header, "onPointerDown", 40); call(header, "onPointerMove", 790); call(header, "onPointerUp", 790);
  assert.equal(moves[0][1] + 420, 638, "Panel stays above the toolbar with a 12px gap");
  call(resize, "onPointerDown", 650); call(resize, "onPointerMove", 1200); call(resize, "onPointerUp", 1200);
  assert.equal(moves[0][1] + sizes[0][1], 638, "The resize handle cannot slip under Notes");
});

test("classroom only exposes the dockable reaction panel to the teacher with a selected student", () => {
  const room = readFileSync("src/components/class/class-room.tsx", "utf8");
  assert.equal((room.match(/<TeacherReactionPanel\s*\/>/g) ?? []).length, 1);
  assert(room.includes("teacher && partner && showReactions && ("));
  assert(room.includes('showReactions && !reactionsPlacement.floating'));
  for (const callback of ['detachPanel("reactions")', 'dockPanel("reactions")', 'movePanel("reactions", x, y)', 'resizePanel("reactions", width, height)']) assert(room.includes(callback));
  const block = room.slice(room.indexOf("{teacher && partner && showReactions && ("), room.indexOf("{open.chat && (", room.indexOf("{teacher && partner && showReactions && (")));
  assert(block.includes("<DockablePanel") && block.includes('placement={reactionsPlacement}'));
  assert(block.includes('onClose={() => setShowReactions(false)}'));
  assert(room.includes('`class-panel-layout:${selfId}`'));
});
