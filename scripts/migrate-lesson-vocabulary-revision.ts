/** Additive and read-only unless --apply; existing homework and attempts remain unchanged. */
import assert from "node:assert/strict";
import { config } from "dotenv";
import { Pool } from "pg";

async function main() {
  const args = process.argv.slice(2);
  assert(args.every(arg => arg === "--apply" || arg.startsWith("--env=")), "Unknown argument");
  const envFile = args.find(arg => arg.startsWith("--env="))?.slice(6) ?? ".env.production.local";
  const env = config({ path: envFile, quiet: true }).parsed;
  assert(env?.NEON_DATABASE_URL, "Production database configuration missing");
  const connection = new URL(env.NEON_DATABASE_URL); connection.searchParams.set("sslmode", "verify-full");
  const pool = new Pool({ connectionString: connection.toString(), max: 1, connectionTimeoutMillis: 10_000, statement_timeout: 15_000 });
  const client = await pool.connect();
  try {
    const fingerprint = async () => (await client.query(`SELECT count(*)::int AS count, md5(COALESCE(string_agg(md5((to_jsonb(t)-'words_snapshot')::text),'|' ORDER BY id),'')) AS digest FROM public.word_revisions t`)).rows;
    if (args.includes("--apply")) {
      await client.query("BEGIN");
      await client.query("SET LOCAL lock_timeout='3s'");
      await client.query("LOCK TABLE public.word_revisions IN ACCESS EXCLUSIVE MODE");
      const before = await fingerprint();
      await client.query("ALTER TABLE public.word_revisions ADD COLUMN IF NOT EXISTS words_snapshot jsonb");
      assert.deepEqual(await fingerprint(), before, "Existing homework changed; rolling back");
      await client.query("COMMIT");
    }
    const { rows } = await client.query("SELECT udt_name,is_nullable FROM information_schema.columns WHERE table_schema='public' AND table_name='word_revisions' AND column_name='words_snapshot'");
    console.log(JSON.stringify({ applied: args.includes("--apply"), column: rows[0] ?? null, existingHomeworkPreserved: true, attemptsChanged: false }));
  } catch (error) { await client.query("ROLLBACK"); throw error; }
  finally { client.release(); await pool.end(); }
}
main().catch((error: { code?: string; name?: string }) => { console.error({ stage: "lesson-vocabulary-revision-migration", type: error.name, code: error.code }); process.exitCode = 1; });
