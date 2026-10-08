import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { TESTS_STORAGE_SQL } from "./tests-storage-schema";

let ready: Promise<void> | null = null;
/** Additive only; no existing lesson, homework, activity or result is changed. */
export function ensureTestsTables(): Promise<void> {
  if (!ready) ready = db.execute(sql.raw(TESTS_STORAGE_SQL))
    .then(() => undefined).catch((error) => { ready = null; throw error; });
  return ready;
}
