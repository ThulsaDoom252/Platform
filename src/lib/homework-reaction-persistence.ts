import { sql, type SQLWrapper } from "drizzle-orm";
import {
  HOMEWORK_REACTION_PREFIX,
  type HomeworkReaction,
} from "@/lib/lesson-homework";

/** Patch the current DB value, not an earlier snapshot of a student's answers. */
export function homeworkReactionPatchSql(
  answers: SQLWrapper,
  key: string,
  reaction: HomeworkReaction | null,
) {
  const current = sql`coalesce(${answers}, '{}'::jsonb)`;
  return reaction === null
    ? sql`${current} - ${key}`
    : sql`${current} || jsonb_build_object(${key}::text, ${reaction}::text)`;
}

/** An absent key list clears every reaction, including obsolete exercise IDs. */
export function homeworkReactionsResetSql(answers: SQLWrapper, keys?: string[]) {
  const current = sql`coalesce(${answers}, '{}'::jsonb)`;
  if (keys) {
    if (keys.length === 0) return current;
    return sql`${current} - ARRAY[${sql.join(keys.map((key) => sql`${key}`), sql`, `)}]::text[]`;
  }
  return sql`coalesce((
    select jsonb_object_agg(reaction_entry.key, reaction_entry.value)
    from jsonb_each(${current}) as reaction_entry
    where left(reaction_entry.key, ${HOMEWORK_REACTION_PREFIX.length}) <> ${HOMEWORK_REACTION_PREFIX}
  ), '{}'::jsonb)`;
}
