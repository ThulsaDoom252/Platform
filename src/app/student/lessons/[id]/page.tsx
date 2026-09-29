import { notFound } from "next/navigation";
import { assignedLessonAction } from "@/lib/actions/lessons";
import { AssignedLesson } from "@/components/lessons/assigned-lesson";

/** Урок ученика: открыт словник, остальное — что открыл учитель. */
export default async function StudentLessonPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const data = await assignedLessonAction(id);
  if (!data) notFound();

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-bold text-content">{data.assignment.title}</h1>
      <AssignedLesson data={data} teacher={false} />
    </div>
  );
}
