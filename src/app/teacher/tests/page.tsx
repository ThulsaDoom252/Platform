import { Suspense } from "react";
import { notFound } from "next/navigation";
import { getSession } from "@/lib/session";
import { getDict } from "@/lib/i18n/server";
import { testHomeworkCardsAction } from "@/lib/actions/tests";
import { StudentTestFolders } from "@/components/tests/student-test-folders";
import { TestsLiveList } from "@/components/tests/tests-live-list";
import { TestsLibrary } from "@/components/tests/tests-library";
import { TestsLibrarySkeleton } from "@/components/tests/tests-library-skeleton";
import { TestsWorkspaceNav } from "@/components/tests/tests-workspace-nav";

export default async function TeacherTestsPage() {
  const session = await getSession();
  if (session?.role !== "TEACHER") notFound();
  const [items, { locale }] = await Promise.all([testHomeworkCardsAction(), getDict()]);
  return <><TestsLiveList userId={session.userId} /><TestsWorkspaceNav /><Suspense fallback={<TestsLibrarySkeleton />}><TestsLibrary studentFolders={<StudentTestFolders items={items} locale={locale} />} /></Suspense></>;
}
