import { sql, type SQLWrapper } from "drizzle-orm";
import { HOMEWORK_OVERALL_REACTION_KEY, type HomeworkResultScore } from "@/lib/homework-feedback";
import { HOMEWORK_GRADE_FEEDBACK_KEYS, HOMEWORK_GRADE_FEEDBACK_PREFIXES, isHomeworkGradeFeedbackKey } from "@/lib/lesson-homework";

/** Patch only grade/comment keys on the current row, never a stale answer snapshot. */
export function homeworkGradeFeedbackPatchSql(answers: SQLWrapper, patch: Record<string, string | null>) {
  const keys = Object.keys(patch);
  if (keys.some(key => !isHomeworkGradeFeedbackKey(key))) throw new Error("Invalid grade patch");
  const current = sql`coalesce(${answers}, '{}'::jsonb)`;
  if (!keys.length) return current;
  const values = Object.fromEntries(Object.entries(patch).filter(([, value]) => value !== null));
  return sql`(${current} - ARRAY[${sql.join(keys.map(key => sql`${key}`), sql`, `)}]::text[]) || ${JSON.stringify(values)}::jsonb`;
}

/** List cards need two counts, not every answer/word from every past attempt. */
export function revisionHomeworkScoreSql(answers: SQLWrapper) {
  return sql<HomeworkResultScore>`(
    select jsonb_build_object(
      'right', count(*) filter (where scored_answer->>'correct' = 'true'),
      'total', count(*)
    )
    from jsonb_array_elements(coalesce(${answers}, '[]'::jsonb)) as scored_answer
    where coalesce(scored_answer->>'mode', '') <> 'flashcards'
  )`;
}

/** A student saving an answer must not overwrite newer teacher grades, comments or result reactions. */
export function homeworkStateWithCurrentResultSql(answers: SQLWrapper, state: Record<string, string>) {
  const next = { ...state };
  for (const key of Object.keys(next)) if (key === HOMEWORK_OVERALL_REACTION_KEY || isHomeworkGradeFeedbackKey(key)) delete next[key];
  const current = sql`coalesce(${answers}, '{}'::jsonb)`;
  const exact = [HOMEWORK_OVERALL_REACTION_KEY, ...HOMEWORK_GRADE_FEEDBACK_KEYS];
  const conditions = [sql`feedback_entry.key = ANY(ARRAY[${sql.join(exact.map(key => sql`${key}`), sql`, `)}]::text[])`,
    ...HOMEWORK_GRADE_FEEDBACK_PREFIXES.map(prefix => sql`left(feedback_entry.key, ${prefix.length}) = ${prefix}`)];
  return sql`${JSON.stringify(next)}::jsonb || coalesce((
    select jsonb_object_agg(feedback_entry.key, feedback_entry.value)
    from jsonb_each(${current}) as feedback_entry
    where ${sql.join(conditions, sql` OR `)}
  ), '{}'::jsonb)`;
}
