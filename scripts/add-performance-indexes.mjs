/** Add-only, non-blocking indexes. No lesson/user rows are changed. */
import { config } from 'dotenv';
import { Pool } from 'pg';
config({ path: '.env.production.local', quiet: true });
const pool = new Pool({ connectionString: process.env.NEON_DATABASE_URL || process.env.DATABASE_URL });
const indexes = [
  ['material_nodes_scope_owner_order_idx', 'CREATE INDEX CONCURRENTLY IF NOT EXISTS material_nodes_scope_owner_order_idx ON material_nodes (scope, owner_id, sort_order)'],
  ['material_phrases_node_order_idx', 'CREATE INDEX CONCURRENTLY IF NOT EXISTS material_phrases_node_order_idx ON material_phrases (node_id, sort_order)'],
  ['material_blocks_node_order_idx', 'CREATE INDEX CONCURRENTLY IF NOT EXISTS material_blocks_node_order_idx ON material_blocks (node_id, sort_order)'],
  ['lesson_words_unit_order_idx', 'CREATE INDEX CONCURRENTLY IF NOT EXISTS lesson_words_unit_order_idx ON lesson_words (unit_id, sort_order)'],
];
try {
  for (const [name, statement] of indexes) {
    await pool.query(statement);
    const { rows: [index] } = await pool.query('select indisvalid from pg_index where indexrelid = $1::regclass', [name]);
    if (!index?.indisvalid) throw new Error(`Invalid index: ${name}`);
    console.log(`${name}: valid`);
  }
} finally { await pool.end(); }
