import { getDict } from "@/lib/i18n/server";
import { ComingSoon } from "@/components/teacher/coming-soon";

/** Активности: раздел заведён, наполнение — следующим шагом. */
export default async function ActivitiesPage() {
  const { t } = await getDict();
  return <ComingSoon title={t.nav.activities} description={t.comingSoon.text} />;
}
