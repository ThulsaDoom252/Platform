import { notFound } from "next/navigation";
import { assignedLessonAction } from "@/lib/actions/lessons";
import { AssignedLesson } from "@/components/lessons/assigned-lesson";
import type { LessonSection } from "@/lib/lesson-unit";

/** Урок ученика: открыт словник, остальное — что открыл учитель. */
export default async function StudentLessonPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ section?: string }>;
}) {
  const { id } = await params;
  const { section } = await searchParams;
  const data = await assignedLessonAction(id);
  if (!data) notFound();
  const initialSection: LessonSection | undefined =
    section === "homework" && data.open.includes("homework")
      ? "homework"
      : undefined;

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-bold text-content">{data.assignment.title}</h1>
      <AssignedLesson data={data} teacher={false} initialSection={initialSection} />
    </div>
  );
}
