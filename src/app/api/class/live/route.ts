import { createHash } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { activityGames, lessonAssignments, lessonUnits, users } from "@/lib/db/schema";
import { getSession, withRequestSession } from "@/lib/session";
import { canReadClassDeck, canReadClassLesson } from "@/lib/class-live-access";

export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store", Vary: "Cookie" };
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** This route exposes only the same live class the authenticated user is in. */
export async function POST(request: Request) {
  const origin = request.headers.get("Origin");
  if (origin) {
    try {
      if (new URL(origin).origin !== new URL(request.url).origin) return new Response(null, { status: 403, headers });
    } catch { return new Response(null, { status: 403, headers }); }
  }
  const session = await getSession();
  if (!session) return new Response(null, { status: 401, headers });
  let input: { resource?: string; id?: string; onBoard?: boolean; version?: string };
  try { input = await request.json(); } catch { return new Response(null, { status: 400, headers }); }
  if (!input || typeof input !== "object" || !["focus", "lesson", "lesson-state", "deck"].includes(input.resource ?? "")) {
    return new Response(null, { status: 400, headers });
  }
  const id = typeof input.id === "string" ? input.id : "";
  if (input.resource !== "focus" && !uuid.test(id)) return new Response(null, { status: 400, headers });

  return withRequestSession(session, async () => {
    let data: unknown;
    if (input.resource === "focus") {
      data = await (await import("@/lib/actions/class")).classSyncAction(input.onBoard === true);
    } else {
      const [teacher] = session.role === "TEACHER" ? await db.select({ studentId: users.classWithId })
        .from(users).where(and(eq(users.id, session.userId), eq(users.role, "TEACHER"))).limit(1) : [];
      const studentId = session.role === "STUDENT" ? session.userId : teacher?.studentId;
      if (!studentId) return new Response(null, { status: 404, headers });

      if (input.resource === "deck") {
        const [row] = await db.select({ studentId: activityGames.studentId, kind: activityGames.kind })
          .from(activityGames).where(eq(activityGames.id, id)).limit(1);
        if (!row || !canReadClassDeck(session, studentId, row)) return new Response(null, { status: 404, headers });
        data = await (await import("@/lib/actions/word-deck")).classWordDeckLiveStateAction(id);
      } else if (input.resource === "lesson-state") {
        data = await (await import("@/lib/actions/lessons")).lessonLiveStateAction(id, studentId);
        if (!data) return new Response(null, { status: 404, headers });
      } else {
        const [row] = await db.select({ studentId: lessonAssignments.studentId, authorId: lessonUnits.authorId })
          .from(lessonAssignments).innerJoin(lessonUnits, eq(lessonUnits.id, lessonAssignments.unitId))
          .where(eq(lessonAssignments.id, id)).limit(1);
        if (!row || !canReadClassLesson(session, studentId, row)) return new Response(null, { status: 404, headers });
        const actions = await import("@/lib/actions/lessons");
        data = await actions.assignedLessonAction(id, "class");
      }
    }
    const body = JSON.stringify(data);
    const version = createHash("sha256").update(body).digest("base64url");
    if (input.version === version) return new Response(null, { status: 204, headers });
    return Response.json({ version, data }, { headers });
  });
}
