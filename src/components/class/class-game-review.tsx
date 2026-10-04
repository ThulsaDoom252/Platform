"use client";

import { useEffect, useState, useTransition } from "react";
import { useT } from "@/components/i18n-provider";
import { IconCheck, IconX } from "@/components/icons";
import { saveClassGameReviewAction } from "@/lib/actions/class-games";
import {
  CLASS_GAME_GRADES,
  classGameGradeStyle,
  type ClassGameGrade,
  type ClassGameReview,
} from "@/lib/class-game-meta";
import { cn } from "@/lib/utils";

function gradeLabel(t: ReturnType<typeof useT>["t"], grade: ClassGameGrade) {
  return grade === "GREAT"
    ? t.classRoom.gradeGreat
    : grade === "GOOD"
      ? t.classRoom.gradeGood
      : grade === "NOT_BAD"
        ? t.classRoom.gradeNotBad
        : t.classRoom.gradeRidiculous;
}

export function ClassGameReviewBadge({ review }: { review: ClassGameReview }) {
  const { t } = useT();
  const visual = classGameGradeStyle[review.grade];
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-black", visual.button)}>
      <span aria-hidden>{visual.emoji}</span>
      {gradeLabel(t, review.grade)}
    </span>
  );
}

export function ClassGameReviewBanner({
  review,
  floating = false,
  onClose,
}: {
  review: ClassGameReview;
  floating?: boolean;
  onClose?: () => void;
}) {
  const { t } = useT();
  const visual = classGameGradeStyle[review.grade];
  return (
    <section className={cn(
      "overflow-hidden rounded-2xl border p-4 shadow-xl backdrop-blur-xl",
      visual.panel,
      floating && "fixed right-4 top-20 z-[75] w-[min(26rem,calc(100vw-2rem))] animate-[fadeIn_.2s_ease-out]",
    )}>
      <div className="flex items-start gap-3">
        <span className="text-4xl drop-shadow" aria-hidden>{visual.emoji}</span>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-black uppercase tracking-[.2em] opacity-75">{t.classRoom.gameReviewTitle}</p>
          <p className="mt-0.5 text-xl font-black">{gradeLabel(t, review.grade)}</p>
          <p className="mt-0.5 truncate text-xs font-bold opacity-80">{review.title}</p>
          {review.notes && <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed opacity-90">{review.notes}</p>}
        </div>
        {onClose && (
          <button type="button" onClick={onClose} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-black/10 transition hover:bg-black/20" aria-label="Close">
            <IconX className="h-4 w-4" />
          </button>
        )}
      </div>
    </section>
  );
}

export function ClassGameReviewEditor({
  studentId,
  activityKey,
  title,
  initial,
  onClose,
  onSaved,
}: {
  studentId: string;
  activityKey: string;
  title: string;
  initial?: ClassGameReview | null;
  onClose: () => void;
  onSaved: (review: ClassGameReview) => void;
}) {
  const { t } = useT();
  const [grade, setGrade] = useState<ClassGameGrade | null>(initial?.grade ?? null);
  const [visible, setVisible] = useState(initial?.visible ?? true);
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [busy, startBusy] = useTransition();

  useEffect(() => {
    if (!saved) return;
    const timer = window.setTimeout(() => setSaved(false), 1800);
    return () => window.clearTimeout(timer);
  }, [saved]);

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/75 p-3 backdrop-blur-sm" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="w-full max-w-xl rounded-3xl bg-surface p-5 shadow-2xl ring-1 ring-line sm:p-6">
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-black uppercase tracking-[.2em] text-accent">{t.classRoom.gradeGame}</p>
            <h3 className="mt-1 truncate text-xl font-black text-content">{title}</h3>
          </div>
          <button type="button" onClick={onClose} className="flex h-9 w-9 items-center justify-center rounded-xl text-muted transition hover:bg-surface-2 hover:text-content" aria-label="Close">
            <IconX className="h-4 w-4" />
          </button>
        </div>

        <label className="mt-5 flex cursor-pointer items-center gap-3 rounded-2xl bg-accent-soft p-3 text-sm font-bold text-content ring-1 ring-accent/20">
          <input type="checkbox" checked={visible} onChange={(event) => setVisible(event.target.checked)} className="h-5 w-5 accent-[var(--accent)]" />
          <span className="flex-1">{t.classRoom.studentSeesGrade}</span>
          <span className="text-lg" aria-hidden>{visible ? "👀" : "🙈"}</span>
        </label>

        <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
          {CLASS_GAME_GRADES.map((value) => {
            const visual = classGameGradeStyle[value];
            return (
              <button
                key={value}
                type="button"
                onClick={() => setGrade(value)}
                className={cn(
                  "flex min-h-14 items-center gap-3 rounded-2xl border px-4 text-left text-sm font-black transition hover:-translate-y-0.5",
                  visual.button,
                  grade === value ? "ring-2 ring-current ring-offset-2 ring-offset-surface" : "opacity-75 hover:opacity-100",
                )}
              >
                <span className="text-2xl" aria-hidden>{visual.emoji}</span>
                <span className="flex-1">{gradeLabel(t, value)}</span>
                {grade === value && <IconCheck className="h-4 w-4" />}
              </button>
            );
          })}
        </div>

        <label className="mt-4 block">
          <span className="text-xs font-black text-content">{t.classRoom.reviewNotes}</span>
          <textarea
            value={notes}
            onChange={(event) => setNotes(event.target.value.slice(0, 1000))}
            placeholder={t.classRoom.reviewNotesPlaceholder}
            rows={4}
            className="mt-2 w-full resize-y rounded-2xl bg-surface-2 p-3 text-sm text-content ring-1 ring-line outline-none transition placeholder:text-faint focus:ring-accent"
          />
        </label>

        {error && <p className="mt-3 text-sm font-bold text-rose-500">{error}</p>}
        <button
          type="button"
          disabled={busy || !grade}
          onClick={() => grade && startBusy(async () => {
            setError(null);
            const result = await saveClassGameReviewAction({ studentId, activityKey, title, grade, notes, visible });
            if (!result.review) return setError(result.error ?? "Could not save rating");
            onSaved(result.review);
            setSaved(true);
            window.setTimeout(onClose, 550);
          })}
          className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-accent text-sm font-black text-white shadow-lg transition hover:brightness-110 disabled:opacity-40"
        >
          {saved ? <><IconCheck className="h-4 w-4" /> {t.classRoom.gradeSaved}</> : t.classRoom.saveGrade}
        </button>
      </section>
    </div>
  );
}
