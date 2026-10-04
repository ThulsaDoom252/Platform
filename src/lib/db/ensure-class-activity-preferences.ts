import { sql } from "drizzle-orm";
import { db } from "@/lib/db";

let tableReady: Promise<void> | null = null;

/**
 * Keep fresh deployments compatible with databases where schema pushes are
 * managed outside Vercel. `IF NOT EXISTS` is safe under concurrent requests
 * and never changes existing rows.
 */
export function ensureClassActivityPreferencesTable(): Promise<void> {
  if (!tableReady) {
    tableReady = db
      .execute(sql`
        CREATE TABLE IF NOT EXISTS "class_activity_preferences" (
          "student_id" uuid PRIMARY KEY REFERENCES "users"("id") ON DELETE CASCADE,
          "teacher_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
          "activity_order" jsonb DEFAULT '[]'::jsonb NOT NULL,
          "settings" jsonb DEFAULT '{}'::jsonb NOT NULL,
          "reviews" jsonb DEFAULT '{}'::jsonb NOT NULL,
          "review_notice" jsonb,
          "updated_at" timestamp DEFAULT now() NOT NULL
        )
      `)
      .then(() => undefined)
      .catch((error) => {
        tableReady = null;
        throw error;
      });
  }
  return tableReady;
}
