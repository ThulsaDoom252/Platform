import { getDict } from "@/lib/i18n/server";
import {
  installA1AppearanceLessonAction,
  installGrammarCheckLessonAction,
  installNewDerekLessonAction,
  listLessonFoldersAction,
  listLessonsAction,
} from "@/lib/actions/lessons";
import { LessonsList } from "@/components/lessons/lessons-list";

/**
 * Уроки учителя.
 *
 * Заготовки, а не занятия из расписания: урок собирается один раз и
 * выдаётся скольким угодно ученикам, у каждого своя копия состояния.
 */
export default async function TeacherLessonsPage({
  searchParams,
}: {
  searchParams: Promise<{ install?: string }>;
}) {
  const params = await searchParams;
  if (params.install === "new-derek") {
    await installNewDerekLessonAction();
  }
  if (params.install === "grammar-check") {
    await installGrammarCheckLessonAction();
  }
  if (params.install === "a1-appearance") {
    await installA1AppearanceLessonAction();
  }
  const { t } = await getDict();
  const [items, folders] = await Promise.all([
    listLessonsAction(),
    listLessonFoldersAction(),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-content">{t.lessonUnits.title}</h1>
        <p className="mt-1 text-sm text-muted">{t.lessonUnits.subtitle}</p>
      </div>

      <LessonsList items={items} folders={folders} />
    </div>
  );
}
