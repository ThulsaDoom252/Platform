/** Additive, idempotent migration; never rewrites assignments or attempt data. */
import { config } from "dotenv";
import { Pool } from "pg";
import assert from "node:assert/strict";

async function main() {
  const production = process.argv.includes("--production");
  const loaded = config({ path: production ? ".env.production.local" : ".env", quiet: true });
  const connectionString = production
    ? loaded.parsed?.NEON_DATABASE_URL || loaded.parsed?.DATABASE_URL
    : loaded.parsed?.DATABASE_URL;
  if (!connectionString) throw new Error("No database configured for the selected environment");
  const connection = new URL(connectionString);
  assert(connection.hostname !== "base", "The database configuration is a placeholder");
  if (production) connection.searchParams.set("sslmode", "verify-full");
  const pool = new Pool({ connectionString: connection.toString(), connectionTimeoutMillis: 8_000 });
  const client = await pool.connect();
  try {
    const before = await client.query<{ data_type: string }>("select data_type from information_schema.columns where table_schema = 'public' and table_name = 'word_revisions' and column_name = 'homework_feedback'");
    if (before.rows[0] && before.rows[0].data_type !== "jsonb") throw new Error("Unexpected existing column type");
    if (process.argv.includes("--apply")) {
      await client.query("begin");
      await client.query("set local lock_timeout = '5s'");
      await client.query("lock table public.word_revisions in access exclusive mode");
      const fingerprintSql = `select count(*)::int as count,
        md5(coalesce(string_agg(md5((to_jsonb(r)-'homework_feedback')::text), '|' order by id), '')) as fingerprint
        from public.word_revisions r`;
      const snapshot = await client.query(fingerprintSql);
      await client.query("alter table public.word_revisions add column if not exists homework_feedback jsonb");
      const preserved = await client.query(fingerprintSql);
      assert.deepEqual(preserved.rows, snapshot.rows, "Existing revisions changed during migration");
      await client.query("commit");
    }
    const after = await client.query<{ data_type: string; is_nullable: string }>("select data_type, is_nullable from information_schema.columns where table_schema = 'public' and table_name = 'word_revisions' and column_name = 'homework_feedback'");
    console.log(JSON.stringify({ target: production ? "production" : "local", applied: process.argv.includes("--apply"), column: after.rows[0] ?? null, existingRecordsPreserved: true }));
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}
main().catch((error: unknown) => {
  // Connection errors can contain credentials. Never log them.
  console.error("Homework feedback migration failed", { code: (error as { code?: string }).code ?? "unknown" });
  process.exitCode = 1;
});
