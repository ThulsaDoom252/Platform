import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import {
  CLASS_SUMMONS_POLL_MS, STUDENT_CLASS_PATH, classSummonsArrivalKey,
  createClassSummonsArrivals, createClassSummonsClient, pendingClassSummons,
  type ClassSummonsCommand,
} from "../src/lib/class-summons-client";
import { schoolPresenceMap } from "../src/lib/presence";

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

const epoch = Date.parse("2026-10-15T12:00:00Z");
function command(id = "command-1", time = epoch): ClassSummonsCommand {
  return { id, requestedAt: new Date(time).toISOString(), expiresAt: new Date(time + 120_000).toISOString() };
}
const flush = async () => { for (let i = 0; i < 8; i++) await Promise.resolve(); };
function storage() {
  const map = new Map<string, string>();
  return { getItem: (key: string) => map.get(key) ?? null, setItem: (key: string, value: string) => { map.set(key, value); }, map };
}
function harness(options: { storage?: ReturnType<typeof storage>; userId?: string } = {}) {
  let pathname = "/student/materials";
  let visible = true;
  let focused = true;
  let time = epoch;
  let value: unknown = { command: command() };
  let get: (signal: AbortSignal) => Promise<unknown> = async () => value;
  let ack: (id: string, signal: AbortSignal) => Promise<boolean> = async () => true;
  const arrivals = createClassSummonsArrivals(options.userId ?? "student", options.storage, () => time);
  const navigations: string[] = [];
  const acknowledgements: string[] = [];
  let reads = 0;
  const client = createClassSummonsClient({
    pathname: () => pathname, visible: () => visible, active: () => visible && focused, now: () => time, arrivals,
    pending: (signal) => { reads++; return get(signal); },
    acknowledge: (id, signal) => { acknowledgements.push(id); return ack(id, signal); },
    navigate: () => { navigations.push("soft"); }, hardNavigate: () => { navigations.push("hard"); },
  });
  return {
    client, arrivals, navigations, acknowledgements,
    get reads() { return reads; },
    path: (next: string) => { pathname = next; },
    visible: (next: boolean) => { visible = next; },
    focused: (next: boolean) => { focused = next; },
    time: (next: number) => { time = next; },
    value: (next: unknown) => { value = next; },
    get: (next: typeof get) => { get = next; }, ack: (next: typeof ack) => { ack = next; },
  };
}

test("summons parser rejects expired, malformed and non-command payloads without accepting a destination URL", () => {
  assert.equal(CLASS_SUMMONS_POLL_MS, 4_000);
  for (const value of [null, {}, { command: false }, { command: { ...command(), id: "" } }, { command: { ...command(), requestedAt: "bad" } }, { command: command("expired", epoch - 120_000) }]) {
    assert.equal(pendingClassSummons(value, epoch), null);
  }
  assert.deepEqual(pendingClassSummons({ command: { ...command(), url: "javascript:alert(1)" } }, epoch), command());
});

test("all student sections can be summoned; GET and router.push never acknowledge an uncommitted arrival", async () => {
  for (const section of ["/student", "/student/homeworks", "/student/materials", "/student/words", "/student/settings", "/student/tests/exercise", "/student/profile"]) {
    const h = harness();
    h.path(section);
    await h.client.poll();
    assert.deepEqual(h.navigations, ["soft"], section);
    assert.deepEqual(h.acknowledgements, [], section);
    assert.equal(h.arrivals.has(command()), false);
    h.client.stop();
  }
});

test("committed class pathname acknowledges the exact command once; leaving class is not undone by the stale command", async () => {
  const h = harness();
  await h.client.poll();
  h.path(STUDENT_CLASS_PATH);
  h.client.routeChanged();
  await h.client.poll();
  await flush();
  assert.deepEqual(h.acknowledgements, ["command-1"]);
  h.path("/student/homeworks");
  h.client.routeChanged();
  await h.client.poll();
  assert.deepEqual(h.navigations, ["soft"]);
  h.client.stop();
});

test("a pending response reads the latest route after await, including both directions of a route change", async () => {
  const h = harness();
  const response = deferred<unknown>();
  h.get(() => response.promise);
  const pull = h.client.poll();
  h.path(STUDENT_CLASS_PATH);
  response.resolve({ command: command() });
  await pull;
  assert.deepEqual(h.navigations, []);
  assert.deepEqual(h.acknowledgements, ["command-1"]);
  h.client.stop();

  const other = harness();
  other.path(STUDENT_CLASS_PATH);
  const late = deferred<unknown>();
  other.get(() => late.promise);
  const pending = other.client.poll();
  other.path("/student/activities");
  late.resolve({ command: command() });
  await pending;
  assert.deepEqual(other.navigations, ["soft"]);
  assert.deepEqual(other.acknowledgements, []);
  other.client.stop();
});

