import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import test from "node:test";
import * as orm from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import ts from "typescript";
import { users } from "../src/lib/db/schema";
import * as summons from "../src/lib/class-summons";

const teacherId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const otherTeacherId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const studentId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const otherStudentId = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const firstId = "11111111-1111-4111-8111-111111111111";
const secondId = "22222222-2222-4222-8222-222222222222";
const dialect = new PgDialect();
const plain = <T>(value: T): T => JSON.parse(JSON.stringify(value));
const source = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");
const compile = (text: string) => ts.transpileModule(text, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
}).outputText;
const actionAst = ts.createSourceFile("class.ts", source("../src/lib/actions/class.ts"), ts.ScriptTarget.Latest, true);
const actionNames = ["requireUser", "summonStudentToClassAction", "studentPlatformCommandAction"];
const actionsText = actionNames.map((name) => {
  const entry = actionAst.statements.find((node) => ts.isFunctionDeclaration(node) && node.name?.text === name);
  assert.ok(entry, `native ${name} exists`);
  return entry.getText(actionAst).replace(/^export /, "");
}).join("\n");

type Person = { id: string; role: "TEACHER" | "STUDENT"; classWithId: string | null; classFocus: Record<string, unknown>; lastSeenAt: Date | null };
type Session = { userId: string; role: "TEACHER" | "STUDENT"; name: string; impersonatedBy?: { teacherId: string; teacherName: string } };
type SqlQuery = { sql: string; params: unknown[] };

function storedCommand(id = firstId, owner = teacherId, now = Date.now()) {
  return { id, teacherId: owner, requestedAt: new Date(now).toISOString(),
    expiresAt: new Date(now + summons.CLASS_SUMMONS_TTL_MS).toISOString() };
}

