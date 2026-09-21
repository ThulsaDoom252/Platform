import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { getSession } from "@/lib/session";
import { getDict } from "@/lib/i18n/server";
import { ProfilePanel } from "@/components/profile-panel";

export default async function StudentProfilePage() {
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
          contactNote: me.contactNote,
          avatarUrl: me.avatarUrl,
          role: "STUDENT",
        }}
      />
    </div>
  );
}
