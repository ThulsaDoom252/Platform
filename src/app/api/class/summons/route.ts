import { getSession } from "@/lib/session";
import { acknowledgeStudentClassSummons, readStudentClassSummons } from "@/lib/class-summons-server";
import { isClassSummonsId } from "@/lib/class-summons";

export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store", Vary: "Cookie" };

export async function GET() {
  const session = await getSession();
  if (!session) return new Response(null, { status: 401, headers });
  if (session.role !== "STUDENT" || session.impersonatedBy) return new Response(null, { status: 403, headers });
  return Response.json({ command: await readStudentClassSummons(session) }, { headers });
}

/** Deliberately independent of the serialized Next Server Action transport. */
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
  if (session.role !== "STUDENT" || session.impersonatedBy) return new Response(null, { status: 403, headers });
  let input: unknown;
  try { input = await request.json(); } catch { return new Response(null, { status: 400, headers }); }
  const id = input && typeof input === "object" && "commandId" in input ? input.commandId : null;
  if (!isClassSummonsId(id)) return new Response(null, { status: 400, headers });
  return Response.json({ acknowledged: await acknowledgeStudentClassSummons(session, id) }, { headers });
}
