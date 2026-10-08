/** Additive migration only. Does not rewrite assignments, plans, answers or results. */
import assert from "node:assert/strict";
import { config } from "dotenv";
import { Pool } from "pg";

async function main() {
  const production = process.argv.includes("--production");
  const apply = process.argv.includes("--apply");
  const loaded = config({ path: production ? ".env.production.local" : ".env", quiet: true });
  const connectionString = production ? loaded.parsed?.NEON_DATABASE_URL : loaded.parsed?.DATABASE_URL;
  if (!connectionString) throw new Error("No database configured");
  const connection = new URL(connectionString);
  assert.notEqual(connection.hostname, "base");
  if (production) connection.searchParams.set("sslmode", "verify-full");
  const pool = new Pool({ connectionString: connection.toString(), max: 1, connectionTimeoutMillis: 10_000 });
  const client = await pool.connect();
  try {
    const columnSql = "select data_type, is_nullable, column_default from information_schema.columns where table_schema = 'public' and table_name = 'word_revision_attempts' and column_name = 'struggling_words'";
    const before = await client.query(columnSql);
    if (before.rows[0]) {
      assert.equal(before.rows[0].data_type, "jsonb");
      assert.equal(before.rows[0].is_nullable, "NO");
      assert.ok(before.rows[0].column_default?.includes("[]"));
    }
    let preserved = false;
    if (apply) {
      await client.query("begin");
      await client.query("set local lock_timeout = '5s'");
      await client.query("set local statement_timeout = '20s'");
      await client.query("lock table public.word_revision_attempts in access exclusive mode");
      const snapshotSql = `select count(*)::int as count,
        md5(coalesce(string_agg(md5((to_jsonb(a)-'struggling_words')::text), '|' order by id), '')) as fingerprint
        from public.word_revision_attempts a`;
      const snapshot = await client.query(snapshotSql);
      await client.query("alter table public.word_revision_attempts add column if not exists struggling_words jsonb not null default '[]'::jsonb");
      assert.deepEqual((await client.query(snapshotSql)).rows, snapshot.rows, "Existing attempt data changed");
      await client.query("commit");
      preserved = true;
    }
    const after = await client.query(columnSql);
    console.log(JSON.stringify({ target: production ? "production" : "local", applied: apply,
      column: after.rows[0] ?? null, ...(apply ? { existingAttemptDataPreserved: preserved } : {}) }));
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error: unknown) => {
  console.error("Revision difficult-word migration failed", { code: (error as { code?: string }).code ?? "unknown" });
  process.exitCode = 1;
});
