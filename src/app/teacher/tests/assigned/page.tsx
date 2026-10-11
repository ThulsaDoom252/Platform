import { notFound } from "next/navigation";
import { getSession } from "@/lib/session";
import { getDict } from "@/lib/i18n/server";
import { testHomeworkCardsAction } from "@/lib/actions/tests";
import { AssignedTestsList } from "@/components/tests/assigned-tests-list";
import { TestsLiveList } from "@/components/tests/tests-live-list";
import { TestsWorkspaceNav } from "@/components/tests/tests-workspace-nav";

export default async function TeacherAssignedTestsPage() {
  const session = await getSession();
  if (session?.role !== "TEACHER") notFound();
  const [items, { locale }] = await Promise.all([testHomeworkCardsAction(), getDict()]);
  return <><TestsLiveList userId={session.userId} /><TestsWorkspaceNav /><AssignedTestsList items={items} locale={locale} teacher /></>;
}
