import { sql, type SQLWrapper } from "drizzle-orm";
import { HOMEWORK_OVERALL_REACTION_KEY, type HomeworkResultScore } from "@/lib/homework-feedback";

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

/** A student saving an answer must not overwrite a teacher's newer result reaction. */
export function homeworkStateWithCurrentResultSql(answers: SQLWrapper, state: Record<string, string>) {
  const next = { ...state };
  delete next[HOMEWORK_OVERALL_REACTION_KEY];
  const current = sql`coalesce(${answers}, '{}'::jsonb)`;
  return sql`${JSON.stringify(next)}::jsonb || case
    when ${current} ? ${HOMEWORK_OVERALL_REACTION_KEY}
    then jsonb_build_object(${HOMEWORK_OVERALL_REACTION_KEY}::text, ${current}->${HOMEWORK_OVERALL_REACTION_KEY})
    else '{}'::jsonb end`;
}
