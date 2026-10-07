import * as Ably from "ably";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const key = process.env.ABLY_API_KEY?.trim();
  if (!key) {
    return NextResponse.json(
      { error: "Realtime is not configured" },
      { status: 503 },
    );
  }

  const client = new Ably.Rest({ key });
  const capability: Ably.TokenParams["capability"] = {
    [`user:${session.userId}`]: ["subscribe"],
    "presence:school": ["presence", "subscribe"],
  };

  // A teacher can subscribe to the currently selected student's room and to
  // future rooms without receiving publish rights. A student only sees theirs.
  if (session.role === "TEACHER") {
    capability["class:*"] = ["subscribe"];
  } else {
    capability[`class:${session.userId}`] = ["subscribe"];
  }

  const tokenRequest = await client.auth.createTokenRequest({
    clientId: session.userId,
    capability,
    ttl: 60 * 60 * 1000,
  });
  return NextResponse.json(tokenRequest, {
    headers: { "Cache-Control": "no-store" },
  });
}

