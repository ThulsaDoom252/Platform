import { getSession, withRequestSession } from "@/lib/session";
import { summonStudentToClassAction } from "@/lib/actions/class";

export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store", Vary: "Cookie" };
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Sending must not wait behind a teacher's unrelated Server Action autosaves. */
export async function POST(request: Request) {
  const origin = request.headers.get("Origin");
  if (request.headers.get("Sec-Fetch-Site") === "cross-site") return new Response(null, { status: 403, headers });
  if (origin) {
    try {
      if (new URL(origin).origin !== new URL(request.url).origin) return new Response(null, { status: 403, headers });
    } catch { return new Response(null, { status: 403, headers }); }
  }
  const session = await getSession();
  if (!session) return new Response(null, { status: 401, headers });
  if (session.role !== "TEACHER" || session.impersonatedBy) return new Response(null, { status: 403, headers });
  let input: unknown;
  try { input = await request.json(); } catch { return new Response(null, { status: 400, headers }); }
  const studentId = input && typeof input === "object" && "studentId" in input ? input.studentId : null;
  if (typeof studentId !== "string" || !uuid.test(studentId)) return new Response(null, { status: 400, headers });
  // Identity comes only from the verified cookie, never a teacherId in the body.
  const result = await withRequestSession(session, () => summonStudentToClassAction(studentId));
  return Response.json(result, { status: result.error ? 409 : 200, headers });
}
