import { config } from 'dotenv';
import { Pool } from 'pg';
config({ path: '.env.production.local', quiet: true });
const pool = new Pool({ connectionString: process.env.NEON_DATABASE_URL || process.env.DATABASE_URL });
try {
  const { rows } = await pool.query(`select c.relname as table, c.reltuples::bigint as estimated_rows,
    pg_size_pretty(pg_total_relation_size(c.oid)) as size,
    (select json_agg(indexdef) from pg_indexes i where i.schemaname='public' and i.tablename=c.relname) as indexes
    from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and c.relkind='r' and c.relname = any($1::text[]) order by c.relname`,
    [['material_nodes', 'material_phrases', 'material_blocks', 'phrase_images', 'irregular_verbs', 'lesson_words', 'lesson_assignments', 'lessons', 'notifications', 'class_messages', 'activity_games']]);
  console.log(JSON.stringify(rows, null, 2));
} finally { await pool.end(); }
