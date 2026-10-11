"use client";

import Link from "next/link";
import { useRef, useState, useTransition } from "react";
import { ArrowLeft, ClipboardCheck, History, RotateCcw } from "lucide-react";
import { useT } from "@/components/i18n-provider";
import { assignedTestDetailAction, startNewTestAttemptAction, testAttemptDetailAction, testAttemptHistoryAction } from "@/lib/actions/tests";
import { TEST_LABELS } from "@/lib/tests/labels";
import type { TestAssignmentDetail, TestAttempt } from "@/lib/tests/types";
import { useRealtimeSubscription } from "@/lib/use-realtime";
import { cn } from "@/lib/utils";
import { TestRunner } from "./test-runner";
import { TestAssignmentControls } from "./test-assignment-controls";
import { TestDeadlineBadge } from "./test-deadline-badge";

export function AssignedTestView({ initial, teacher, userId }: { initial: TestAssignmentDetail; teacher?: boolean; userId: string }) {
  const { locale } = useT();
  const labels = TEST_LABELS[locale];
  const [attempts, setAttempts] = useState(initial.attempts);
  const [dueAt, setDueAt] = useState(initial.dueAt ?? null);
  const [completed, setCompleted] = useState(!!initial.latestAttempt?.completedAt);
  const [viewed, setViewed] = useState<TestAttempt | null>(initial.latestAttempt);
  const [readOnly, setReadOnly] = useState(!!teacher);
  const [runKey, setRunKey] = useState(0);
  const [error, setError] = useState(false);
  const [busy, startAction] = useTransition();
  const [hasMore, setHasMore] = useState(initial.attempts.length === 50);
  const cache = useRef(new Map(initial.latestAttempt ? [[initial.latestAttempt.id, initial.latestAttempt]] : []));
  const liveBusy = useRef(false);
  const latestId = useRef(initial.latestAttempt?.id ?? null);
  const latestCreatedAt = useRef(initial.latestAttempt?.createdAt ?? null);
  const retryRequest = useRef<string | null>(null);

  function selectAttempt(id: string) {
    if (busy) return;
    startAction(async () => {
      setError(false);
      try {
        const attempt = cache.current.get(id) ?? await testAttemptDetailAction(initial.id, id);
        if (!attempt) { setError(true); return; }
        cache.current.set(id, attempt); setViewed(attempt); setReadOnly(!!teacher || id !== latestId.current); setRunKey((key) => key + 1);
      } catch { setError(true); }
    });
  }
  function saved(attempt: TestAttempt) {
    if (latestId.current && latestId.current !== attempt.id) { void pull(); return; }
    latestId.current = attempt.id;
    latestCreatedAt.current = attempt.createdAt;
    cache.current.set(attempt.id, attempt); setViewed(attempt);
    setCompleted(!!attempt.completedAt);
    setAttempts((current) => [attempt, ...current.filter((row) => row.id !== attempt.id)]);
  }
  function restarted(attempt: TestAttempt) {
    if (latestCreatedAt.current && new Date(attempt.createdAt) < new Date(latestCreatedAt.current)) return;
    latestId.current = attempt.id; cache.current.set(attempt.id, attempt);
    latestCreatedAt.current = attempt.createdAt;
    setViewed(attempt); setReadOnly(!!teacher); setRunKey((key) => key + 1);
    setCompleted(!!attempt.completedAt);
    setAttempts((current) => [attempt, ...current.filter((row) => row.id !== attempt.id)]);
  }
  function retry() {
    if (busy || teacher) return;
    const requestId = retryRequest.current ??= crypto.randomUUID();
    startAction(async () => {
      setError(false);
      try {
        const reply = await startNewTestAttemptAction({ assignmentId: initial.id, requestId });
        if (!reply.ok) { setError(true); if (reply.error === "stale") await pull(); return; }
        retryRequest.current = null; restarted(reply.value);
      } catch { setError(true); }
    });
  }

  // Both sides recover missed events; unchanged generations never discard student drafts.
  async function pull() {
    if (liveBusy.current) return;
    liveBusy.current = true;
    try {
      const current = await assignedTestDetailAction(initial.id);
      if (!current) return;
      if (latestCreatedAt.current && (!current.latestAttempt || new Date(current.latestAttempt.createdAt) < new Date(latestCreatedAt.current))) return;
      setDueAt(current.dueAt ?? null); setCompleted(!!current.latestAttempt?.completedAt);
      setAttempts(current.attempts); setHasMore(current.attempts.length === 50);
      if (current.latestAttempt) {
        const previous = cache.current.get(current.latestAttempt.id);
        cache.current.set(current.latestAttempt.id, current.latestAttempt);
        if (latestId.current !== current.latestAttempt.id) {
          restarted(current.latestAttempt);
        } else if (teacher && (!previous || previous.total !== current.latestAttempt.total)) {
          setViewed(current.latestAttempt); setReadOnly(true); setRunKey((key) => key + 1);
        }
      }
    } catch { setError(true); }
    finally { liveBusy.current = false; }
  }
  useRealtimeSubscription({ channel: `user:${userId}`, events: "homework-review",
    onMessage: (message) => { if (message.data?.kind === "TEST" && message.data?.id === initial.id) return pull(); },
    onFallback: pull, fallbackMs: 30_000 });

  return <div className="mx-auto flex w-full max-w-5xl flex-col gap-5">
    <div className="flex flex-wrap items-center justify-between gap-3"><Link href={teacher ? `/teacher/tests/assigned/${initial.studentId}` : "/student/tests"} className="inline-flex min-h-10 items-center gap-2 rounded-xl px-2 text-xs font-bold text-muted hover:bg-surface-2 hover:text-accent"><ArrowLeft aria-hidden className="h-4 w-4" />{labels.backTests}</Link>{!teacher && viewed && readOnly && <div className="flex flex-wrap gap-2">{latestId.current && <button type="button" disabled={busy} onClick={() => selectAttempt(latestId.current!)} className="min-h-10 rounded-xl border border-line bg-surface px-4 text-xs font-bold text-accent">{labels.currentAttempt}</button>}<button type="button" disabled={busy} onClick={retry} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-line bg-surface px-4 text-xs font-bold text-accent disabled:opacity-50"><RotateCcw aria-hidden className="h-4 w-4" />{labels.retry}</button></div>}</div>
    <header className="relative overflow-hidden rounded-3xl border border-line bg-gradient-to-br from-accent-soft via-surface to-surface p-6 sm:p-8"><ClipboardCheck aria-hidden className="pointer-events-none absolute -right-1 -top-3 h-36 w-36 text-accent opacity-5" /><p className="relative text-[11px] font-bold uppercase tracking-wider text-accent">{labels.tests} · {initial.definition.level.toUpperCase()}</p><h1 className="relative mt-2 text-2xl font-black text-content sm:text-3xl">{initial.definition.title}</h1><p className="relative mt-2 text-sm text-muted">{teacher ? `${labels.results} · ${initial.studentName}` : initial.definition.subtitle}</p></header>
    <TestDeadlineBadge dueAt={dueAt} locale={locale} completed={completed} />
    {teacher && <section className="rounded-2xl border border-line bg-surface p-4"><TestAssignmentControls assignmentId={initial.id} onRestarted={restarted} dueAt={dueAt} completed={completed} onDeadlineSaved={setDueAt} /></section>}
    <TestRunner key={runKey} test={initial.definition} assignmentId={initial.id} exerciseIds={initial.exerciseIds} initialAttempt={viewed} readOnly={readOnly} onSaved={saved} onRetry={retry} onStale={() => { void pull(); }} externalBusy={busy} />
    <section className="rounded-3xl border border-line bg-surface p-5 sm:p-6"><h2 className="mb-4 flex items-center gap-2 text-base font-bold text-content"><History aria-hidden className="h-5 w-5 text-accent" />{labels.history}</h2>
      {!attempts.length ? <p className="text-sm text-muted">{labels.emptyHistory}</p> : <div className="flex flex-col gap-2">{attempts.map((attempt) => <button key={attempt.id} type="button" disabled={busy} onClick={() => selectAttempt(attempt.id)} aria-pressed={viewed?.id === attempt.id} className={cn("flex min-h-12 flex-wrap items-center justify-between gap-2 rounded-xl border px-3 py-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-60", viewed?.id === attempt.id ? "border-accent/30 bg-accent-soft" : "border-line bg-surface-2 hover:border-accent/30")}><span className="text-xs font-semibold text-muted">{new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", second: "2-digit", timeZone: "Europe/Simferopol" }).format(new Date(attempt.createdAt))} · {attempt.completedAt ? labels.done : attempt.total ? labels.inProgress : labels.notStarted}{attempt.id === latestId.current && ` · ${labels.currentAttempt}`}</span><span className="text-sm font-black text-content">{attempt.total ? `${attempt.correct}/${attempt.total} · ${attempt.percent}%` : "—"}</span></button>)}</div>}
      {hasMore && <button type="button" disabled={busy} onClick={() => startAction(async () => {
        try { const older = await testAttemptHistoryAction(initial.id, attempts.at(-1)?.id); setAttempts((current) => [...current, ...older.filter((row) => !current.some((item) => item.id === row.id))]); setHasMore(older.length === 50); }
        catch { setError(true); }
      })} className="mt-4 min-h-10 rounded-xl border border-line px-4 text-xs font-bold text-accent disabled:opacity-50">{busy ? labels.loading : labels.loadMore}</button>}
      {error && <p role="alert" className="mt-3 text-sm text-[var(--t-rose)]">{labels.error}</p>}
    </section>
  </div>;
}
