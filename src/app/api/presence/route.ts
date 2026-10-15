import { getSession, withRequestSession } from "@/lib/session";
import { platformPresenceHeartbeatAction, studentPresenceSnapshotAction } from "@/lib/actions/presence";

export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store", Vary: "Cookie" };

export async function GET() {
  const session = await getSession();
  if (!session) return new Response(null, { status: 401, headers });
  if (session.role !== "TEACHER") return new Response(null, { status: 403, headers });
  return withRequestSession(session, async () => Response.json(await studentPresenceSnapshotAction(), { headers }));
}

export async function POST(request: Request) {
  const origin = request.headers.get("Origin");
  const site = request.headers.get("Sec-Fetch-Site");
  if (site === "cross-site") return new Response(null, { status: 403, headers });
  if (origin) {
    try {
      if (new URL(origin).origin !== new URL(request.url).origin) return new Response(null, { status: 403, headers });
    } catch { return new Response(null, { status: 403, headers }); }
  }
  const session = await getSession();
  if (!session) return new Response(null, { status: 401, headers });
  let input: unknown;
  try { input = await request.json(); } catch { return new Response(null, { status: 400, headers }); }
  if (!input || typeof input !== "object" || typeof (input as { inClass?: unknown }).inClass !== "boolean") {
    return new Response(null, { status: 400, headers });
  }
  await withRequestSession(session, () => platformPresenceHeartbeatAction((input as { inClass: boolean }).inClass));
  return new Response(null, { status: 204, headers });
}
