import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import test from "node:test";
import ts from "typescript";

const studentA = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const studentB = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

function snapshot(studentId: string | null) {
  return {
    studentId, lessonAssignmentId: null, view: null, partnerOnBoard: false,
    video: null, timer: null, noteFocus: null, gameReview: null,
    gameReviewNotice: null, reactions: [],
    vocabularyEvents: [{ id: "word", english: "impeccable", translation: "безупречный", createdAt: "2026-10-15T08:00:00.000Z" }],
  };
}

function harness(options: { studentId?: string | null; role?: "TEACHER" | "STUDENT" | null } = {}) {
  const session = options.role === null ? null : { userId: "self", role: options.role ?? "TEACHER" };
  const data = snapshot(options.studentId === undefined ? studentA : options.studentId);
  const syncCalls: boolean[] = [];
  const modules: Record<string, unknown> = {
    "node:crypto": { createHash },
    "drizzle-orm": { and: () => assert.fail("focus needs no extra database query"), eq: () => assert.fail("focus needs no extra database query") },
    "@/lib/db": { db: new Proxy({}, { get: () => assert.fail("focus needs no extra database query") }) },
    "@/lib/db/schema": {},
    "@/lib/class-live-access": {},
    "@/lib/session": {
      getSession: async () => session,
      withRequestSession: async (identity: unknown, run: () => unknown) => { assert.equal(identity, session); return run(); },
    },
    "@/lib/actions/class": { classSyncAction: async (onBoard: boolean) => { syncCalls.push(onBoard); return data; } },
  };
  const context = {
    exports: {} as { POST: (request: Request) => Promise<Response> }, Response, URL,
    require: (name: string) => { assert.ok(name in modules, `Unexpected dependency: ${name}`); return modules[name]; },
  };
  runInNewContext(ts.transpileModule(readFileSync("src/app/api/class/live/route.ts", "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, context);
  function request(body: unknown, origin?: string) {
    return new Request("https://example.test/api/class/live", {
      method: "POST", headers: { "Content-Type": "application/json", ...(origin ? { Origin: origin } : {}) },
      body: JSON.stringify(body),
    });
  }
  return { ...context.exports, data, syncCalls, request };
}

test("focus snapshots carry the actual student and match the requested conversation without extra reads", async () => {
  for (const role of ["TEACHER", "STUDENT"] as const) {
    const h = harness({ role });
    const response = await h.POST(h.request({ resource: "focus", id: studentA, onBoard: true }, "https://example.test"));
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("Cache-Control"), "private, no-store");
    assert.equal(response.headers.get("Vary"), "Cookie");
    const result = await response.json();
    assert.deepEqual(result.data, h.data);
    assert.equal(result.data.studentId, studentA);
    assert.deepEqual(h.syncCalls, [true]);
  }
});

test("a stale conversation poll gets an opaque, uncacheable conflict instead of another student's data", async () => {
  for (const actualStudent of [studentB, null]) {
    const h = harness({ studentId: actualStudent });
    const response = await h.POST(h.request({ resource: "focus", id: studentA }));
    assert.equal(response.status, 409);
    assert.equal(response.headers.get("Cache-Control"), "private, no-store");
    assert.equal(response.headers.get("Vary"), "Cookie");
    assert.equal(await response.text(), "");
    assert.deepEqual(h.syncCalls, [false]);
  }
});

test("legacy focus polls with an omitted or empty id remain compatible", async () => {
  for (const body of [{ resource: "focus" }, { resource: "focus", id: "" }]) {
    const h = harness();
    const response = await h.POST(h.request(body));
    assert.equal(response.status, 200);
    assert.deepEqual((await response.json()).data, h.data);
    assert.equal(h.syncCalls.length, 1);
  }
});

test("provided focus conversation ids must be UUIDs before any class sync runs", async () => {
  for (const id of ["student-a", " ", "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa", 1, false, null, {}, []]) {
    const h = harness();
    const response = await h.POST(h.request({ resource: "focus", id }));
    assert.equal(response.status, 400, JSON.stringify(id));
    assert.equal(response.headers.get("Cache-Control"), "private, no-store");
    assert.equal(await response.text(), "");
    assert.equal(h.syncCalls.length, 0);
  }
});

test("focus scope preserves authentication, same-origin validation, and malformed-input rejection", async () => {
  const anonymous = harness({ role: null });
  assert.equal((await anonymous.POST(anonymous.request({ resource: "focus", id: studentA }))).status, 401);
  assert.equal(anonymous.syncCalls.length, 0);
  const h = harness();
  for (const origin of ["https://evil.test", "not-a-url"]) {
    assert.equal((await h.POST(h.request({ resource: "focus", id: studentA }, origin))).status, 403);
  }
  for (const body of [null, {}, { resource: "unknown" }]) assert.equal((await h.POST(h.request(body))).status, 400);
  const malformed = new Request("https://example.test/api/class/live", { method: "POST", body: "{" });
  assert.equal((await h.POST(malformed)).status, 400);
  assert.equal(h.syncCalls.length, 0);
});

test("unchanged scoped snapshots keep the same version and return 204 without timestamps or body churn", async () => {
  const h = harness();
  const first = await h.POST(h.request({ resource: "focus", id: studentA, onBoard: "true" }));
  const result = await first.json();
  assert.equal(result.version, createHash("sha256").update(JSON.stringify(h.data)).digest("base64url"));
  const second = await h.POST(h.request({ resource: "focus", id: studentA, version: result.version }));
  assert.equal(second.status, 204);
  assert.equal(await second.text(), "");
  assert.equal(second.headers.get("Cache-Control"), "private, no-store");
  assert.deepEqual(h.syncCalls, [false, false]);
});

test("scope conflicts take precedence over a version for the wrong student's snapshot", async () => {
  const h = harness({ studentId: studentB });
  const version = createHash("sha256").update(JSON.stringify(h.data)).digest("base64url");
  const response = await h.POST(h.request({ resource: "focus", id: studentA, version }));
  assert.equal(response.status, 409);
  assert.equal(await response.text(), "");
});
