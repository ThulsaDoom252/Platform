"use server";

import { asc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { getSession } from "@/lib/session";
import { presenceFromLastSeen, type Presence } from "@/lib/presence";

export type StudentPresenceSnapshot = {
  id: string;
  presence: Presence;
};

/** Один лёгкий запрос для всех индикаторов в кабинете учителя. */
export async function studentPresenceSnapshotAction(): Promise<StudentPresenceSnapshot[]> {
  const session = await getSession();
  if (!session || session.role !== "TEACHER") return [];

  const rows = await db
    .select({ id: users.id, lastSeenAt: users.lastSeenAt })
    .from(users)
    .where(eq(users.role, "STUDENT"))
    .orderBy(asc(users.name));
  const now = Date.now();
  return rows.map((row) => ({
    id: row.id,
    presence: presenceFromLastSeen(row.lastSeenAt, now),
  }));
}

