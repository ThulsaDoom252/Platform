import Link from "next/link";
import { notFound } from "next/navigation";
import { WordDeckBoard } from "@/components/game/word-deck-board";
import { wordDeckHomeworkAction } from "@/lib/actions/word-deck";
import { getDict } from "@/lib/i18n/server";

export default async function StudentGameHomeworkPage({ params }: { params: Promise<{ id: string }> }) {
  const [{ id }, { t }] = await Promise.all([params, getDict()]);
  const activity = await wordDeckHomeworkAction(id);
  if (!activity) notFound();

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <Link href="/student/homework" className="rounded-xl border border-line bg-surface px-4 py-2 text-sm font-black text-muted transition hover:border-accent hover:text-accent">
          ← {t.wordDeck.backToHomework}
        </Link>
        <span className="rounded-full bg-accent-soft px-3 py-1.5 text-xs font-black text-accent">
          {t.wordDeck.progressSaved}
        </span>
      </div>
      <WordDeckBoard activity={activity} homework />
    </div>
  );
}
