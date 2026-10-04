import Link from "next/link";
import { myInteractiveHomeworkAction } from "@/lib/actions/lesson-homework";
import { myWordDeckHomeworkAction } from "@/lib/actions/word-deck";
import { getDict } from "@/lib/i18n/server";
import { IconCheckCircle } from "@/components/icons";

export default async function StudentHomeworkPage() {
  const [items, games, { t }] = await Promise.all([
    myInteractiveHomeworkAction(),
    myWordDeckHomeworkAction(),
    getDict(),
  ]);

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-black text-content">{t.nav.homework}</h1>
        <p className="mt-1 text-sm text-muted">{t.interactiveHomework.pageHint}</p>
      </div>

      {items.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2">
          {items.map((item) => (
            <Link key={item.id} href={`/student/lessons/${item.id}?section=homework`} className="rounded-2xl bg-surface p-5 ring-1 ring-line transition hover:-translate-y-0.5 hover:ring-accent">
              <p className="text-[10px] font-black uppercase tracking-[.16em] text-accent">{t.interactiveHomework.eyebrow}</p>
              <p className="mt-1 font-black text-content">{item.title}</p>
              <p className="mt-3 text-xs font-bold text-muted">{t.wordDeck.openHomework} →</p>
            </Link>
          ))}
        </div>
      )}

      {games.length > 0 && (
        <section>
          <div className="mb-3 flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-cyan-500/10 text-2xl">🎮</span>
            <div>
              <h2 className="text-lg font-black text-content">{t.wordDeck.homeworkActivities}</h2>
              <p className="text-xs text-muted">{t.wordDeck.homeworkActivitiesHint}</p>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {games.map((game) => {
              const finished = game.attempts.length;
              const status = game.status === "RUNNING"
                ? t.wordDeck.homeworkStarted
                : finished > 0 || game.status === "DONE"
                  ? t.wordDeck.homeworkFinishedTimes.replace("{n}", String(Math.max(1, finished)))
                  : t.wordDeck.homeworkNotStarted;
              return (
                <Link key={game.id} href={`/student/homework/games/${game.id}`} className="group rounded-2xl bg-surface p-5 ring-1 ring-line transition hover:-translate-y-0.5 hover:ring-accent">
                  <div className="flex items-start gap-3">
                    <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-cyan-500/10 text-2xl">{game.settings.gameType === "SPELLING" ? "🔤" : game.settings.gameType === "GUESS_PICTURE" ? "🖼️" : "♠"}</span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-black text-content">{game.title}</p>
                      <p className="mt-1 text-xs font-bold text-muted">{game.cards.length} {t.wordDeck.cardsShort}</p>
                    </div>
                    <span className="max-w-28 rounded-full bg-accent-soft px-2 py-1 text-center text-[9px] font-black uppercase leading-tight text-accent">
                      {status}
                    </span>
                  </div>
                  {game.attempts.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {game.attempts.map((attempt, index) => (
                        <span key={`${attempt.finishedAt}:${index}`} className="rounded-lg bg-surface-2 px-2 py-1 text-[10px] font-bold text-muted">
                          #{index + 1} · {formatDuration(attempt.durationMs)}
                        </span>
                      ))}
                    </div>
                  )}
                  <p className="mt-4 text-xs font-black text-accent">{t.wordDeck.openHomework} →</p>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {items.length === 0 && games.length === 0 && <div className="rounded-2xl bg-surface p-8 text-center ring-1 ring-line">
        <IconCheckCircle className="mx-auto h-10 w-10 text-emerald-500" />
        <p className="mt-3 text-sm font-bold text-content">{t.interactiveHomework.nothingAssigned}</p>
      </div>}
    </div>
  );
}

function formatDuration(milliseconds: number) {
  const totalSeconds = Math.max(0, Math.round(milliseconds / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}
