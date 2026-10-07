import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { attachDatabasePool } from "@vercel/functions";
import * as schema from "./schema";

const globalDb = globalThis as typeof globalThis & { lingoraPool?: Pool };
const pool = globalDb.lingoraPool ?? new Pool({
  connectionString: process.env.DATABASE_URL,
  connectionTimeoutMillis: 10_000,
  idleTimeoutMillis: 30_000,
  allowExitOnIdle: true,
});
if (!globalDb.lingoraPool) {
  attachDatabasePool(pool);
  globalDb.lingoraPool = pool;
}

export const db = drizzle(pool, { schema });
