import Link from "next/link";
import { notFound } from "next/navigation";
import { RevisionAttempts } from "@/components/revision/revision-teacher-list";
import { teacherRevisionHomeworkAction } from "@/lib/actions/revision";
import { getDict } from "@/lib/i18n/server";
import { StudentPresence } from "@/components/student-presence";
import { ResetStudentHomeworkButton } from "@/components/teacher/reset-student-homework-button";
import { HomeworkActivityTransfer } from "@/components/teacher/homework-activity-transfer";
import { HomeworkFeedbackPanel } from "@/components/homework-feedback-panel";
import { latestCompletedHomeworkScore, readHomeworkFeedback } from "@/lib/homework-feedback";

export default async function TeacherRevisionHomeworkPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const [{ id }, { t }] = await Promise.all([params, getDict()]);
  const activity = await teacherRevisionHomeworkAction(id);
  if (!activity) notFound();

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href={`/teacher/homeworks?student=${encodeURIComponent(activity.studentId)}`} className="rounded-xl border border-line bg-surface px-4 py-2 text-sm font-black text-muted transition hover:border-accent hover:text-accent">
          ← {t.teacherHomeworks.backToFolders}
        </Link>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <HomeworkActivityTransfer kind="REVISION" activity={activity} />
          {(activity.status !== "LOBBY" || activity.attempts.length > 0) && (
            <ResetStudentHomeworkButton assignmentId={activity.id} kind="REVISION" labels={t.teacherHomeworks} showLabel />
          )}
          <span className="rounded-full bg-emerald-500/10 px-3 py-1.5 text-xs font-black uppercase text-emerald-500">
            {activity.attempts.length > 0
              ? t.wordDeck.homeworkFinishedTimes.replace("{n}", String(activity.attempts.length))
              : activity.status === "RUNNING"
                ? t.revision.inProgress
                : t.revision.notDone}
          </span>
        </div>
      </div>

      <section className="rounded-2xl bg-surface p-4 ring-1 ring-line sm:p-5">
        <p className="text-[10px] font-black uppercase tracking-[.16em] text-emerald-500">{t.revision.activityEyebrow}</p>
        <div className="mt-1 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-xl font-black text-content">{activity.title}</h1>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted">
              <span>{activity.studentName}</span>
              <StudentPresence studentId={activity.studentId} showLabel />
            </div>
          </div>
          <p className="text-xs font-bold text-faint">{activity.words} · {t.revision.words}</p>
        </div>
        <div className="mt-4 border-t border-line pt-2">
          {activity.attempts.length > 0 ? (
            <RevisionAttempts revisionId={activity.id} homeworkFeedback={readHomeworkFeedback(activity.homeworkFeedback)} />
          ) : (
            <p className="py-6 text-center text-sm text-faint">{t.revision.notDone}</p>
          )}
        </div>
      </section>
      <HomeworkFeedbackPanel kind="REVISION" id={activity.id} settings={activity.homeworkFeedback}
        score={latestCompletedHomeworkScore(activity.attempts)} teacher
        canAuto={activity.modes.some((mode) => mode !== "flashcards")} />
    </div>
  );
}
