import { getDict } from "@/lib/i18n/server";
import { UnderConstruction } from "@/components/under-construction";

export default async function StudentStatisticsPage() {
  const { t } = await getDict();
  return <UnderConstruction title={t.studentDash.statistics} />;
}
