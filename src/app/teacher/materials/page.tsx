import { getDict } from "@/lib/i18n/server";
import { getMaterialsTree } from "@/lib/materials";
import { MaterialsExplorer } from "@/components/materials/materials-explorer";

export default async function TeacherMaterialsPage() {
  const { t } = await getDict();
  const tree = await getMaterialsTree();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-content">{t.materials.title}</h1>
        <p className="mt-1 text-sm text-muted">{t.materials.teacherSubtitle}</p>
      </div>
      <MaterialsExplorer tree={tree} editable />
    </div>
  );
}
