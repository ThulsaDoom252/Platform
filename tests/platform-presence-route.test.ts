import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import test from "node:test";
import ts from "typescript";

function harness(role: string | null) {
  const writes: unknown[][] = [], reads: unknown[] = [];
  const session = role ? { userId: "self", role } : null;
  const modules: Record<string, unknown> = {
    "@/lib/session": { getSession: async () => session, withRequestSession: async (identity: unknown, run: () => unknown) => { assert.equal(identity, session); return run(); } },
    "@/lib/actions/presence": { platformPresenceHeartbeatAction: async (...args: unknown[]) => writes.push(args),
      studentPresenceSnapshotAction: async () => { reads.push(true); return [{ id: "student", presence: "online" }]; } },
  };
  const context = { exports: {} as { GET: () => Promise<Response>; POST: (request: Request) => Promise<Response> }, Response, URL,
    require: (name: string) => { assert.ok(name in modules); return modules[name]; } };
  runInNewContext(ts.transpileModule(readFileSync("src/app/api/presence/route.ts", "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, context);
  const request = (body: unknown, origin?: string) => new Request("https://example.test/api/presence", {
    method: "POST", headers: { "Content-Type": "application/json", ...(origin ? { Origin: origin } : {}) }, body: JSON.stringify(body),
  });
  return { ...context.exports, writes, reads, request };
}

test("presence API updates only the authenticated caller's route, independently of server-action queues", async () => {
  for (const role of ["STUDENT", "TEACHER"]) {
    const h = harness(role);
    for (const inClass of [true, false]) {
      const response = await h.POST(h.request({ inClass, userId: "someone-else" }, "https://example.test"));
      assert.equal(response.status, 204);
      assert.equal(response.headers.get("Cache-Control"), "private, no-store");
    }
    assert.equal(h.writes.length, 2);
    assert.deepEqual(h.writes.map((args) => args[0]), [true, false]);
    assert.ok(h.writes.every((args) => args.length === 1));
  }
});

test("presence snapshots are teacher-only and presence writes reject invalid/cross-origin/anonymous requests", async () => {
  for (const [role, status] of [[null, 401], ["STUDENT", 403], ["TEACHER", 200]] as const) {
    const h = harness(role);
    assert.equal((await h.GET()).status, status);
    assert.equal(h.reads.length, role === "TEACHER" ? 1 : 0);
  }
  const h = harness("STUDENT");
  for (const body of [null, {}, { inClass: "true" }, { inClass: 1 }]) assert.equal((await h.POST(h.request(body))).status, 400);
  assert.equal((await h.POST(h.request({ inClass: true }, "https://evil.test"))).status, 403);
  const cross = h.request({ inClass: true }); cross.headers.set("Sec-Fetch-Site", "cross-site");
  assert.equal((await h.POST(cross)).status, 403);
  assert.equal(h.writes.length, 0);
  const anonymous = harness(null);
  assert.equal((await anonymous.POST(anonymous.request({ inClass: true }))).status, 401);
});

test("teacher sending and route presence use fixed same-origin fetches, never homework action transport", () => {
  const send = readFileSync("src/lib/class-summons-request.ts", "utf8");
  const room = readFileSync("src/components/class/class-room.tsx", "utf8");
  assert.ok(send.includes('fetch("/api/class/summons/send"'));
  assert.ok(send.includes('credentials: "same-origin", cache: "no-store"'));
  assert.ok(room.includes("await sendClassSummons(studentId)"));
  assert.ok(!room.includes("await summonStudentToClassAction("));
});
