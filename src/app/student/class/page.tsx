import { getDict } from "@/lib/i18n/server";
import { UnderConstruction } from "@/components/under-construction";

export default async function StudentClassPage() {
  const { t } = await getDict();
  return (
    <UnderConstruction
      title={t.studentArea.classTitle}
      description={t.studentArea.classSubtitle}
    />
  );
}