test("overlapping realtime, polling and route wake-ups coalesce into one in-flight GET plus one fresh read", async () => {
  const h = harness();
  const first = deferred<unknown>();
  let calls = 0;
  let active = 0;
  let maximum = 0;
  h.get(async () => {
    active++; maximum = Math.max(active, maximum);
    try { return ++calls === 1 ? await first.promise : { command: command("newer") }; }
    finally { active--; }
  });
  const pending = h.client.poll();
  for (let i = 0; i < 12; i++) void h.client.poll();
  first.resolve({ command: command() });
  await pending;
  assert.equal(calls, 2);
  assert.equal(maximum, 1);
  assert.deepEqual(h.navigations, ["soft", "soft"]);
  h.client.stop();
});

test("missed/failed soft navigation retries and then falls back to the fixed class route only after a fresh valid read", async () => {
  const h = harness();
  await h.client.poll();
  h.time(epoch + 4_000);
  await h.client.poll();
  h.time(epoch + 8_000);
  await h.client.poll();
  h.time(epoch + 12_000);
  await h.client.poll();
  assert.deepEqual(h.navigations, ["soft", "soft", "hard"]);
  assert.deepEqual(h.acknowledgements, []);
  h.client.stop();
});

test("cancelled or expired commands cannot cause cached navigation retries", async () => {
  for (const next of [{ command: null }, { command: command("expired", epoch - 120_000) }]) {
    const h = harness();
    await h.client.poll();
    h.time(epoch + 10_000);
    h.value(next);
    await h.client.poll();
    assert.deepEqual(h.navigations, ["soft"]);
    h.client.stop();
  }
});

test("a newer command has its own retry window and is not consumed by a late old acknowledgement", async () => {
  const h = harness();
  const oldAck = deferred<boolean>();
  h.ack((id) => id === "command-1" ? oldAck.promise : Promise.resolve(true));
  await h.client.poll();
  h.path(STUDENT_CLASS_PATH);
  h.client.routeChanged();
  h.value({ command: command("command-2") });
  await h.client.poll();
  await flush();
  oldAck.resolve(true);
  await flush();
  assert.deepEqual(h.acknowledgements, ["command-1", "command-2"]);
  assert.equal(h.arrivals.has(command("command-2")), true);
  h.client.stop();
});

test("acknowledgement transport failure is retried while in class but cannot pull a student back after leaving", async () => {
  const h = harness();
  h.ack(async () => { throw new Error("offline"); });
  await h.client.poll();
  h.path(STUDENT_CLASS_PATH);
  h.client.routeChanged();
  await h.client.poll();
  await flush();
  const attempts = h.acknowledgements.length;
  await h.client.poll();
  await flush();
  assert.ok(h.acknowledgements.length > attempts);
  h.path("/student/materials");
  h.client.routeChanged();
  await h.client.poll();
  assert.deepEqual(h.navigations, ["soft"]);
  h.client.stop();
});

test("successful arrival is shared across refresh, Strict Mode remount and other tabs, scoped to the signed-in student", async () => {
  const shared = storage();
  const first = harness({ storage: shared });
  first.path(STUDENT_CLASS_PATH);
  first.ack(async () => { throw new Error("disconnected after arrival"); });
  await first.client.poll();
  await flush();
  first.client.stop();
  const remounted = harness({ storage: shared });
  await remounted.client.poll();
  assert.deepEqual(remounted.navigations, []);
  const anotherStudent = harness({ storage: shared, userId: "other-student" });
  await anotherStudent.client.poll();
  assert.deepEqual(anotherStudent.navigations, ["soft"]);
  remounted.value({ command: command("new-command") });
  await remounted.client.poll();
  assert.deepEqual(remounted.navigations, ["soft"]);
  remounted.client.stop(); anotherStudent.client.stop();
});

test("disabled/corrupt storage is safe; arrival history is bounded and expired entries are discarded", () => {
  const blocked = createClassSummonsArrivals("student", { getItem() { throw new Error("denied"); }, setItem() { throw new Error("denied"); } }, () => epoch);
  blocked.add(command());
  assert.equal(blocked.has(command()), true);
  const shared = storage();
  shared.setItem(classSummonsArrivalKey("student"), "bad-json");
  let now = epoch;
  const arrivals = createClassSummonsArrivals("student", shared, () => now);
  for (let i = 0; i < 50; i++) arrivals.add(command(`id-${i}`, epoch + i));
  assert.equal(JSON.parse(shared.getItem(classSummonsArrivalKey("student"))!).length, 32);
  now = epoch + 150_000;
  assert.equal(arrivals.has(command("id-49")), false);
});

