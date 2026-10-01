import { notFound } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import {
  lessonAction,
  lexisNodesAction,
  vocabNodesAction,
} from "@/lib/actions/lessons";
import { LessonEditor } from "@/components/lessons/lesson-editor";
import { LessonPin } from "@/components/lessons/lesson-pin";
import { listWordDeckActivitiesAction } from "@/lib/actions/word-deck";

/** Правка заготовки урока и выдача её ученикам. */
export default async function TeacherLessonPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [lesson, vocabs, lexises, students, activities] = await Promise.all([
    lessonAction(id),
    vocabNodesAction(),
    lexisNodesAction(),
    db
      .select({ id: users.id, name: users.name, avatarUrl: users.avatarUrl })
      .from(users)
      .where(eq(users.role, "STUDENT"))
      .orderBy(asc(users.name)),
    listWordDeckActivitiesAction(),
  ]);
  if (!lesson) notFound();

  return (
    <div className="flex flex-col gap-5">
      <LessonEditor
        lesson={lesson}
        vocabs={vocabs}
        lexises={lexises}
        activities={activities}
      />
      <LessonPin
        unitId={lesson.id}
        students={students}
        kind={lesson.kind}
        regularSections={lesson.regularSections}
      />
    </div>
  );
}
