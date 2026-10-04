import Link from "next/link";
import { notFound } from "next/navigation";
import { WordDeckBoard } from "@/components/game/word-deck-board";
import { teacherWordDeckHomeworkAction } from "@/lib/actions/word-deck";
import { getDict } from "@/lib/i18n/server";

export default async function TeacherActivityHomeworkPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const [{ id }, { t }] = await Promise.all([params, getDict()]);
  const activity = await teacherWordDeckHomeworkAction(id);
  if (!activity) notFound();
  const finished = activity.attempts.length;
  const status = activity.status === "RUNNING"
    ? t.wordDeck.homeworkStarted
    : finished > 0 || activity.status === "DONE"
      ? t.wordDeck.homeworkFinishedTimes.replace("{n}", String(Math.max(1, finished)))
      : t.wordDeck.homeworkNotStarted;

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href={`/teacher/homeworks?student=${encodeURIComponent(activity.studentId)}`} className="rounded-xl border border-line bg-surface px-4 py-2 text-sm font-black text-muted transition hover:border-accent hover:text-accent">
          ← {t.teacherHomeworks.backToFolders}
        </Link>
        <span className="rounded-full bg-accent-soft px-3 py-1.5 text-xs font-black uppercase text-accent">{status}</span>
      </div>

      <section className="rounded-2xl bg-surface p-4 ring-1 ring-line sm:p-5">
        <p className="text-[10px] font-black uppercase tracking-[.16em] text-accent">{t.wordDeck.homeworkActivities}</p>
        <div className="mt-1 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-xl font-black text-content">{activity.title}</h1>
            <p className="mt-1 text-sm text-muted">{activity.studentName}</p>
          </div>
          <p className="text-xs font-bold text-faint">{activity.cards.length} {t.wordDeck.cardsShort}</p>
        </div>
        {activity.attempts.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2 border-t border-line pt-4">
            {activity.attempts.map((attempt, index) => (
              <span key={`${attempt.finishedAt}:${index}`} className="rounded-xl bg-surface-2 px-3 py-2 text-xs font-black text-content ring-1 ring-line">
                {t.wordDeck.attemptTime.replace("{n}", String(index + 1))}: {formatDuration(attempt.durationMs)}
              </span>
            ))}
          </div>
        )}
      </section>

      <WordDeckBoard activity={activity} />
    </div>
  );
}

function formatDuration(milliseconds: number) {
  const totalSeconds = Math.max(0, Math.round(milliseconds / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}
