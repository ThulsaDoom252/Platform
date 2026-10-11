import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getSession } from "@/lib/session";
import { getDict } from "@/lib/i18n/server";
import { testHomeworkCardsAction } from "@/lib/actions/tests";
import { TEST_LABELS } from "@/lib/tests/labels";
import { AssignedTestsList } from "@/components/tests/assigned-tests-list";
import { TestsLiveList } from "@/components/tests/tests-live-list";
import { TestsWorkspaceNav } from "@/components/tests/tests-workspace-nav";

export default async function TeacherStudentTestsPage({ params }: { params: Promise<{ studentId: string }> }) {
  const session = await getSession();
  if (session?.role !== "TEACHER") notFound();
  const { studentId } = await params;
  const [items, { locale }] = await Promise.all([testHomeworkCardsAction(studentId), getDict()]);
  if (!items.length) notFound();
  return <><TestsLiveList userId={session.userId} /><TestsWorkspaceNav /><Link href="/teacher/tests" className="mb-4 inline-flex min-h-10 items-center gap-2 rounded-xl px-2 text-xs font-bold text-muted hover:bg-surface-2 hover:text-accent"><ArrowLeft aria-hidden className="h-4 w-4" />{TEST_LABELS[locale].backTests}</Link><AssignedTestsList items={items} locale={locale} teacher studentName={items[0].studentName} /></>;
}
