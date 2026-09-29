import { getDict } from "@/lib/i18n/server";
import { listLessonsAction } from "@/lib/actions/lessons";
import { LessonsList } from "@/components/lessons/lessons-list";

/**
 * Уроки учителя.
 *
 * Заготовки, а не занятия из расписания: урок собирается один раз и
 * выдаётся скольким угодно ученикам, у каждого своя копия состояния.
 */
export default async function TeacherLessonsPage() {
  const { t } = await getDict();
  const items = await listLessonsAction();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-content">{t.lessonUnits.title}</h1>
        <p className="mt-1 text-sm text-muted">{t.lessonUnits.subtitle}</p>
      </div>

      <LessonsList items={items} />
    </div>
  );
}
