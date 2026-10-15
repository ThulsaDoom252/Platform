import { sql, type SQLWrapper } from "drizzle-orm";

/** A view change must not overwrite a summon sent after its snapshot was read. */
export function preserveClassSummonsSql(current: SQLWrapper, next: Record<string, unknown> | null) {
  return sql`(${JSON.stringify(next ?? {})}::jsonb - 'enterClassCommand' - 'enterClassAt') ||
    case when ${current}->'enterClassCommand' is not null
      then jsonb_build_object('enterClassCommand', ${current}->'enterClassCommand') else '{}'::jsonb end ||
    case when ${current}->'enterClassAt' is not null
      then jsonb_build_object('enterClassAt', ${current}->'enterClassAt') else '{}'::jsonb end`;
}
