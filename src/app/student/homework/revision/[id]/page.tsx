import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { myRevisionAction } from "@/lib/actions/revision";
import { RevisionRunner } from "@/components/revision/revision-runner";

export default async function StudentRevisionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "STUDENT") redirect("/teacher");

  const { id } = await params;
  const card = await myRevisionAction(id);
  if (!card) notFound();

  return <RevisionRunner card={card} />;
}
