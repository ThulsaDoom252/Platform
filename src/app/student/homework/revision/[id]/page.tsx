import { notFound } from "next/navigation";
import { myRevisionsAction } from "@/lib/actions/revision";
import { RevisionRunner } from "@/components/revision/revision-runner";

/**
 * Повторение слов у ученика.
 *
 * Отдельная страница, а не окно поверх домашки: задание идёт долго, и
 * закрыть его случайным кликом мимо нельзя.
 */
export default async function StudentRevisionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const card = (await myRevisionsAction()).find((r) => r.id === id);
  if (!card) notFound();

  return <RevisionRunner card={card} />;
}
