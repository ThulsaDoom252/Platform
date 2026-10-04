import { SettingsPanel } from "@/components/settings-panel";
import { SecuritySettings } from "@/components/teacher/security-settings";
import { NotificationSettings } from "@/components/teacher/notification-settings";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { getSession } from "@/lib/session";
import { asc, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { notificationPolicy } from "@/lib/notifications";

export default async function SettingsPage() {
  const session = await getSession();
  if (!session || session.role !== "TEACHER") redirect("/login");

  const [[teacher], students] = await Promise.all([
    db.select({ login: users.login, role: users.role, notificationPolicy: users.notificationPolicy })
      .from(users).where(eq(users.id, session.userId)).limit(1),
    db.select({ id: users.id, name: users.name }).from(users)
      .where(eq(users.role, "STUDENT")).orderBy(asc(users.name)),
  ]);
  if (!teacher || teacher.role !== "TEACHER") redirect("/login");

  return (
    <SettingsPanel
      notifications={(
        <NotificationSettings
          policy={notificationPolicy(teacher.notificationPolicy)}
          students={students}
        />
      )}
      security={<SecuritySettings currentLogin={teacher.login} />}
    />
  );
}
