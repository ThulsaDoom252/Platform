import Link from "next/link";
import { getDict } from "@/lib/i18n/server";
import { getMaterialsTree, getOwnedTree } from "@/lib/materials";
import { MaterialsExplorer } from "@/components/materials/materials-explorer";
import { getSession } from "@/lib/session";
import { cn } from "@/lib/utils";

/**
 * Две библиотеки в одном месте: общая, которую видят ученики,
 * и личная — только для учителя.
 */
export default async function TeacherMaterialsPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  const { t } = await getDict();
  const { view } = await searchParams;
  const session = await getSession();
  const mine = view === "mine";

  const tree = mine
    ? await getOwnedTree("PERSONAL", session!.userId)
    : await getMaterialsTree();

  const tabCls = (active: boolean) =>
    cn(
      "flex h-9 items-center rounded-xl px-3.5 text-sm font-semibold transition",
      active ? "bg-accent text-white" : "text-muted hover:bg-surface-2 hover:text-content",
    );

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-content">{t.materials.title}</h1>
        <p className="mt-1 text-sm text-muted">
          {mine
            ? "Личная библиотека — ученики её не видят."
            : t.materials.teacherSubtitle}
        </p>
      </div>

      <div className="flex w-fit items-center gap-1 rounded-2xl bg-surface p-1 ring-1 ring-line">
        <Link href="/teacher/materials" className={tabCls(!mine)}>
          Общая библиотека
        </Link>
        <Link href="/teacher/materials?view=mine" className={tabCls(mine)}>
          Мои материалы
        </Link>
      </div>

      <MaterialsExplorer
        key={mine ? "mine" : "shared"}
        tree={tree}
        editable
        scope={mine ? "PERSONAL" : "MATERIAL"}
        ownerId={mine ? session!.userId : undefined}
        emptyText={
          mine
            ? "Здесь пока пусто. Создай раздел или скопируй материалы сюда через «Поделиться»."
            : undefined
        }
      />
    </div>
  );
}
