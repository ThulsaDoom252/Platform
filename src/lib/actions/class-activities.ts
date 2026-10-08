"use server";

import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { getSession } from "@/lib/session";
import { loadClassActivitySections, type ClassActivityLoad } from "@/lib/class-activity-load";
import { listGamesAction } from "./guess-picture";
import { listClassWordDeckActivitiesAction } from "./word-deck";
import { listClassRevisionsAction } from "./revision";
import { listClassActivityMetaAction } from "./class-games";

/** One client request; independent reads execute in parallel on the server. */
export async function listClassActivitiesAction(studentId: string): Promise<ClassActivityLoad> {
  const session = await getSession();
  if (!session || session.role !== "TEACHER") throw new Error("Only for teachers");
  const target = String(studentId ?? "");
  if (!/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(target)) {
    throw new Error("Invalid student");
  }
  const [teacher] = await db.select({ studentId: users.classWithId }).from(users)
    .where(eq(users.id, session.userId)).limit(1);
  if (teacher?.studentId !== target) throw new Error("This student is not in the current class");
  const result = await loadClassActivitySections(target, {
    queue: () => listGamesAction(target),
    decks: () => listClassWordDeckActivitiesAction(target),
    revisions: () => listClassRevisionsAction(target),
    meta: () => listClassActivityMetaAction(target),
  });
  if (result.failed.length) console.warn("Class activities could not fully load", { sections: result.failed });
  return result;
}
