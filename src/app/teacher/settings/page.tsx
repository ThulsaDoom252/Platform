import { SettingsPanel } from "@/components/settings-panel";
import { SecuritySettings } from "@/components/teacher/security-settings";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { getSession } from "@/lib/session";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";

export default async function SettingsPage() {
  const session = await getSession();
  if (!session || session.role !== "TEACHER") redirect("/login");

  const [teacher] = await db
    .select({ login: users.login, role: users.role })
    .from(users)
    .where(eq(users.id, session.userId))
    .limit(1);
  if (!teacher || teacher.role !== "TEACHER") redirect("/login");

  return <SettingsPanel security={<SecuritySettings currentLogin={teacher.login} />} />;
}
