import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { getSession } from "@/lib/session";
import { LoginForm } from "./login-form";
import { IconCap } from "@/components/icons";

export default async function LoginPage() {
  const session = await getSession();
  if (session) {
    // Редиректим только если пользователь из токена действительно существует,
    // иначе «протухшая» кука зациклила бы редиректы.
    const [exists] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.id, session.userId))
      .limit(1);
    if (exists) {
      redirect(session.role === "TEACHER" ? "/teacher" : "/student");
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-page px-4">
      <div className="w-full max-w-sm rounded-2xl bg-surface p-6 ring-1 ring-line shadow-sm sm:p-7">
        <div className="mb-6 flex items-center gap-3">
          <div className="grad-accent flex h-11 w-11 items-center justify-center rounded-2xl text-white shadow-md">
            <IconCap className="h-6 w-6" />
          </div>
          <div>
            <p className="text-lg font-bold leading-none text-content">Lingora</p>
            <p className="mt-1 text-[11px] font-medium tracking-wide text-faint">
              Teach · Inspire · Grow
            </p>
          </div>
        </div>
        <LoginForm />
      </div>
    </main>
  );
}
