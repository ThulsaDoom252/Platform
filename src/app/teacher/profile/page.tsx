import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { getSession } from "@/lib/session";
import { getDict } from "@/lib/i18n/server";
import { ProfilePanel } from "@/components/profile-panel";

export default async function TeacherProfilePage() {
  const session = await getSession();
  const { t } = await getDict();

  const [me] = await db
    .select()
    .from(users)
    .where(eq(users.id, session!.userId))
    .limit(1);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-content">{t.profile.title}</h1>
        <p className="mt-1 text-sm text-muted">{t.profile.subtitle}</p>
      </div>
      <ProfilePanel
        user={{
          name: me.name,
          email: me.email,
          phone: me.phone,
          telegram: me.telegram,
          viber: me.viber,
          contactNote: me.contactNote,
          hobby: me.hobby,
          goal: me.goal,
          homeland: me.homeland,
          country: me.country,
          city: me.city,
          avatarUrl: me.avatarUrl,
          role: "TEACHER",
        }}
      />
    </div>
  );
}
