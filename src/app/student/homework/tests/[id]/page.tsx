import { notFound } from "next/navigation";
import { AssignedTestView } from "@/components/tests/assigned-test-view";
import { assignedTestDetailAction } from "@/lib/actions/tests";
import { getSession } from "@/lib/session";

export default async function StudentTestPage({ params }: { params: Promise<{ id: string }> }) {
  const [{ id }, session] = await Promise.all([params, getSession()]);
  if (session?.role !== "STUDENT") notFound();
  const assignment = await assignedTestDetailAction(id);
  if (!assignment) notFound();
  return <AssignedTestView initial={assignment} userId={session.userId} />;
}
