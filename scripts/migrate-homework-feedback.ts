/** Additive, idempotent migration; never rewrites assignments or attempt data. */
import { config } from "dotenv";
import { Pool } from "pg";

async function main() {
  const loaded = config({ path: ".env", quiet: true });
  const connectionString = loaded.parsed?.DATABASE_URL;
  if (!connectionString) throw new Error("No database configured in .env");
  const pool = new Pool({ connectionString, connectionTimeoutMillis: 8_000 });
  const client = await pool.connect();
  try {
    const before = await client.query<{ data_type: string }>("select data_type from information_schema.columns where table_schema = 'public' and table_name = 'word_revisions' and column_name = 'homework_feedback'");
    if (before.rows[0] && before.rows[0].data_type !== "jsonb") throw new Error("Unexpected existing column type");
    if (process.argv.includes("--apply")) {
      await client.query("begin");
      await client.query("set local lock_timeout = '5s'");
      await client.query("alter table public.word_revisions add column if not exists homework_feedback jsonb");
      await client.query("commit");
    }
    const after = await client.query<{ data_type: string; is_nullable: string }>("select data_type, is_nullable from information_schema.columns where table_schema = 'public' and table_name = 'word_revisions' and column_name = 'homework_feedback'");
    console.log(JSON.stringify({ applied: process.argv.includes("--apply"), column: after.rows[0] ?? null }));
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
