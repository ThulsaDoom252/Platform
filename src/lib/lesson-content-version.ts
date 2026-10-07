import { sql } from "drizzle-orm";
import { lessonAssignments, lessonUnits } from "@/lib/db/schema";

/** Vocabulary edits count as content edits; marks and answers do not. */
export const lessonContentVersion = sql<string>`md5(
  ${lessonUnits.updatedAt}::text || coalesce(${lessonAssignments.contentOverride}::text, '') ||
  coalesce((select string_agg(e.key || ':' || e.value, '' order by e.key)
    from jsonb_each_text(${lessonAssignments.answers}) e
    where e.key = 'hw:plan-override' or e.key like 'hw:exercise-hidden:%'), '') ||
  coalesce((select string_agg(lw::text, '' order by lw.id) from lesson_words lw where lw.unit_id = ${lessonUnits.id}), '') ||
  coalesce((select string_agg(wa.updated_at::text, '' order by wa.id) from word_deck_activities wa where ${lessonUnits.activityIds} ? wa.id::text), '')
)`;
