import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

const COOKIE_NAME = "ewv_session";

// Тот же секрет, что и в src/lib/session.ts — обязателен.
const secretKey = process.env.SESSION_SECRET;
if (!secretKey) {
  throw new Error(
    "Не задан SESSION_SECRET. Скопируй .env.example в .env и заполни значения.",
  );
}
const encodedKey = new TextEncoder().encode(secretKey);

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get(COOKIE_NAME)?.value;

  let session: { role?: string } | null = null;
  if (token) {
    try {
      const { payload } = await jwtVerify(token, encodedKey, {
        algorithms: ["HS256"],
      });
      session = payload as { role?: string };
    } catch {
      session = null;
    }
  }

  const isTeacherArea = pathname.startsWith("/teacher");
  const isStudentArea = pathname.startsWith("/student");

  if ((isTeacherArea || isStudentArea) && !session) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (isTeacherArea && session?.role !== "TEACHER") {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (isStudentArea && session?.role !== "STUDENT") {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/teacher/:path*", "/student/:path*"],
};
