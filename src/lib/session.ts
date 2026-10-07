import "server-only";
import { cache } from "react";
import { AsyncLocalStorage } from "node:async_hooks";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";

const COOKIE_NAME = "ewv_session";

// Секрет подписи сессий обязателен: со слабым значением по умолчанию
// токен можно было бы подделать. Без .env платформа не стартует.
const secretKey = process.env.SESSION_SECRET;
if (!secretKey) {
  throw new Error(
    "Не задан SESSION_SECRET. Скопируй .env.example в .env и заполни значения.",
  );
}
const encodedKey = new TextEncoder().encode(secretKey);
const requestSession = new AsyncLocalStorage<SessionPayload>();

/** Identity is verified before this request-local scope is entered. */
export function withRequestSession<T>(session: SessionPayload, task: () => T): T {
  return requestSession.run(session, task);
}

export type SessionPayload = {
  userId: string;
  role: "TEACHER" | "STUDENT";
  name: string;
  /** Учитель, временно открывший платформу глазами ученика. */
  impersonatedBy?: {
    teacherId: string;
    teacherName: string;
  };
};

export async function createSession(payload: SessionPayload) {
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const token = await new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(expiresAt)
    .sign(encodedKey);

  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    expires: expiresAt,
    path: "/",
  });
}

// React's cache is scoped to the render request, never shared across users.
export const getSession = cache(async (): Promise<SessionPayload | null> => {
  const verified = requestSession.getStore();
  if (verified) return verified;
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, encodedKey, {
      algorithms: ["HS256"],
    });
    const session = payload as unknown as SessionPayload;
    if (session.role === "STUDENT" && !session.impersonatedBy) {
      const [student] = await db
        .select({ accessBlocked: users.accessBlocked })
        .from(users)
        .where(eq(users.id, session.userId))
        .limit(1);
      if (!student || student.accessBlocked) return null;
    }
    return session;
  } catch {
    return null;
  }
});

export async function destroySession() {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}
