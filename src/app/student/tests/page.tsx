import { notFound } from "next/navigation";
import { getSession } from "@/lib/session";
import { getDict } from "@/lib/i18n/server";
import { testHomeworkCardsAction } from "@/lib/actions/tests";
import { AssignedTestsList } from "@/components/tests/assigned-tests-list";
import { TestsLiveList } from "@/components/tests/tests-live-list";

export default async function StudentTestsPage() {
  const session = await getSession();
  if (session?.role !== "STUDENT") notFound();
  const [items, { locale }] = await Promise.all([testHomeworkCardsAction(), getDict()]);
  return <><TestsLiveList userId={session.userId} /><AssignedTestsList items={items} locale={locale} /></>;
}
