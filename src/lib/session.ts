import "server-only";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

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

export async function getSession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, encodedKey, {
      algorithms: ["HS256"],
    });
    return payload as unknown as SessionPayload;
  } catch {
    return null;
  }
}

export async function destroySession() {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}
