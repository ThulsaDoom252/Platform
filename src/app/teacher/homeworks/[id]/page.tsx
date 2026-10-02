import Link from "next/link";
import { notFound } from "next/navigation";
import { IconChevronLeft } from "@/components/icons";
import { InteractiveHomework } from "@/components/lessons/interactive-homework";
import {
  teacherHomeworkAssignmentsAction,
} from "@/lib/actions/lesson-homework";
import { assignedLessonAction } from "@/lib/actions/lessons";
import { getDict } from "@/lib/i18n/server";
import { assignedInteractiveHomework } from "@/lib/lesson-homework";

export default async function TeacherHomeworkReviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [items, data, { t }] = await Promise.all([
    teacherHomeworkAssignmentsAction(),
    assignedLessonAction(id),
    getDict(),
  ]);
  const item = items.find((candidate) => candidate.id === id);
  if (!item || !data) notFound();
  const assignedPlan = data.lesson.interactiveHomework
    ? assignedInteractiveHomework(data.lesson.interactiveHomework, data.answers)
    : null;

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-4">
      <Link
        href="/teacher/homeworks"
        className="flex w-fit items-center gap-1 text-[13px] font-bold text-muted transition hover:text-accent"
      >
        <IconChevronLeft className="h-4 w-4" />
        {t.teacherHomeworks.back}
      </Link>

      <header className="rounded-2xl bg-surface px-4 py-4 shadow-sm ring-1 ring-line sm:px-5">
        <p className="text-[11px] font-black uppercase tracking-[0.14em] text-accent">
          {item.studentName}
        </p>
        <h1 className="mt-1 text-xl font-black text-content">{item.title}</h1>
        <p className="mt-1 text-sm text-muted">{item.homeworkTitle}</p>
      </header>

      {assignedPlan ? (
        <InteractiveHomework
          plan={assignedPlan}
          session={{
            assignmentId: data.assignment.id,
            unitId: data.assignment.unitId,
            teacher: true,
            state: data.answers,
            canEdit: true,
          }}
        />
      ) : (
        <div className="flex flex-col gap-3">
          {data.lesson.homework.map((task, index) => (
            <section key={index} className="rounded-2xl bg-surface p-5 ring-1 ring-line">
              {task.title && <h2 className="text-sm font-black text-content">{task.title}</h2>}
              {task.text && (
                <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-muted">
                  {task.text}
                </p>
              )}
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
