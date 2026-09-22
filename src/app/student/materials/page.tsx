import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { getSession } from "@/lib/session";
import { getDict } from "@/lib/i18n/server";
import { getStudentLibrary } from "@/lib/materials";
import { MaterialsExplorer } from "@/components/materials/materials-explorer";

export default async function StudentMaterialsPage() {
  const session = await getSession();
  const { t } = await getDict();
  // Своё личное дерево плюс открытые разделы общей базы.
  const tree = await getStudentLibrary(session!.userId);

  const [me] = await db
    .select({ progress: users.progressPercent })
    .from(users)
    .where(eq(users.id, session!.userId))
    .limit(1);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-content">{t.materials.title}</h1>
        <p className="mt-1 text-sm text-muted">{t.materials.subtitle}</p>
      </div>
      <MaterialsExplorer tree={tree} progress={me?.progress ?? 0} />
    </div>
  );
}
