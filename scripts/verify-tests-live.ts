/** Read-only against real users: exercises server actions on the LOCAL build only. */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { config } from "dotenv";
import { SignJWT } from "jose";
import { Pool } from "pg";
import { FIRST_CONDITIONAL } from "../src/lib/tests/catalog";
import { FIRST_CONDITIONAL_KEY } from "../src/lib/tests/grading";

async function main() {
  const base = process.argv[2] ?? "http://localhost:3100";
  assert.ok(["localhost", "127.0.0.1"].includes(new URL(base).hostname), "Authenticated checks must stay on the local build");
  const loaded = config({ path: ".env.production.local", quiet: true });
  assert.ok(loaded.parsed?.NEON_DATABASE_URL && loaded.parsed?.SESSION_SECRET);
  const connection = new URL(loaded.parsed.NEON_DATABASE_URL); connection.searchParams.set("sslmode", "verify-full");
  const pool = new Pool({ connectionString: connection.toString(), max: 1, connectionTimeoutMillis: 10_000 });
  try {
    const manifest = JSON.parse(readFileSync(".next/server/server-reference-manifest.json", "utf8"));
    const actionId = (name: string) => {
      const found = Object.entries(manifest.node).find(([, entry]) => (entry as { exportedName?: string }).exportedName === name);
      assert.ok(found, `Missing action ${name}`); return found[0];
    };
    const { rows } = await pool.query("select distinct on (role) id, name, role from users where not access_blocked order by role, created_at");
    const tokens = new Map<string, string>();
    for (const user of rows) tokens.set(user.role, await new SignJWT({ userId: user.id, name: user.name, role: user.role })
      .setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime("5m").sign(new TextEncoder().encode(loaded.parsed.SESSION_SECRET)));
    assert.ok(tokens.get("TEACHER") && tokens.get("STUDENT"));
    const call = async (name: string, args: unknown[], role?: string) => {
      const path = role === "STUDENT" ? "/student/homework" : "/teacher/tests/first-conditional";
      const response = await fetch(`${base}${path}`, { method: "POST", redirect: "manual", headers: {
        "Next-Action": actionId(name), "Content-Type": "text/plain;charset=UTF-8", Origin: base,
        ...(role ? { cookie: `ewv_session=${tokens.get(role)}` } : {}),
      }, body: JSON.stringify(args) });
      if (!role) { assert.equal(response.status, 307); assert.ok(response.headers.get("location")?.endsWith("/login")); return { ok: false, error: "forbidden" }; }
      assert.equal(response.status, 200, `Action ${name} HTTP error`);
      const stream = await response.text();
      for (const line of stream.split("\n")) {
        if (!/^\w+:\{/.test(line)) continue;
        const value = JSON.parse(line.slice(line.indexOf(":") + 1));
        if (typeof value.ok === "boolean") return value;
      }
      throw new Error(`No action response: ${name}`);
    };
    assert.equal((await call("checkPracticeTestAction", [FIRST_CONDITIONAL.id, { exerciseId: "exercise-1", answers: {} }])).error, "forbidden");
    assert.equal((await call("checkPracticeTestAction", [FIRST_CONDITIONAL.id, { exerciseId: "exercise-1", answers: {} }], "STUDENT")).error, "forbidden");
    const correct = Object.fromEntries(Object.entries(FIRST_CONDITIONAL_KEY["exercise-1"]).map(([id, value]) => [id, value.answer]));
    for (const [answers, expected] of [[{}, 0], [correct, 100], [{ ...correct, q1: "would give", q2: null }, 80]] as const) {
      const result = await call("checkPracticeTestAction", [FIRST_CONDITIONAL.id, { exerciseId: "exercise-1", answers }], "TEACHER");
      assert.equal(result.ok, true); assert.equal(result.value.percent, expected); assert.equal(result.value.total, 10);
    }
    for (const exercise of FIRST_CONDITIONAL.exercises.slice(1)) {
      const correctAnswers = Object.fromEntries(Object.entries(FIRST_CONDITIONAL_KEY[exercise.id]).map(([id, key]) => [id, key.answer]));
      for (const [answers, percent] of [[{}, 0], [correctAnswers, 100]] as const) {
        const result = await call("checkPracticeTestAction", [FIRST_CONDITIONAL.id, { exerciseId: exercise.id, answers }], "TEACHER");
        assert.equal(result.ok, true); assert.equal(result.value.percent, percent); assert.equal(result.value.total, exercise.questions.length);
      }
    }
    const pairAnswers = Object.fromEntries(Object.entries(FIRST_CONDITIONAL_KEY["exercise-2"]).map(([id, key]) => [id, key.answer]));
    assert.equal((await call("checkPracticeTestAction", [FIRST_CONDITIONAL.id, { exerciseId: "exercise-2", answers: { ...pairAnswers, q1: ["might get"] } }], "TEACHER")).value.percent, 90);
    assert.equal((await call("checkPracticeTestAction", [FIRST_CONDITIONAL.id, { exerciseId: "exercise-2", answers: { q1: ["might get", "get", "will get"] } }], "TEACHER")).error, "invalid");
    const textAnswers = Object.fromEntries(Object.entries(FIRST_CONDITIONAL_KEY["exercise-3"]).map(([id, key]) => [id, key.answer]));
    assert.equal((await call("checkPracticeTestAction", [FIRST_CONDITIONAL.id, { exerciseId: "exercise-3", answers: { ...textAnswers, q1: " DOESN’T ARRIVE ", q2: "’ll miss", q9: "isn’t" } }], "TEACHER")).value.percent, 100);
    assert.equal((await call("checkPracticeTestAction", [FIRST_CONDITIONAL.id, { exerciseId: "missing", answers: {} }], "TEACHER")).error, "invalid");
    assert.equal((await call("checkPracticeTestAction", [FIRST_CONDITIONAL.id, { exerciseId: "exercise-1", answers: {}, percent: 100 }], "TEACHER")).error, "invalid");
    assert.equal((await call("checkAssignedTestAction", [{ assignmentId: "00000000-0000-4000-8000-000000000001", attemptId: "00000000-0000-4000-8000-000000000002", exerciseId: "exercise-1", answers: {} }], "TEACHER")).error, "forbidden");
    assert.equal((await call("assignTestAction", [{ testId: "first-conditional", studentId: "00000000-0000-4000-8000-000000000001", exerciseIds: null, requestId: "00000000-0000-4000-8000-000000000002" }], "STUDENT")).error, "forbidden");
    // GET validates the real page output and that unsubmitted answer keys are not serialized.
    const page = await fetch(`${base}/teacher/tests/first-conditional`, { headers: { cookie: `ewv_session=${tokens.get("TEACHER")}` } });
    assert.equal(page.status, 200);
    const html = await page.text();
    assert.equal((html.match(/data-test-question=/g) ?? []).length, 10);
    assert.ok(html.includes("Check the answers"));
    assert.ok(!html.includes(FIRST_CONDITIONAL_KEY["exercise-1"].q6.reasons["does get"].en));
    console.log("PASS: all three exercises, teacher/student authorization, 0/80/90/100 scores, double choices, contractions, omissions, input validation, real page and private answer keys");
  } finally { await pool.end(); }
}
main().catch((error: unknown) => { console.error("Test integration failed", { type: (error as Error).name, message: (error as Error).message }); process.exitCode = 1; });
