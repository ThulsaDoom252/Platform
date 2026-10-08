"use server";

import { and, asc, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { getSession } from "@/lib/session";
import { classPresenceFromLastSeen, type ClassPresence } from "@/lib/presence";

export type StudentPresenceSnapshot = {
  id: string;
  presence: ClassPresence;
};

/** One lightweight beacon per layout, including during quiet realtime sessions. */
export async function platformPresenceHeartbeatAction(inClass: boolean): Promise<void> {
  const session = await getSession();
  if (!session) return;
  const now = new Date();
  const cutoff = new Date(now.getTime() - 20_000);
  const classWhere = inClass === true
    ? sql<string>`case when ${users.classWhere} = 'board' then 'board' else 'class' end`
    : null;
  const locationChanged = inClass === true
    ? sql`(${users.classWhere} is null or ${users.classWhere} not in ('class', 'board'))`
    : sql`${users.classWhere} is not null`;
  await db.update(users).set({ lastSeenAt: now, classWhere }).where(and(
    eq(users.id, session.userId),
    sql`(${users.lastSeenAt} is null or ${users.lastSeenAt} < ${cutoff} or ${locationChanged})`,
  ));
}

/** Один лёгкий запрос для всех индикаторов в кабинете учителя. */
export async function studentPresenceSnapshotAction(): Promise<StudentPresenceSnapshot[]> {
  const session = await getSession();
  if (!session || session.role !== "TEACHER") return [];

  const rows = await db
    .select({ id: users.id, lastSeenAt: users.lastSeenAt, classWhere: users.classWhere })
    .from(users)
    .where(eq(users.role, "STUDENT"))
    .orderBy(asc(users.name));
  const now = Date.now();
  return rows.map((row) => ({
    id: row.id,
    presence: classPresenceFromLastSeen(row.lastSeenAt, row.classWhere, now),
  }));
}
