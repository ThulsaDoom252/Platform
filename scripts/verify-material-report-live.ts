/** Exercise the real teacher action on a local build; every database query is read-only. */
import "dotenv/config";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { config } from "dotenv";
import { Pool } from "pg";
import { SignJWT } from "jose";
import { reportToText, reportToTextBlob, type Report } from "../src/lib/export-material";
import { visibleNodeIds } from "../src/lib/material-grants";

const loadCompiledClient = createRequire(`${process.cwd()}/package.json`);
const { createFromFetch } = loadCompiledClient("next/dist/compiled/react-server-dom-turbopack/client.node") as {
  createFromFetch: (response: Promise<Response>, options: unknown) => Promise<{ a: Promise<Report> }>;
};

async function main() {
  const base = process.argv[2] ?? "http://localhost:3127";
  assert.ok(["localhost", "127.0.0.1"].includes(new URL(base).hostname), "Authenticated checks must stay on the local build");
  const loaded = config({ path: ".env.production.local", quiet: true });
  assert.ok(loaded.parsed?.NEON_DATABASE_URL && loaded.parsed?.SESSION_SECRET);
  const connection = new URL(loaded.parsed.NEON_DATABASE_URL);
  connection.searchParams.set("sslmode", "verify-full");
  const pool = new Pool({ connectionString: connection.toString(), max: 1, connectionTimeoutMillis: 10_000, statement_timeout: 20_000 });
  try {
    const { rows: [teacher] } = await pool.query("select id,name,role from users where role='TEACHER' and not access_blocked order by created_at limit 1");
    assert.ok(teacher);
    const { rows: students } = await pool.query("select id,name,role,access_blocked from users where role='STUDENT' order by name,id");
    const { rows: nodes } = await pool.query("select id,parent_id,scope,owner_id from material_nodes where scope in ('MATERIAL','STUDENT','MISTAKE')");
    const { rows: grants } = await pool.query("select student_id,material_node_id from student_materials");
    const manifest = JSON.parse(readFileSync(".next/server/server-reference-manifest.json", "utf8"));
    const entry = Object.entries(manifest.node).find(([, value]) => (value as { exportedName?: string }).exportedName === "buildStudentReportAction");
    assert.ok(entry, "Missing report action");
    const tokenFor = async (user: { id: string; name: string; role: string }) => new SignJWT({ userId: user.id, name: user.name, role: user.role })
      .setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime("10m")
      .sign(new TextEncoder().encode(process.env.SESSION_SECRET ?? loaded.parsed!.SESSION_SECRET));
    const teacherToken = await tokenFor(teacher);
    const call = async (studentId: string, token = teacherToken, teacherView = true) => {
      const response = await fetch(`${base}/${teacherView ? `teacher/students/${studentId}/materials` : "student/materials"}`, {
        method: "POST", redirect: "manual", headers: {
          "Next-Action": entry[0], "Content-Type": "text/plain;charset=UTF-8", Origin: base,
          cookie: `ewv_session=${token}`,
        }, body: JSON.stringify([studentId]),
      });
      assert.equal(response.status, 200);
      const root = await createFromFetch(Promise.resolve(response), { serverConsumerManifest: { moduleMap: {}, serverModuleMap: null, moduleLoading: null } });
      return await root.a;
    };
    let totalPages = 0;
    let totalWords = 0;
    let totalBlocks = 0;
    let totalVerbs = 0;
    let largestTextBytes = 0;
    let firstReport: Report | null = null;
    for (const student of students) {
      const shared = nodes.filter((node) => node.scope === "MATERIAL" && node.owner_id === null);
      const visibleShared = visibleNodeIds(shared.map((node) => ({ id: node.id, parentId: node.parent_id })), grants.filter((grant) => grant.student_id === student.id).map((grant) => grant.material_node_id));
      const selectedIds = nodes.filter((node) => (node.scope === "MATERIAL" && node.owner_id === null && visibleShared.has(node.id)) || (node.owner_id === student.id && ["STUDENT", "MISTAKE"].includes(node.scope))).map((node) => node.id);
      const { rows: [counts] } = await pool.query(`select
        (select count(*)::int from material_phrases where node_id=any($1::uuid[])) as words,
        (select count(*)::int from material_blocks where node_id=any($1::uuid[])) as blocks,
        (select count(*)::int from irregular_verbs where node_id=any($1::uuid[])) as verbs
      `, [selectedIds]);
      const report = await call(student.id);
      assert.equal(report.studentName, student.name);
      assert.ok(Array.isArray(report.entries) && Array.isArray(report.meta));
      const actual = report.entries.reduce((sum, entry) => ({ words: sum.words + entry.page.phrases.length, blocks: sum.blocks + entry.page.blocks.length, verbs: sum.verbs + (entry.page.verbs?.length ?? 0) }), { words: 0, blocks: 0, verbs: 0 });
      assert.deepEqual(actual, counts, "A student's report omitted stored materials");
      const text = reportToText(report);
      assert.ok(text.includes(student.name));
      const blob = reportToTextBlob(report);
      assert.equal((await blob.text()).replace(/\r\n/g, "\n"), text);
      totalPages += report.entries.length;
      totalWords += actual.words; totalBlocks += actual.blocks; totalVerbs += actual.verbs;
      largestTextBytes = Math.max(largestTextBytes, blob.size);
      if (report.entries.length && !firstReport) firstReport = report;
    }
    const student = students.find((candidate) => !candidate.access_blocked);
    if (student) {
      const studentToken = await tokenFor(student);
      await assert.rejects(() => call(student.id, studentToken, false), "Student must not call teacher report action");
    }
    await assert.rejects(() => call("not-a-student"), "Invalid references must fail without querying a UUID column");
    assert.ok(firstReport || !totalWords);
    console.log(`PASS: ${students.length} student reports; ${totalPages} pages, ${totalWords} vocabulary entries, ${totalBlocks} grammar/lexis/tense blocks, ${totalVerbs} irregular verbs; complete UTF-8 text; largest file ${largestTextBytes} bytes; unauthorized requests rejected. No material was changed.`);
  } finally { await pool.end(); }
}

main().catch((error) => { console.error(error instanceof Error ? error.message : "Report verification failed"); process.exitCode = 1; });
