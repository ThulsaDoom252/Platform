import Link from "next/link";
import { notFound } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { users, lessons, homework } from "@/lib/db/schema";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  formatDateTime,
  lessonStatusLabels,
  lessonStatusTone,
  homeworkStatusLabels,
  homeworkStatusTone,
} from "@/lib/format";
import {
  adjustBalanceAction,
  createLessonAction,
  updateLessonStatusAction,
  createHomeworkAction,
  updateHomeworkStatusAction,
  resetStudentPasswordAction,
} from "@/lib/actions/teacher";

export default async function StudentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [student] = await db.select().from(users).where(eq(users.id, id)).limit(1);
  if (!student || student.role !== "STUDENT") notFound();

  const studentLessons = await db
    .select()
    .from(lessons)
    .where(eq(lessons.studentId, id))
    .orderBy(asc(lessons.startTime));

  const studentHomework = await db
    .select()
    .from(homework)
    .where(eq(homework.studentId, id))
    .orderBy(asc(homework.createdAt));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
            {student.name}
          </h1>
          <p className="text-sm text-slate-500">логин: {student.login}</p>
        </div>
        <Badge tone={student.lessonBalance > 0 ? "success" : "danger"}>
          Баланс уроков: {student.lessonBalance}
        </Badge>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Баланс уроков</CardTitle>
            <CardDescription>Начисляется вручную, списывается автоматически за проведённый урок</CardDescription>
          </CardHeader>
          <CardContent className="flex gap-2">
            <form action={adjustBalanceAction}>
              <input type="hidden" name="studentId" value={student.id} />
              <input type="hidden" name="delta" value="1" />
              <Button type="submit" variant="outline" size="sm">
                + 1 урок
              </Button>
            </form>
            <form action={adjustBalanceAction}>
              <input type="hidden" name="studentId" value={student.id} />
              <input type="hidden" name="delta" value="4" />
              <Button type="submit" variant="outline" size="sm">
                + 4 урока
              </Button>
            </form>
            <form action={adjustBalanceAction}>
              <input type="hidden" name="studentId" value={student.id} />
              <input type="hidden" name="delta" value="-1" />
              <Button type="submit" variant="outline" size="sm">
                − 1 урок
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Сброс пароля</CardTitle>
            <CardDescription>Восстановление — вручную через учителя, без email</CardDescription>
          </CardHeader>
          <CardContent>
            <form action={resetStudentPasswordAction} className="flex gap-2">
              <input type="hidden" name="studentId" value={student.id} />
              <Input name="newPassword" placeholder="Новый пароль" required />
              <Button type="submit" variant="outline">
                Сохранить
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Расписание</CardTitle>
          <CardDescription>Назначение, отмена, пометка «сгорел» — полная история ниже</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <form action={createLessonAction} className="grid gap-3 sm:grid-cols-[1fr_2fr_auto] sm:items-end">
            <input type="hidden" name="studentId" value={student.id} />
            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-slate-500">Дата и время</label>
              <Input name="startTime" type="datetime-local" required />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-slate-500">Комментарий (видно ученику — включи чекбокс)</label>
              <Input name="comment" placeholder="Например: повторить неправильные глаголы" />
            </div>
            <label className="flex items-center gap-2 text-xs text-slate-500">
              <input type="checkbox" name="commentVisible" /> видно ученику
            </label>
            <Button type="submit" className="sm:col-span-3 sm:w-fit">
              Назначить урок
            </Button>
          </form>

          <div className="flex flex-col gap-2">
            {studentLessons.length === 0 && (
              <p className="text-sm text-slate-500">Уроков пока нет.</p>
            )}
            {studentLessons.map((lesson) => (
              <div
                key={lesson.id}
                className="flex flex-col gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="font-medium">{formatDateTime(lesson.startTime)}</p>
                  {lesson.teacherComment && (
                    <p className="text-xs text-slate-500">
                      {lesson.teacherComment}
                      {lesson.teacherCommentVisible ? " (видно ученику)" : " (только учителю)"}
                    </p>
                  )}
                  {lesson.cancelReason && (
                    <p className="text-xs text-amber-600 dark:text-amber-400">
                      Причина отмены: {lesson.cancelReason}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Badge tone={lessonStatusTone[lesson.status]}>
                    {lessonStatusLabels[lesson.status]}
                  </Badge>
                  {lesson.status === "SCHEDULED" && (
                    <>
                      <form action={updateLessonStatusAction}>
                        <input type="hidden" name="lessonId" value={lesson.id} />
                        <input type="hidden" name="studentId" value={student.id} />
                        <input type="hidden" name="status" value="COMPLETED" />
                        <Button type="submit" size="sm" variant="outline">
                          Провёл
                        </Button>
                      </form>
                      <form action={updateLessonStatusAction}>
                        <input type="hidden" name="lessonId" value={lesson.id} />
                        <input type="hidden" name="studentId" value={student.id} />
                        <input type="hidden" name="status" value="BURNED" />
                        <Button type="submit" size="sm" variant="destructive">
                          Сгорел
                        </Button>
                      </form>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Домашние задания</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <form action={createHomeworkAction} className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
            <input type="hidden" name="studentId" value={student.id} />
            <Input name="title" placeholder="Название задания" required />
            <Input name="description" placeholder="Описание (необязательно)" />
            <Button type="submit" className="sm:w-fit">
              Назначить ДЗ
            </Button>
          </form>

          <div className="flex flex-col gap-2">
            {studentHomework.length === 0 && (
              <p className="text-sm text-slate-500">Домашних заданий пока нет.</p>
            )}
            {studentHomework.map((hw) => (
              <div
                key={hw.id}
                className="flex flex-col gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-800"
              >
                <div className="flex items-center justify-between">
                  <p className="font-medium">{hw.title}</p>
                  <Badge tone={homeworkStatusTone[hw.status]}>
                    {homeworkStatusLabels[hw.status]}
                  </Badge>
                </div>
                {hw.description && <p className="text-slate-500">{hw.description}</p>}
                {hw.teacherFeedback && (
                  <p className="text-xs text-slate-500">Комментарий: {hw.teacherFeedback}</p>
                )}
                {(hw.status === "SUBMITTED" || hw.status === "IN_REVIEW") && (
                  <form action={updateHomeworkStatusAction} className="flex flex-wrap items-center gap-2">
                    <input type="hidden" name="homeworkId" value={hw.id} />
                    <input type="hidden" name="studentId" value={student.id} />
                    <Input name="feedback" placeholder="Комментарий (необязательно)" className="max-w-xs" />
                    <Button type="submit" name="status" value="REVIEWED" size="sm" variant="outline">
                      Принять
                    </Button>
                    <Button type="submit" name="status" value="NEEDS_REVISION" size="sm" variant="destructive">
                      На доработку
                    </Button>
                  </form>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Материалы и ошибки</CardTitle>
          <CardDescription>
            Дерево разделов: переименование, иконки, наполнение страниц из текста
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2.5">
          <Link
            href={`/teacher/students/${id}/materials`}
            className="inline-flex h-10 items-center rounded-xl bg-accent px-4 text-sm font-semibold text-white transition hover:opacity-90"
          >
            Открыть материалы
          </Link>
          <Link
            href={`/teacher/students/${id}/mistakes`}
            className="inline-flex h-10 items-center rounded-xl border border-line px-4 text-sm font-semibold text-content transition hover:bg-surface-2"
          >
            Ошибки ученика
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