function harness(options: { role?: "TEACHER" | "STUDENT"; selected?: string | null; command?: Record<string, unknown>; legacy?: string; impersonated?: boolean } = {}) {
  const focus: Record<string, unknown> = { view: "LESSON", lessonAssignmentId: "lesson", lessonSection: "video", timerState: { duration: 120 }, reactions: [{ id: "reaction" }] };
  if (options.command) focus.enterClassCommand = options.command;
  if (options.legacy) focus.enterClassAt = options.legacy;
  const people: Person[] = [
    { id: teacherId, role: "TEACHER", classWithId: options.selected === undefined ? studentId : options.selected, classFocus: {}, lastSeenAt: null },
    { id: otherTeacherId, role: "TEACHER", classWithId: otherStudentId, classFocus: {}, lastSeenAt: null },
    { id: studentId, role: "STUDENT", classWithId: null, classFocus: focus, lastSeenAt: new Date(0) },
    { id: otherStudentId, role: "STUDENT", classWithId: null, classFocus: {}, lastSeenAt: null },
  ];
  let session: Session | null = { userId: options.role === "STUDENT" ? studentId : teacherId, role: options.role ?? "TEACHER", name: "Test" };
  if (options.impersonated) session.impersonatedBy = { teacherId, teacherName: "Teacher" };
  const events: unknown[][] = [];
  const reads: SqlQuery[] = [];
  const writes: { query: SqlQuery; patch: Record<string, unknown>; matched: number }[] = [];
  let beforeUpdate: (() => void) | undefined;
  const queryFor = (where: orm.SQL) => dialect.sqlToQuery(where);
  function matches(person: Person, query: SqlQuery) {
    for (const condition of query.sql.matchAll(/"users"\."(id|role|class_with_id)" = \$(\d+)/g)) {
      const key = condition[1] === "class_with_id" ? "classWithId" : condition[1] as "id" | "role";
      if (person[key] !== query.params[Number(condition[2]) - 1]) return false;
    }
    const modern = query.sql.match(/->'enterClassCommand'->>'id' = \$(\d+)/);
    if (modern && (person.classFocus.enterClassCommand as { id?: string } | undefined)?.id !== query.params[Number(modern[1]) - 1]) return false;
    const legacy = query.sql.match(/->>'enterClassAt' = \$(\d+)/);
    if (legacy && (person.classFocus.enterClassCommand || person.classFocus.enterClassAt !== query.params[Number(legacy[1]) - 1])) return false;
    if (query.sql.includes("exists (select 1")) {
      const owner = query.sql.match(/summon_teacher\.id = \$(\d+)::uuid/);
      const target = query.sql.match(/summon_teacher\.class_with_id = \$(\d+)::uuid/);
      if (!people.some((row) => row.role === "TEACHER" && row.classWithId === query.params[Number(target?.[1]) - 1] &&
        (!owner || row.id === query.params[Number(owner[1]) - 1]))) return false;
    }
    const expiry = query.sql.match(/\$(\d+)::timestamptz > now\(\)/);
    if (expiry && Date.parse(String(query.params[Number(expiry[1]) - 1])) <= Date.now()) return false;
    return true;
  }
  const db = {
    select: (projection: Record<string, unknown>) => {
      let where: orm.SQL;
      const chain = { from: () => chain, where: (value: orm.SQL) => { where = value; return chain; }, limit: async () => {
        const query = queryFor(where);
        reads.push(query);
        const keys = new Map<unknown, keyof Person>([[users.id, "id"], [users.role, "role"], [users.classWithId, "classWithId"], [users.classFocus, "classFocus"], [users.lastSeenAt, "lastSeenAt"]]);
        return people.filter((row) => matches(row, query)).slice(0, 1).map((row) => Object.fromEntries(
          Object.entries(projection).map(([key, column]) => [key, plain(row[keys.get(column)!])]),
        ));
      } };
      return chain;
    },
    update: () => ({ set: (patch: Record<string, unknown>) => ({ where: (where: orm.SQL) => ({ returning: async () => {
      beforeUpdate?.(); beforeUpdate = undefined;
      const query = queryFor(where);
      const rows = people.filter((row) => matches(row, query));
      for (const row of rows) {
        const update = queryFor(patch.classFocus as orm.SQL);
        if (update.sql.includes("- 'enterClassCommand'")) {
          delete row.classFocus.enterClassCommand; delete row.classFocus.enterClassAt;
        } else {
          Object.assign(row.classFocus, JSON.parse(String(update.params.find((value) => typeof value === "string" && value.startsWith("{")))));
        }
      }
      writes.push({ query, patch, matched: rows.length });
      return rows.map((row) => ({ id: row.id }));
    } }) }) }),
  };
  const serverExports: {
    readStudentClassSummons: (identity: Session) => Promise<summons.ClassSummonsCommand | null>;
    acknowledgeStudentClassSummons: (identity: Session, id: string) => Promise<boolean>;
  } = {} as never;
  runInNewContext(compile(source("../src/lib/class-summons-server.ts")), {
    exports: serverExports, Date,
    require: (name: string) => {
      if (name === "server-only") return {};
      if (name === "drizzle-orm") return orm;
      if (name === "@/lib/db") return { db };
      if (name === "@/lib/db/schema") return { users };
      if (name === "@/lib/class-summons") return summons;
      throw new Error(`Unexpected import ${name}`);
    },
  });
  let nextId = firstId;
  const context = { ...orm, ...summons, ...serverExports, users, db, Date,
    getSession: async () => session, randomUUID: () => { const id = nextId; nextId = secondId; return id; },
    publishUserRealtime: async (...args: unknown[]) => { events.push(args); },
    actions: undefined as unknown as {
      summonStudentToClassAction: (expectedStudentId?: string) => Promise<{ error?: string; commandId?: string; expiresAt?: string }>;
      studentPlatformCommandAction: () => Promise<{ enterClass: boolean; commandId?: string }>;
    },
  };
  runInNewContext(compile(actionsText + "\nglobalThis.actions={summonStudentToClassAction,studentPlatformCommandAction};"), context);
  return { ...context.actions, ...serverExports, people, focus, events, reads, writes,
    student: { userId: studentId, role: "STUDENT", name: "Student" } as Session,
    beforeUpdate: (task: () => void) => { beforeUpdate = task; },
    session: (next: Session | null) => { session = next; } };
}