test("hidden tabs defer navigation until wake and ignore responses received after hiding", async () => {
  const h = harness();
  h.visible(false);
  await h.client.poll();
  assert.equal(h.reads, 0);
  h.visible(true);
  const delayed = deferred<unknown>();
  h.get(() => delayed.promise);
  const pending = h.client.poll();
  h.visible(false);
  delayed.resolve({ command: command() });
  await pending;
  assert.deepEqual(h.navigations, []);
  h.visible(true);
  h.get(async () => ({ command: command() }));
  await h.client.poll();
  assert.deepEqual(h.navigations, ["soft"]);
  h.client.stop();
});

test("an explicit realtime summon reaches an online hidden tab without waiting for focus", async () => {
  const h = harness();
  h.visible(false);
  await h.client.poll(true);
  assert.deepEqual(h.navigations, ["soft"]);
  assert.deepEqual(h.acknowledgements, []);
  h.path(STUDENT_CLASS_PATH);
  h.client.routeChanged();
  await flush();
  assert.deepEqual(h.acknowledgements, [], "a hidden class tab cannot consume the active tab's summon");
  h.visible(true);
  await h.client.poll();
  assert.deepEqual(h.acknowledgements, ["command-1"]);
  h.client.stop();
});

test("a pre-existing hidden class tab cannot consume the active outside tab's command", async () => {
  const shared = storage();
  let pending: ClassSummonsCommand | null = command();
  const hiddenClass = harness({ storage: shared });
  const activeOutside = harness({ storage: shared });
  hiddenClass.path(STUDENT_CLASS_PATH);
  hiddenClass.visible(false);
  for (const h of [hiddenClass, activeOutside]) {
    h.get(async () => ({ command: pending }));
    h.ack(async () => { pending = null; return true; });
  }
  await hiddenClass.client.poll(true);
  assert.deepEqual(hiddenClass.acknowledgements, []);
  assert.equal(activeOutside.arrivals.has(command()), false);
  await activeOutside.client.poll();
  assert.deepEqual(activeOutside.navigations, ["soft"]);
  activeOutside.path(STUDENT_CLASS_PATH);
  activeOutside.client.routeChanged();
  await flush();
  assert.deepEqual(activeOutside.acknowledgements, ["command-1"]);
  assert.equal(pending, null);
  hiddenClass.client.stop(); activeOutside.client.stop();
});

test("an unfocused visible class window cannot steal the focused outside window's summon", async () => {
  const shared = storage();
  const inactiveClass = harness({ storage: shared });
  const activeOutside = harness({ storage: shared });
  inactiveClass.path(STUDENT_CLASS_PATH);
  inactiveClass.focused(false);
  await inactiveClass.client.poll(true);
  assert.deepEqual(inactiveClass.acknowledgements, []);
  assert.equal(activeOutside.arrivals.has(command()), false);
  await activeOutside.client.poll(true);
  assert.deepEqual(activeOutside.navigations, ["soft"]);
  activeOutside.path(STUDENT_CLASS_PATH);
  activeOutside.client.routeChanged();
  await flush();
  assert.deepEqual(activeOutside.acknowledgements, ["command-1"]);
  inactiveClass.client.stop(); activeOutside.client.stop();
});

test("a hidden realtime wake queued during an ordinary read is not dropped", async () => {
  const h = harness();
  const delayed = deferred<unknown>();
  let calls = 0;
  h.get(() => ++calls === 1 ? delayed.promise : Promise.resolve({ command: command() }));
  const pending = h.client.poll();
  h.visible(false);
  void h.client.poll(true);
  delayed.resolve({ command: command() });
  await pending;
  assert.equal(calls, 2);
  assert.deepEqual(h.navigations, ["soft"]);
  h.client.stop();
});

test("a rejected ACK does not recursively poll forever and remembered arrivals can confirm after leaving", async () => {
  const h = harness();
  h.path(STUDENT_CLASS_PATH);
  h.ack(async () => false);
  await h.client.poll();
  await flush();
  assert.equal(h.reads, 1);
  assert.deepEqual(h.acknowledgements, ["command-1"]);
  h.path("/student/homeworks");
  h.ack(async () => true);
  await h.client.poll();
  await flush();
  assert.deepEqual(h.acknowledgements, ["command-1", "command-1"]);
  assert.deepEqual(h.navigations, []);
  h.client.stop();
});

test("unmount aborts pending transport and late responses cannot navigate or acknowledge", async () => {
  const h = harness();
  const late = deferred<unknown>();
  let signal: AbortSignal | undefined;
  h.get((value) => { signal = value; return late.promise; });
  const pending = h.client.poll();
  h.client.stop();
  assert.equal(signal?.aborted, true);
  h.path(STUDENT_CLASS_PATH);
  late.resolve({ command: command() });
  await pending;
  h.client.routeChanged();
  await h.client.poll();
  assert.deepEqual(h.navigations, []);
  assert.deepEqual(h.acknowledgements, []);
});

