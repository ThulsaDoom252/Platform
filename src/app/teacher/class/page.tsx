import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { getSession } from "@/lib/session";
import { ClassRoom } from "@/components/class/class-room";

export default async function TeacherClassPage() {
  const session = await getSession();
  if (!session || session.role !== "TEACHER") redirect("/login");

  const [me] = await db
    .select({ name: users.name })
    .from(users)
    .where(eq(users.id, session.userId))
    .limit(1);

  return <ClassRoom role="TEACHER" selfId={session.userId} selfName={me?.name ?? "Учитель"} />;
}
