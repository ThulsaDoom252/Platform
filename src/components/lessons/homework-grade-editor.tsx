"use client";

import { useState, useTransition } from "react";
import { useT } from "@/components/i18n-provider";
import { IconPencil } from "@/components/icons";

/** Shared teacher-only editor; the caller controls saving and public presentation. */
export function HomeworkGradeEditor({ score, teacherScore, comment, scoreLabel, onSave }: {
  score: number | null;
  teacherScore: number | null;
  comment: string;
  scoreLabel?: string;
  onSave: (score: number | null, comment: string) => Promise<string | undefined>;
}) {
  const { t } = useT();
  const labels = t.interactiveHomework;
  const [open, setOpen] = useState(false);
  const [scoreDraft, setScoreDraft] = useState("");
  const [scoreChanged, setScoreChanged] = useState(false);
  const [commentDraft, setCommentDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, startBusy] = useTransition();
  const parsed = scoreDraft.trim() ? Number(scoreDraft) : null;
  const valid = parsed === null || (Number.isInteger(parsed) && parsed >= 0 && parsed <= 100);

  function save(reset = false) {
    if (!valid && !reset) return;
    startBusy(async () => {
      setError(null);
      try {
        // Adding a note alone keeps automatic scoring live instead of freezing it.
        const nextScore = reset ? null : scoreChanged ? parsed : teacherScore;
        const failed = await onSave(nextScore, commentDraft);
        if (failed) { setError(failed); return; }
        setOpen(false);
      } catch { setError(labels.scoreSaveFailed); }
    });
  }

  if (!open) return (
    <button type="button" onClick={() => {
      setScoreDraft(String(teacherScore ?? score ?? ""));
      setScoreChanged(false);
      setCommentDraft(comment);
      setError(null);
      setOpen(true);
    }} className="mt-3 inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-line bg-surface px-3 text-xs font-black text-accent transition hover:bg-accent-soft">
      <IconPencil className="h-4 w-4" />{labels.editGrade}
    </button>
  );

  return (
    <form data-no-lesson-highlight onSubmit={event => { event.preventDefault(); save(); }}
      className="mt-3 rounded-2xl bg-surface-2 p-3 text-left ring-1 ring-line sm:p-4">
      <div className="grid gap-3 sm:grid-cols-[8rem_minmax(0,1fr)]">
        <label className="text-xs font-bold text-muted">
          {scoreLabel ?? labels.exerciseScore}
          <span className="mt-1 flex h-11 items-center rounded-xl bg-surface ring-1 ring-line focus-within:ring-accent">
            <input type="number" min={0} max={100} step={1} value={scoreDraft} disabled={busy}
              onChange={event => { setScoreDraft(event.target.value); setScoreChanged(true); }}
              className="h-full min-w-0 flex-1 bg-transparent px-3 text-base font-black text-content outline-none" />
            <span className="pr-3 text-sm text-faint">%</span>
          </span>
          <span className="mt-1 block text-[11px] font-normal">{labels.scoreOptionalHint}</span>
        </label>
        <label className="text-xs font-bold text-muted">
          {labels.teacherNote}
          <textarea rows={3} maxLength={4000} value={commentDraft} disabled={busy}
            onChange={event => setCommentDraft(event.target.value)} placeholder={labels.scoreCommentPlaceholder}
            className="mt-1 w-full resize-y rounded-xl bg-surface p-3 text-sm font-semibold text-content outline-none ring-1 ring-line focus:ring-accent" />
          <span className="mt-1 block text-[11px] font-normal">{labels.gradeNotePublic}</span>
        </label>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button type="submit" disabled={busy || !valid} className="min-h-10 rounded-xl bg-accent px-4 text-xs font-black text-white disabled:opacity-45">
          {busy ? labels.scoreSaving : labels.scoreSave}
        </button>
        <button type="button" disabled={busy} onClick={() => setOpen(false)} className="min-h-10 rounded-xl border border-line px-4 text-xs font-bold text-muted hover:text-content disabled:opacity-45">{labels.cancel}</button>
        {teacherScore !== null && <button type="button" disabled={busy} onClick={() => save(true)}
          className="min-h-10 rounded-xl border border-line px-4 text-xs font-bold text-accent hover:bg-accent-soft disabled:opacity-45">{labels.clearManualScore}</button>}
      </div>
      {error && <p role="alert" className="mt-2 text-xs font-bold text-rose-600">{error}</p>}
    </form>
  );
}
