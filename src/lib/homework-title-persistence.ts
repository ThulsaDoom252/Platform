import { sql, type SQLWrapper } from "drizzle-orm";
import { HOMEWORK_TITLE_KEY, normalizeHomeworkTitle } from "./homework-title";

/** Patch one metadata key on the current row; never write a stale answer snapshot. */
export function homeworkTitlePatchSql(answers: SQLWrapper, title: string | null) {
  if (title !== null && normalizeHomeworkTitle(title) !== title) throw new Error("Invalid homework title");
  const current = sql`coalesce(${answers}, '{}'::jsonb)`;
  return title === null
    ? sql`${current} - ${HOMEWORK_TITLE_KEY}`
    : sql`${current} || jsonb_build_object(${HOMEWORK_TITLE_KEY}::text, ${title}::text)`;
}
