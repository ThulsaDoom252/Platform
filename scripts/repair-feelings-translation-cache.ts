/** Repair only known English copies in the exact Feelings lesson's RU machine cache. */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { config } from "dotenv";
import { Pool } from "pg";

const UNIT_ID = "b445f24f-113f-4e62-8ad5-7c146f9776a5";
const AUTHOR_ID = "324718ca-f381-4478-9555-2eff9f857528";
const reviewed = new Map([
  ["freak out", "паниковать; терять самообладание"],
  ["cringe", "испытывать неловкость; ёжиться от стыда"],
  ["be flustered", "быть растерянным; волноваться и путаться"],
  ["be mortified", "сгорать от стыда; быть крайне смущённым"],
  ["crack up", "расхохотаться; рассмешить кого-то"],
  ["be overwhelmed", "быть переполненным эмоциями; не справляться с нагрузкой"],
]);
const args = process.argv.slice(2);
assert(args.every(arg => arg === "--apply" || arg.startsWith("--env=")), "Unknown argument");
const apply = args.includes("--apply");
const envFile = args.find(arg => arg.startsWith("--env="))?.slice(6) || ".env.production.local";
const env = config({ path: envFile, quiet: true }).parsed;
assert(env?.NEON_DATABASE_URL, "Production database configuration missing");
const connection = new URL(env.NEON_DATABASE_URL);
connection.searchParams.set("sslmode", "verify-full");
const pool = new Pool({ connectionString: connection.toString(), max: 1, connectionTimeoutMillis: 10_000, statement_timeout: 15_000 });

async function main() {
  const client = await pool.connect();
  try {
    await client.query(`BEGIN ISOLATION LEVEL REPEATABLE READ${apply ? "" : " READ ONLY"}`);
    if (apply) await client.query("SET LOCAL lock_timeout='5s'");
    const { rows: units } = await client.query("SELECT title FROM lesson_units WHERE id=$1 AND author_id=$2", [UNIT_ID, AUTHOR_ID]);
    assert.equal(units.length, 1, "Exact teacher's Feelings lesson missing");
    assert.equal(units[0].title, "C1 · Feelings and emotions");
    const { rows: words } = await client.query<{ word: string; translation: string }>(
      "SELECT word,translation FROM lesson_words WHERE unit_id=$1 ORDER BY sort_order", [UNIT_ID],
    );
    assert.equal(words.length, 16);
    assert(words.every(word => /[\u0400-\u04ff]/.test(word.translation)), "Base vocabulary changed; review required");
    assert([...reviewed.keys()].every(word => words.some(saved => saved.word === word)), "Expected headwords missing");
    const { rows: students } = await client.query<{ student_id: string }>(
      "SELECT DISTINCT student_id FROM lesson_assignments WHERE unit_id=$1", [UNIT_ID],
    );
    const candidates = students.flatMap(student => words.filter(word => reviewed.has(word.word)).map(word => ({
      id: createHash("sha256").update(JSON.stringify([
        student.student_id, "RU", word.word, "EN",
        `English learning item: ${word.word}. Existing translation (sense/context only): ${word.translation}`,
      ])).digest("hex"),
      studentId: student.student_id, word: word.word, translation: reviewed.get(word.word)!,
    })));
    const { rows: cached } = await client.query<{ id: string; student_id: string; language: string; translation: string; created_at: Date }>(
      `SELECT * FROM student_learning_translations WHERE id=ANY($1::text[]) ${apply ? "FOR UPDATE" : ""}`, [candidates.map(row => row.id)],
    );
    const changes = cached.flatMap(row => {
      const candidate = candidates.find(candidate => candidate.id === row.id)!;
      assert.equal(row.student_id, candidate.studentId);
      assert.equal(row.language, "RU");
      // Idempotent: leave every human edit or already-localized value intact.
      return row.translation === candidate.word ? [{ before: row, after: candidate }] : [];
    });
    const fingerprints = async () => {
      const result: string[] = [];
      for (const [table, column] of [["lesson_units", "id"], ["lesson_words", "unit_id"], ["lesson_assignments", "unit_id"]]) {
        const { rows } = await client.query(`SELECT md5(COALESCE(jsonb_agg(to_jsonb(t) ORDER BY id)::text,'')) AS digest FROM ${table} t WHERE ${column}=$1`, [UNIT_ID]);
        result.push(rows[0].digest);
      }
      return result;
    };
    const before = await fingerprints();
    if (apply && changes.length) {
      const directory = resolve("backups");
      mkdirSync(directory, { recursive: true });
      const backup = resolve(directory, `feelings-translation-cache-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
      writeFileSync(backup, JSON.stringify({ lessonId: UNIT_ID, changes }, null, 2), { flag: "wx", mode: 0o600 });
      console.log(JSON.stringify({ backup }));
      for (const change of changes) {
        const result = await client.query(`UPDATE student_learning_translations SET translation=$1
          WHERE id=$2 AND student_id=$3 AND language='RU' AND translation=$4`,
        [change.after.translation, change.before.id, change.before.student_id, change.before.translation]);
        assert.equal(result.rowCount, 1, "Cache changed concurrently; rolling back");
      }
      const { rows: saved } = await client.query("SELECT id,translation FROM student_learning_translations WHERE id=ANY($1::text[])", [changes.map(change => change.before.id)]);
      assert(changes.every(change => saved.some(row => row.id === change.before.id && row.translation === change.after.translation)));
    }
    assert.deepEqual(await fingerprints(), before, "Lesson, assignments or learner history changed; rolling back");
    await client.query(apply ? "COMMIT" : "ROLLBACK");
    console.log(JSON.stringify({ mode: apply ? "applied" : "dry-run", lessonId: UNIT_ID,
      changedEntries: changes.length, translations: changes.map(change => ({ word: change.after.word, translation: change.after.translation })),
      baseVocabularyUnchanged: true, assignmentsAndLearnerHistoryUnchanged: true, notificationsSent: false }));
  } catch (error) { await client.query("ROLLBACK"); throw error; }
  finally { client.release(); }
}

main().catch((error: { name?: string; message?: string; code?: string }) => {
  console.error({ stage: "feelings-translation-cache", type: error.name, code: error.code, message: error.name === "AssertionError" ? error.message : undefined });
  process.exitCode = 1;
}).finally(() => pool.end());
