/** Read-only local-build checks. No real homework is assigned or changed. */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { config } from "dotenv";
import { Pool } from "pg";
import { SignJWT } from "jose";
import { HOMEWORK_MEDIA_KEY, isHomeworkMediaSelection } from "../src/lib/homework-media";

async function main() {
  const base = process.argv[2] ?? "http://localhost:3127";
  assert.ok(["localhost", "127.0.0.1"].includes(new URL(base).hostname), "Checks must stay on the local build");
  const loaded = config({ path: ".env.production.local", quiet: true });
  assert.ok(loaded.parsed?.NEON_DATABASE_URL && loaded.parsed?.SESSION_SECRET);
  const connection = new URL(loaded.parsed.NEON_DATABASE_URL);
  connection.searchParams.set("sslmode", "verify-full");
  const pool = new Pool({ connectionString: connection.toString(), max: 1, connectionTimeoutMillis: 10_000, statement_timeout: 20_000 });
  try {
    const { rows: [identity] } = await pool.query(`
      select t.id as teacher_id, t.name as teacher_name, s.id as student_id, s.name as student_name,
        a.id as assignment_id, a.answers->>$1 as media
      from lesson_assignments a join lesson_units u on u.id=a.unit_id
      join users t on t.id=u.author_id join users s on s.id=a.student_id
      where t.role='TEACHER' and s.role='STUDENT' and not t.access_blocked and not s.access_blocked limit 1
    `, [HOMEWORK_MEDIA_KEY]);
    assert.ok(identity, "Need an existing active lesson for read-only access checks");
    const tokens = new Map<string, string>();
    for (const role of ["TEACHER", "STUDENT"] as const) {
      const prefix = role.toLowerCase();
      tokens.set(role, await new SignJWT({ userId: identity[`${prefix}_id`], name: identity[`${prefix}_name`], role })
        .setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime("5m")
        .sign(new TextEncoder().encode(loaded.parsed.SESSION_SECRET)));
    }
    const manifest = JSON.parse(readFileSync(".next/server/server-reference-manifest.json", "utf8"));
    const actionId = (name: string) => {
      const entry = Object.entries(manifest.node).find(([, value]) => (value as { exportedName?: string }).exportedName === name);
      assert.ok(entry, `Missing action: ${name}`);
      return entry[0];
    };
    const call = async (name: string, args: unknown[], role: "TEACHER" | "STUDENT") => {
      const response = await fetch(`${base}/${role === "TEACHER" ? "teacher/homeworks" : "student/homework"}`, {
        method: "POST", redirect: "manual", headers: {
          "Next-Action": actionId(name), "Content-Type": "text/plain;charset=UTF-8", Origin: base,
          cookie: `ewv_session=${tokens.get(role)}`,
        }, body: JSON.stringify(args),
      });
      assert.equal(response.status, 200, `Action HTTP error: ${name}`);
      const stream = await response.text();
      const line = stream.split("\n").find((item) => item.startsWith("1:"));
      assert.ok(line && !line.startsWith("1:E"), `Action failed: ${name}`);
      return JSON.parse(line.slice(2));
    };

    const sources = await call("listHomeworkLessonSourcesAction", [identity.student_id], "TEACHER");
    assert.ok(Array.isArray(sources) && sources.length > 0);
    for (const source of sources) {
      assert.ok(isHomeworkMediaSelection(source.mediaAvailable));
      assert.ok(isHomeworkMediaSelection(source.mediaSelection));
      assert.equal("transcript" in source, false, "Source list must not copy full transcripts");
      assert.equal("videoUrl" in source, false, "Source list only needs availability");
    }
    assert.deepEqual(await call("listHomeworkLessonSourcesAction", [identity.student_id], "STUDENT"), []);
    assert.ok((await call("assignInteractiveHomeworkAction", [identity.assignment_id, ["exercise-1"], { video: true, transcript: true }], "STUDENT")).error);
    assert.ok((await call("assignHomeworkFromLessonSourceAction", [{ studentId: identity.student_id, lessonId: sources[0].id, exerciseIds: ["exercise-1"], media: { video: true, transcript: true } }], "STUDENT")).error);
    assert.ok((await call("assignInteractiveHomeworkAction", [identity.assignment_id, ["exercise-1"], { video: "true", transcript: true }], "TEACHER")).error);
    assert.ok((await call("assignHomeworkFromLessonSourceAction", [{ studentId: identity.student_id, lessonId: sources[0].id, exerciseIds: ["exercise-1"], media: { video: true, transcript: "true" } }], "TEACHER")).error);
    assert.ok((await call("answerAction", [identity.assignment_id, HOMEWORK_MEDIA_KEY, JSON.stringify({ video: true, transcript: true })], "STUDENT")).error);
    const { rows: [after] } = await pool.query("select answers->>$1 as media from lesson_assignments where id=$2", [HOMEWORK_MEDIA_KEY, identity.assignment_id]);
    assert.equal(after.media, identity.media, "Rejected changes must not modify saved preferences");
    console.log(`PASS: ${sources.length} lesson sources with compact material preferences; teacher-only assignment; input validation; student tampering rejected; existing preferences unchanged.`);
  } finally { await pool.end(); }
}

main().catch((error) => { console.error(error instanceof Error ? error.message : "Verification failed"); process.exitCode = 1; });