test("send succeeds despite stale DB online status, preserves live focus and returns sent not arrived", async () => {
  const h = harness();
  h.beforeUpdate(() => { h.focus.lessonSection = "dialogue"; h.focus.gameId = "new-game"; });
  const result = await h.summonStudentToClassAction();
  assert.equal(result.error, undefined);
  assert.equal(result.commandId, firstId);
  assert.equal(h.focus.lessonSection, "dialogue");
  assert.equal(h.focus.gameId, "new-game");
  assert.deepEqual(h.focus.timerState, { duration: 120 });
  assert.deepEqual(h.focus.reactions, [{ id: "reaction" }]);
  assert.equal(h.people[2].lastSeenAt?.getTime(), 0, "sending must not claim student arrived or online");
  assert.deepEqual(Object.keys(h.writes[0].patch), ["classFocus"]);
  assert.equal(h.events[0][0], studentId);
  assert.equal(h.events[0][1], "summon");
  const pending = await h.readStudentClassSummons(h.student);
  assert.equal(pending?.id, firstId);
  assert.equal(Date.parse(pending!.expiresAt) - Date.parse(pending!.requestedAt), 120_000);
});

test("repeated reads and legacy server-action compatibility do not consume a navigation request", async () => {
  const h = harness({ role: "STUDENT", command: storedCommand() });
  const before = plain(h.focus);
  for (let i = 0; i < 3; i++) {
    assert.equal((await h.readStudentClassSummons(h.student))?.id, firstId);
    assert.equal((await h.studentPlatformCommandAction()).enterClass, true);
  }
  assert.equal(h.writes.length, 0);
  assert.deepEqual(h.focus, before);
});

test("acknowledgment consumes only exact command metadata and preserves concurrent class focus", async () => {
  const command = storedCommand();
  const h = harness({ role: "STUDENT", command, legacy: command.requestedAt });
  h.beforeUpdate(() => { h.focus.lessonSection = "transcript"; h.focus.videoState = { playing: true }; });
  assert.equal(await h.acknowledgeStudentClassSummons(h.student, firstId), true);
  assert.equal(h.focus.enterClassCommand, undefined);
  assert.equal(h.focus.enterClassAt, undefined);
  assert.equal(h.focus.lessonSection, "transcript");
  assert.deepEqual(h.focus.videoState, { playing: true });
  assert.deepEqual(Object.keys(h.writes[0].patch), ["classFocus"]);
  assert.equal(await h.acknowledgeStudentClassSummons(h.student, firstId), false);
});

test("an older tab acknowledgment cannot erase a newer concurrently sent command", async () => {
  const h = harness({ role: "STUDENT", command: storedCommand() });
  h.beforeUpdate(() => { h.focus.enterClassCommand = storedCommand(secondId); });
  assert.equal(await h.acknowledgeStudentClassSummons(h.student, firstId), false);
  assert.equal((h.focus.enterClassCommand as summons.StoredClassSummons).id, secondId);
  assert.equal(h.writes[0].matched, 0);
});

test("command authority is the originating teacher still selecting this exact student", async () => {
  for (const owner of [teacherId, otherTeacherId]) {
    const h = harness({ role: "STUDENT", selected: otherStudentId, command: storedCommand(firstId, owner) });
    assert.equal(await h.readStudentClassSummons(h.student), null);
    assert.equal(await h.acknowledgeStudentClassSummons(h.student, firstId), false);
    assert.ok(h.focus.enterClassCommand);
  }
  const h = harness({ role: "STUDENT", command: storedCommand() });
  h.beforeUpdate(() => { h.people[0].classWithId = otherStudentId; });
  assert.equal(await h.acknowledgeStudentClassSummons(h.student, firstId), false, "selection must be checked atomically at ACK");
});

test("send rejects wrong roles, missing selection and a concurrently changed selection", async () => {
  for (const options of [{ role: "STUDENT" as const }, { selected: null }, { selected: otherTeacherId }]) {
    const h = harness(options);
    assert.ok((await h.summonStudentToClassAction()).error);
    assert.equal(h.writes.length, 0);
  }
  const h = harness();
  h.beforeUpdate(() => { h.people[0].classWithId = otherStudentId; });
  assert.ok((await h.summonStudentToClassAction()).error);
  assert.equal(h.events.length, 0);
  assert.equal(h.focus.enterClassCommand, undefined);
});

test("the button's expected student prevents a delayed click from summoning a different selected pupil", async () => {
  for (const expected of ["invalid-student", otherStudentId]) {
    const h = harness();
    assert.ok((await h.summonStudentToClassAction(expected)).error);
    assert.equal(h.writes.length, 0);
    assert.equal(h.events.length, 0);
  }
  const h = harness();
  assert.equal((await h.summonStudentToClassAction(studentId)).commandId, firstId);
});