test("the layout receiver uses independent fetch with durable four-second polling and all browser recovery events", () => {
  const source = readFileSync("src/components/student/student-class-summons.tsx", "utf8");
  const layout = readFileSync("src/app/student/layout.tsx", "utf8");
  assert.ok(layout.includes("<StudentClassSummons userId={session.userId}"));
  assert.equal(source.includes("studentPlatformCommandAction"), false);
  assert.ok(source.includes("fetch(CLASS_SUMMONS_ENDPOINT"));
  assert.ok(source.includes("window.setInterval(wake, CLASS_SUMMONS_POLL_MS)"));
  for (const event of ["visibilitychange", "focus", "online", "pageshow", "storage"]) {
    assert.ok(source.includes(`addEventListener("${event}"`));
    assert.ok(source.includes(`removeEventListener("${event}"`));
  }
  assert.ok(source.includes("window.location.assign(STUDENT_CLASS_PATH)"));
  assert.ok(source.includes("controller.stop()"));
});

function presenceHarness() {
  const effects: (() => (() => void) | void)[] = [];
  const members: unknown[] = [];
  const gets: ReturnType<typeof deferred<unknown[]>>[] = [];
  const updates: { data: Record<string, unknown>; pending: ReturnType<typeof deferred<void>> }[] = [];
  const entered = deferred<void>();
  let changed = () => {};
  const data: Record<string, unknown> = { inClass: false };
  const channel = {
    state: "attached", on() {}, off() {},
    presence: {
      enter: () => entered.promise,
      leave: async () => {},
      update: (payload: Record<string, unknown>) => {
        const pending = deferred<void>(); updates.push({ data: { ...payload }, pending }); return pending.promise;
      },
      get: () => { const pending = deferred<unknown[]>(); gets.push(pending); return pending.promise; },
      subscribe: async (_events: unknown, callback: () => void) => { changed = callback; },
      unsubscribe() {},
    },
  };
  const source = readFileSync("src/lib/use-realtime.ts", "utf8").replace("let singleton: Promise<Ably.Realtime> | null = null;", "let singleton: Promise<Ably.Realtime> | null = Promise.resolve(__client);");
  const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const fixtureModule = { exports: {} as { useSchoolPresence: (options: unknown) => void } };
  vm.runInNewContext(js, {
    module: fixtureModule, exports: fixtureModule.exports, __client: { connection: { state: "connected", on() {}, off() {} }, channels: { get: () => channel } },
    require(name: string) {
      if (name === "react") return {
        createContext: () => true, createElement() {}, useContext: () => true,
        useEffect: (effect: () => (() => void) | void) => { effects.push(effect); },
        useEffectEvent: (callback: unknown) => callback,
        useRef: (value: unknown) => ({ current: value }), useState: (value: unknown) => [value, () => {}],
      };
      if (name === "@/lib/presence") return { schoolPresenceMap };
      throw new Error(`Unexpected import ${name}`);
    }, queueMicrotask, window: { setInterval: () => 1, clearInterval() {} },
  });
  fixtureModule.exports.useSchoolPresence({ data, onMembers: (value: unknown) => members.push(value) });
  const cleanup = effects[0]();
  return { data, entered, members, gets, updates, update: () => effects[1](), changed: () => changed(), cleanup };
}

test("presence member reads resolving out of order cannot restore an old class status", async () => {
  const h = presenceHarness();
  await flush();
  h.entered.resolve();
  await flush();
  assert.equal(h.gets.length, 1);
  h.changed();
  assert.equal(h.gets.length, 2);
  h.gets[1].resolve([{ clientId: "student", data: { inClass: true } }]);
  await flush();
  h.gets[0].resolve([{ clientId: "student", data: { inClass: false } }]);
  await flush();
  assert.deepEqual(h.members, [{ student: "in_class" }]);
  h.cleanup?.();
});

test("presence waits for attachment and serially coalesces rapid enter/leave route updates", async () => {
  const h = presenceHarness();
  await flush();
  h.data.inClass = true;
  h.update();
  await flush();
  assert.equal(h.updates.length, 0, "do not publish before initial presence enter completes");
  h.entered.resolve();
  await flush();
  assert.equal(h.updates.length, 1);
  assert.deepEqual(h.updates[0].data, { inClass: true });
  h.data.inClass = false;
  h.update();
  h.data.activeAt = 100;
  h.update();
  assert.equal(h.updates.length, 1, "a newer update must not race an older request");
  h.updates[0].pending.resolve();
  await flush();
  assert.equal(h.updates.length, 2);
  assert.deepEqual(h.updates[1].data, { inClass: false, activeAt: 100 });
  h.updates[1].pending.resolve();
  await flush();
  h.cleanup?.();
});
