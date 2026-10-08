import { notFound } from "next/navigation";
import { assignedLessonAction } from "@/lib/actions/lessons";
import { AssignedLesson } from "@/components/lessons/assigned-lesson";
import type { LessonSection } from "@/lib/lesson-unit";
import { homeworkReminderNavigation } from "@/lib/homework-reminders";

/** Урок ученика: открыт словник, остальное — что открыл учитель. */
export default async function StudentLessonPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ section?: string; reminder?: string; exercise?: string; task?: string }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const { section } = query;
  const data = await assignedLessonAction(id);
  if (!data) notFound();
  const homeworkReminder = homeworkReminderNavigation(query, {
    exerciseIds: data.lesson.interactiveHomework?.exercises.map((exercise) => exercise.id) ?? [],
    legacyCount: data.lesson.homework.length,
    homeworkOpen: data.open.includes("homework"),
  });
  const initialSection: LessonSection | undefined =
    section === "homework" && data.open.includes("homework")
      ? "homework"
      : undefined;

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-bold text-content">{data.assignment.title}</h1>
      <AssignedLesson data={data} teacher={false} initialSection={initialSection} homeworkReminder={homeworkReminder} />
    </div>
  );
}
