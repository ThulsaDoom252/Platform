import { sql, type SQLWrapper } from "drizzle-orm";
import { homeworkReviewedAtKey, homeworkRevisionRequestedAtKey } from "./lesson-homework";

/** Finish the current assignment atomically; never write a stale answer snapshot. */
export function homeworkDonePatchSql(answers: SQLWrapper, reviewedAt: string) {
  if (!Number.isFinite(Date.parse(reviewedAt))) throw new Error("Invalid completion timestamp");
  return sql`(coalesce(${answers}, '{}'::jsonb) - ${homeworkRevisionRequestedAtKey()}) || jsonb_build_object(${homeworkReviewedAtKey()}::text, ${reviewedAt}::text)`;
}
