import "server-only";

import { and, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import type { SessionPayload } from "@/lib/session";
import { isClassSummonsId, pendingClassSummons, type ClassSummonsCommand } from "@/lib/class-summons";

/** The selected teacher is checked on every read, never trusted from the client. */
export async function readStudentClassSummons(session: SessionPayload): Promise<ClassSummonsCommand | null> {
  if (session.role !== "STUDENT" || session.impersonatedBy) return null;
  const [student] = await db.select({ classFocus: users.classFocus }).from(users)
    .where(and(eq(users.id, session.userId), eq(users.role, "STUDENT"))).limit(1);
  const command = pendingClassSummons(student?.classFocus);
  if (!command) return null;
  const [teacher] = await db.select({ id: users.id }).from(users)
    .where(and(eq(users.role, "TEACHER"), eq(users.classWithId, session.userId),
      ...(command.teacherId ? [eq(users.id, command.teacherId)] : []))).limit(1);
  if (!teacher) return null;
  return { id: command.id, requestedAt: command.requestedAt, expiresAt: command.expiresAt };
}

/** A stale tab can only remove the command it actually received, never a newer one. */
export async function acknowledgeStudentClassSummons(session: SessionPayload, id: string): Promise<boolean> {
  if (session.role !== "STUDENT" || session.impersonatedBy || !isClassSummonsId(id)) return false;
  const [student] = await db.select({ classFocus: users.classFocus }).from(users)
    .where(and(eq(users.id, session.userId), eq(users.role, "STUDENT"))).limit(1);
  const command = pendingClassSummons(student?.classFocus);
  if (!command || command.id !== id) return false;
  const commandMatches = command.teacherId
    ? sql`${users.classFocus}->'enterClassCommand'->>'id' = ${id}`
    : sql`(${users.classFocus}->'enterClassCommand' is null and ${users.classFocus}->>'enterClassAt' = ${command.requestedAt})`;
  const teacherMatches = command.teacherId
    ? sql`exists (select 1 from ${users} as summon_teacher where summon_teacher.id = ${command.teacherId}::uuid and summon_teacher.role = 'TEACHER' and summon_teacher.class_with_id = ${session.userId}::uuid)`
    : sql`exists (select 1 from ${users} as summon_teacher where summon_teacher.role = 'TEACHER' and summon_teacher.class_with_id = ${session.userId}::uuid)`;
  const rows = await db.update(users).set({
    // Only navigation metadata is consumed. Presence is owned by the committed route.
    classFocus: sql`(coalesce(${users.classFocus}, '{}'::jsonb) - 'enterClassCommand') - 'enterClassAt'`,
  }).where(and(eq(users.id, session.userId), eq(users.role, "STUDENT"), commandMatches, teacherMatches,
    sql`${command.expiresAt}::timestamptz > now()`)).returning({ id: users.id });
  return rows.length > 0;
}

