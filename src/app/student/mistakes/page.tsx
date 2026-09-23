import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { getSession } from "@/lib/session";
import { getDict } from "@/lib/i18n/server";
import { getMistakesTree } from "@/lib/materials";
import { MaterialsExplorer } from "@/components/materials/materials-explorer";

export default async function StudentMistakesPage() {
  const session = await getSession();
  const { t } = await getDict();
  const tree = await getMistakesTree(session!.userId);

  const [me] = await db
    .select({ allowExport: users.allowExport })
    .from(users)
    .where(eq(users.id, session!.userId))
    .limit(1);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-content">{t.mistakes.title}</h1>
        <p className="mt-1 text-sm text-muted">{t.mistakes.subtitle}</p>
      </div>
      <MaterialsExplorer
        tree={tree}
        emptyText={t.mistakes.empty}
        canExport={me?.allowExport ?? false}
      />
    </div>
  );
}