test("legacy timestamp commands survive reads until exact acknowledgment, bounded by the same TTL", async () => {
  const requestedAt = new Date(Date.now() - 45_000).toISOString();
  const h = harness({ role: "STUDENT", legacy: requestedAt });
  const pending = await h.readStudentClassSummons(h.student);
  assert.equal(pending?.id, `legacy:${requestedAt}`);
  assert.equal(await h.acknowledgeStudentClassSummons(h.student, `legacy:${requestedAt}`), true);
  assert.equal(h.focus.enterClassAt, undefined);
  assert.equal(h.focus.lessonAssignmentId, "lesson");
});

test("expired, invalid, future, extended-TTL and impersonated commands never navigate", async () => {
  for (const command of [storedCommand(firstId, teacherId, Date.now() - 121_000),
    storedCommand(firstId, teacherId, Date.now() + 6_000),
    { ...storedCommand(), expiresAt: new Date(Date.now() + 900_000).toISOString() },
    { ...storedCommand(), id: "bad-id" }, { ...storedCommand(), teacherId: "bad-teacher" }]) {
    const h = harness({ role: "STUDENT", command });
    assert.equal(await h.readStudentClassSummons(h.student), null);
    assert.equal(await h.acknowledgeStudentClassSummons(h.student, firstId), false);
    assert.equal(h.writes.length, 0);
  }
  const h = harness({ role: "STUDENT", command: storedCommand(), impersonated: true });
  assert.equal((await h.studentPlatformCommandAction()).enterClass, false);
  assert.equal(await h.acknowledgeStudentClassSummons({ ...h.student, impersonatedBy: { teacherId, teacherName: "Teacher" } }, firstId), false);
});

function routeHarness(session: Session | null) {
  const calls: unknown[][] = [];
  const exports: { GET: () => Promise<Response>; POST: (request: Request) => Promise<Response> } = {} as never;
  runInNewContext(compile(source("../src/app/api/class/summons/route.ts")), {
    exports, Response, URL,
    require: (name: string) => {
      if (name === "@/lib/session") return { getSession: async () => session };
      if (name === "@/lib/class-summons") return summons;
      if (name === "@/lib/class-summons-server") return {
        readStudentClassSummons: async (...args: unknown[]) => { calls.push(["read", ...args]); return storedCommand(); },
        acknowledgeStudentClassSummons: async (...args: unknown[]) => { calls.push(["ack", ...args]); return true; },
      };
      throw new Error(name);
    },
  });
  return { ...exports, calls };
}

test("lightweight no-cache GET/POST route authenticates students and keeps reads separate from ACK", async () => {
  const h = routeHarness({ userId: studentId, role: "STUDENT", name: "Student" });
  const response = await h.GET();
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("Cache-Control"), "private, no-store");
  assert.equal(response.headers.get("Vary"), "Cookie");
  assert.equal((await response.json()).command.id, firstId);
  assert.equal(h.calls[0][0], "read");
  const ack = await h.POST(new Request("https://school.example/api/class/summons", {
    method: "POST", headers: { Origin: "https://school.example", "Content-Type": "application/json" }, body: JSON.stringify({ commandId: firstId }),
  }));
  assert.deepEqual(await ack.json(), { acknowledged: true });
  assert.equal(h.calls[1][0], "ack");
  assert.equal(h.calls[1][2], firstId);
});

test("route rejects unauthenticated, teacher, impersonated, cross-origin and malformed ACK requests", async () => {
  for (const [identity, expected] of [[null, 401], [{ userId: teacherId, role: "TEACHER", name: "Teacher" }, 403],
    [{ userId: studentId, role: "STUDENT", name: "Student", impersonatedBy: { teacherId, teacherName: "Teacher" } }, 403]] as const) {
    const h = routeHarness(identity);
    assert.equal((await h.GET()).status, expected);
    assert.equal((await h.POST(new Request("https://school.example/api/class/summons", { method: "POST", body: "{}" }))).status, expected);
    assert.equal(h.calls.length, 0);
  }
  const h = routeHarness({ userId: studentId, role: "STUDENT", name: "Student" });
  const attackHeaders: HeadersInit[] = [{ Origin: "https://evil.example" }, { Origin: "malformed" }, { "Sec-Fetch-Site": "cross-site" }];
  for (const headers of attackHeaders) {
    assert.equal((await h.POST(new Request("https://school.example/api/class/summons", { method: "POST", headers, body: JSON.stringify({ commandId: firstId }) }))).status, 403);
  }
  for (const body of ["broken-json", "null", "[]", "{}", JSON.stringify({ commandId: "not-an-id" })]) {
    assert.equal((await h.POST(new Request("https://school.example/api/class/summons", { method: "POST", body }))).status, 400);
  }
  assert.equal(h.calls.length, 0);
});

