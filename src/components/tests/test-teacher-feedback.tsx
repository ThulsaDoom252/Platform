"use client";

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Locale } from "@/lib/i18n";
import { HOMEWORK_RESULT_REACTIONS, type HomeworkResultReaction } from "@/lib/homework-feedback";
import { saveTestFeedbackAction } from "@/lib/actions/tests";
import { readTestTeacherFeedback, type TestTeacherFeedback } from "@/lib/tests/feedback";
import { TEST_LABELS } from "@/lib/tests/labels";
import type { TestAttempt } from "@/lib/tests/types";
import { HomeworkResultReactionBadge } from "@/components/homework-result-reaction";
import { PublicHomeworkTeacherNote } from "@/components/lessons/homework-teacher-note";

export function TestTeacherFeedbackContent({ feedback, locale }: { feedback?: TestTeacherFeedback | null; locale: Locale }) {
  const current = readTestTeacherFeedback(feedback);
  if (!current) return null;
  return <div data-test-teacher-feedback>
    <HomeworkResultReactionBadge reaction={current.manualReaction} compact />
    <PublicHomeworkTeacherNote label={TEST_LABELS[locale].teacherComment} note={current.teacherNote} />
  </div>;
}

export function TestTeacherFeedbackPanel({ assignmentId, attemptId, completed, feedback, teacher, locale, onSaved, perform = saveTestFeedbackAction }: {
  assignmentId: string; attemptId?: string | null; completed: boolean; feedback?: TestTeacherFeedback | null;
  teacher?: boolean; locale: Locale; onSaved?: (attempt: TestAttempt) => void; perform?: typeof saveTestFeedbackAction;
}) {
  const labels = TEST_LABELS[locale];
  const router = useRouter();
  const noteId = useId();
  const initial = readTestTeacherFeedback(feedback);
  const source = JSON.stringify([attemptId, initial]);
  const [override, setOverride] = useState<{ source: string; value: TestTeacherFeedback | null } | null>(null);
  const current = override?.source === source ? override.value : initial;
  const [editing, setEditing] = useState(false);
  const [reaction, setReaction] = useState<HomeworkResultReaction | null>(null);
  const [note, setNote] = useState("");
  const [error, setError] = useState(false);
  const [saved, setSaved] = useState(false);
  const [busy, startSave] = useTransition();
  if (!completed || !attemptId || !teacher && !current) return null;
  return <section className="rounded-2xl border border-line bg-surface p-4 sm:p-5">
    <h2 className="text-sm font-black text-content">{labels.teacherFeedback}</h2>
    {teacher && <p className="mt-1 text-xs leading-relaxed text-muted">{labels.feedbackHint}</p>}
    <div className="mt-3"><TestTeacherFeedbackContent feedback={current} locale={locale} /></div>
    {teacher && (editing ? <form className="mt-4" onSubmit={(event) => {
      event.preventDefault(); if (busy) return;
      setError(false); setSaved(false);
      startSave(async () => {
        try {
          const response = await perform({ assignmentId, attemptId, manualReaction: reaction, teacherNote: note });
          if (!response.ok) { setError(true); return; }
          setOverride({ source, value: response.value.teacherFeedback ?? null });
          setEditing(false); setSaved(true); onSaved?.(response.value);
          if (!onSaved) router.refresh();
        } catch { setError(true); }
      });
    }}>
      <div className="flex flex-wrap gap-2" role="group" aria-label={labels.editFeedback}>
        {HOMEWORK_RESULT_REACTIONS.map((item) => <button key={item.id} type="button" aria-pressed={reaction === item.id}
          disabled={busy} onClick={() => setReaction(item.id)} className={`min-h-10 rounded-xl border px-3 text-xs font-bold disabled:opacity-50 ${reaction === item.id ? "border-accent bg-accent-soft text-accent" : "border-line text-muted"}`}>
          <span aria-hidden>{item.emoji}</span> {item.caption}
        </button>)}
        <button type="button" aria-pressed={!reaction} disabled={busy} onClick={() => setReaction(null)} className="min-h-10 rounded-xl border border-line px-3 text-xs font-bold text-muted disabled:opacity-50">{labels.noReaction}</button>
      </div>
      <label htmlFor={noteId} className="mt-4 block text-xs font-bold text-muted">{labels.teacherComment}</label>
      <textarea id={noteId} value={note} onChange={(event) => setNote(event.target.value)} maxLength={4_000} rows={4} disabled={busy}
        className="mt-2 w-full rounded-xl border border-line bg-surface-2 p-3 text-sm text-content focus:outline-none focus:ring-2 focus:ring-accent disabled:opacity-50" />
      <div className="mt-3 flex flex-wrap gap-2"><button type="submit" disabled={busy} className="min-h-10 rounded-xl bg-accent px-4 text-xs font-bold text-white disabled:opacity-50">{busy ? labels.loading : labels.saveFeedback}</button>
        <button type="button" disabled={busy} onClick={() => { setEditing(false); setError(false); }} className="min-h-10 rounded-xl border border-line px-4 text-xs font-bold text-muted">{labels.cancel}</button></div>
    </form> : <button type="button" onClick={() => { setReaction(current?.manualReaction ?? null); setNote(current?.teacherNote ?? ""); setEditing(true); setError(false); setSaved(false); }} className="mt-3 min-h-10 rounded-xl border border-line px-3 text-xs font-bold text-accent hover:bg-accent-soft">{labels.editFeedback}</button>)}
    {error && <p role="alert" className="mt-3 text-xs text-[var(--t-rose)]">{labels.actionError}</p>}
    {saved && <p role="status" className="mt-3 text-xs text-[var(--t-emerald)]">{labels.feedbackSaved}</p>}
  </section>;
}
