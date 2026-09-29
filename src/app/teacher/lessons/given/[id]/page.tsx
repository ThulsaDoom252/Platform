import { notFound } from "next/navigation";
import Link from "next/link";
import { assignedLessonAction } from "@/lib/actions/lessons";
import { getDict } from "@/lib/i18n/server";
import { AssignedLesson } from "@/components/lessons/assigned-lesson";
import { IconChevronLeft } from "@/components/icons";

/**
 * Урок в том виде, в каком его видит конкретный ученик.
 *
 * Отсюда учитель подсвечивает места: правится закрепление, заготовка
 * остаётся нетронутой.
 */
export default async function GivenLessonPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const data = await assignedLessonAction(id);
  if (!data) notFound();

  const { t } = await getDict();

  return (
    <div className="flex flex-col gap-4">
      <Link
        href={`/teacher/lessons/${data.assignment.unitId}`}
        className="flex w-fit items-center gap-1 text-[13px] font-semibold text-muted transition hover:text-accent"
      >
        <IconChevronLeft className="h-4 w-4" />
        {data.assignment.title}
      </Link>

      <h1 className="text-xl font-bold text-content">
        {data.assignment.title} — {data.assignment.studentName}
      </h1>
      <p className="-mt-3 text-[12px] text-faint">{t.lessonUnits.onlyVocabAtFirst}</p>

      <AssignedLesson data={data} teacher />
    </div>
  );
}