function sendRouteHarness(session: Session | null, send?: (id: string) => Promise<{ error?: string; commandId?: string; expiresAt?: string }>) {
  const calls: unknown[][] = [];
  const exports: { POST: (request: Request) => Promise<Response> } = {} as never;
  runInNewContext(compile(source("../src/app/api/class/summons/send/route.ts")), {
    exports, Response, URL,
    require: (name: string) => {
      if (name === "@/lib/session") return { getSession: async () => session,
        withRequestSession: (identity: Session, task: () => unknown) => { calls.push(["scope", identity]); return task(); } };
      if (name === "@/lib/actions/class") return { summonStudentToClassAction: async (id: string) => {
        calls.push(["send", id]);
        return send ? send(id) : { commandId: firstId, expiresAt: storedCommand().expiresAt };
      } };
      throw new Error(name);
    },
  });
  return { ...exports, calls };
}

test("teacher send route scopes verified identity, ignores supplied teacher identity and returns sent metadata no-cache", async () => {
  const identity: Session = { userId: teacherId, role: "TEACHER", name: "Teacher" };
  const h = sendRouteHarness(identity);
  const response = await h.POST(new Request("https://school.example/api/class/summons/send", { method: "POST",
    headers: { Origin: "https://school.example", "Content-Type": "application/json" },
    body: JSON.stringify({ studentId, teacherId: otherTeacherId }),
  }));
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("Cache-Control"), "private, no-store");
  assert.equal(response.headers.get("Vary"), "Cookie");
  assert.equal((await response.json()).commandId, firstId);
  assert.deepEqual(h.calls, [["scope", identity], ["send", studentId]]);
});

test("teacher send route rejects unauthenticated, student, impersonated, cross-origin and malformed requests before mutation", async () => {
  const request = (body: string, headers?: HeadersInit) => new Request("https://school.example/api/class/summons/send", { method: "POST", headers, body });
  for (const [identity, status] of [[null, 401], [{ userId: studentId, role: "STUDENT", name: "Student" }, 403],
    [{ userId: teacherId, role: "TEACHER", name: "Teacher", impersonatedBy: { teacherId: otherTeacherId, teacherName: "Other" } }, 403]] as const) {
    const h = sendRouteHarness(identity);
    assert.equal((await h.POST(request(JSON.stringify({ studentId })))).status, status);
    assert.equal(h.calls.length, 0);
  }
  const h = sendRouteHarness({ userId: teacherId, role: "TEACHER", name: "Teacher" });
  const attackHeaders: HeadersInit[] = [{ Origin: "https://evil.example" }, { Origin: "invalid" }, { "Sec-Fetch-Site": "cross-site" }];
  for (const headers of attackHeaders) assert.equal((await h.POST(request(JSON.stringify({ studentId }), headers))).status, 403);
  for (const body of ["bad-json", "null", "[]", "{}", JSON.stringify({ studentId: "not-a-uuid" }), JSON.stringify({ studentId: 123 })]) {
    assert.equal((await h.POST(request(body))).status, 400);
  }
  assert.equal(h.calls.length, 0);
});

test("HTTP send reuses actual action's exact selected-student and atomic selection-race protection", async () => {
  const identity: Session = { userId: teacherId, role: "TEACHER", name: "Teacher" };
  for (const concurrentChange of [false, true]) {
    const native = harness({ selected: concurrentChange ? studentId : otherStudentId });
    if (concurrentChange) native.beforeUpdate(() => { native.people[0].classWithId = otherStudentId; });
    const route = sendRouteHarness(identity, native.summonStudentToClassAction);
    const response = await route.POST(new Request("https://school.example/api/class/summons/send", { method: "POST", body: JSON.stringify({ studentId }) }));
    assert.equal(response.status, 409);
    assert.ok((await response.json()).error);
    assert.equal(native.focus.enterClassCommand, undefined);
    assert.equal(native.events.length, 0);
  }
});
