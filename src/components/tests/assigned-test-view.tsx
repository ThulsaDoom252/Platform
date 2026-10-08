"use client";

import Link from "next/link";
import { useRef, useState, useTransition } from "react";
import { ArrowLeft, ClipboardCheck, History, RotateCcw } from "lucide-react";
import { useT } from "@/components/i18n-provider";
import { assignedTestDetailAction, testAttemptDetailAction, testAttemptHistoryAction } from "@/lib/actions/tests";
import { TEST_LABELS } from "@/lib/tests/labels";
import type { TestAssignmentDetail, TestAttempt } from "@/lib/tests/types";
import { useRealtimeSubscription } from "@/lib/use-realtime";
import { cn } from "@/lib/utils";
import { TestRunner } from "./test-runner";

export function AssignedTestView({ initial, teacher, userId }: { initial: TestAssignmentDetail; teacher?: boolean; userId: string }) {
  const { locale } = useT();
  const labels = TEST_LABELS[locale];
  const [attempts, setAttempts] = useState(initial.attempts);
  const [viewed, setViewed] = useState<TestAttempt | null>(initial.latestAttempt);
  const [readOnly, setReadOnly] = useState(!!teacher);
  const [runKey, setRunKey] = useState(0);
  const [error, setError] = useState(false);
  const [busy, startAction] = useTransition();
  const [hasMore, setHasMore] = useState(initial.attempts.length === 50);
  const cache = useRef(new Map(initial.latestAttempt ? [[initial.latestAttempt.id, initial.latestAttempt]] : []));
  const liveBusy = useRef(false);

  function selectAttempt(id: string) {
    if (busy) return;
    startAction(async () => {
      setError(false);
      try {
        const attempt = cache.current.get(id) ?? await testAttemptDetailAction(initial.id, id);
        if (!attempt) { setError(true); return; }
        cache.current.set(id, attempt); setViewed(attempt); setReadOnly(true); setRunKey((key) => key + 1);
      } catch { setError(true); }
    });
  }
  function saved(attempt: TestAttempt) {
    cache.current.set(attempt.id, attempt); setViewed(attempt);
    setAttempts((current) => [attempt, ...current.filter((row) => row.id !== attempt.id)]);
  }
  function retry() { setViewed(null); setReadOnly(false); setRunKey((key) => key + 1); }

  // Teacher results follow only this assignment's events, with a reconnect backup.
  async function pull() {
    if (!teacher || liveBusy.current) return;
    liveBusy.current = true;
    try {
      const current = await assignedTestDetailAction(initial.id);
      if (!current) return;
      setAttempts(current.attempts); setHasMore(current.attempts.length === 50);
      if (current.latestAttempt) {
        const previous = cache.current.get(current.latestAttempt.id);
        cache.current.set(current.latestAttempt.id, current.latestAttempt);
        if (!previous || previous.total !== current.latestAttempt.total) {
          setViewed(current.latestAttempt); setRunKey((key) => key + 1);
        }
      }
    } finally { liveBusy.current = false; }
  }
  useRealtimeSubscription({ channel: `user:${userId}`, events: "homework-review", enabled: !!teacher,
    onMessage: (message) => { if (message.data?.kind === "TEST" && message.data?.id === initial.id) return pull(); },
    onFallback: pull, fallbackMs: 30_000 });

  return <div className="mx-auto flex w-full max-w-5xl flex-col gap-5">
    <div className="flex flex-wrap items-center justify-between gap-3"><Link href={teacher ? `/teacher/homeworks?student=${encodeURIComponent(initial.studentId)}` : "/student/homework"} className="inline-flex min-h-10 items-center gap-2 rounded-xl px-2 text-xs font-bold text-muted hover:bg-surface-2 hover:text-accent"><ArrowLeft aria-hidden className="h-4 w-4" />{labels.back}</Link>{!teacher && viewed && readOnly && <button type="button" disabled={busy} onClick={retry} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-line bg-surface px-4 text-xs font-bold text-accent disabled:opacity-50"><RotateCcw aria-hidden className="h-4 w-4" />{labels.retry}</button>}</div>
    <header className="relative overflow-hidden rounded-3xl border border-line bg-gradient-to-br from-accent-soft via-surface to-surface p-6 sm:p-8"><ClipboardCheck aria-hidden className="pointer-events-none absolute -right-1 -top-3 h-36 w-36 text-accent opacity-5" /><p className="relative text-[11px] font-bold uppercase tracking-wider text-accent">{labels.tests} · {initial.definition.level.toUpperCase()}</p><h1 className="relative mt-2 text-2xl font-black text-content sm:text-3xl">{initial.definition.title}</h1><p className="relative mt-2 text-sm text-muted">{teacher ? `${labels.results} · ${initial.studentName}` : initial.definition.subtitle}</p></header>
    <TestRunner key={runKey} test={initial.definition} assignmentId={initial.id} exerciseIds={initial.exerciseIds} initialAttempt={viewed} readOnly={readOnly} onSaved={saved} onRetry={retry} />
    <section className="rounded-3xl border border-line bg-surface p-5 sm:p-6"><h2 className="mb-4 flex items-center gap-2 text-base font-bold text-content"><History aria-hidden className="h-5 w-5 text-accent" />{labels.history}</h2>
      {!attempts.length ? <p className="text-sm text-muted">{labels.emptyHistory}</p> : <div className="flex flex-col gap-2">{attempts.map((attempt) => <button key={attempt.id} type="button" disabled={busy} onClick={() => selectAttempt(attempt.id)} aria-pressed={viewed?.id === attempt.id} className={cn("flex min-h-12 flex-wrap items-center justify-between gap-2 rounded-xl border px-3 py-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-60", viewed?.id === attempt.id ? "border-accent/30 bg-accent-soft" : "border-line bg-surface-2 hover:border-accent/30")}><span className="text-xs font-semibold text-muted">{new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", second: "2-digit", timeZone: "Europe/Simferopol" }).format(new Date(attempt.createdAt))} · {attempt.completedAt ? labels.done : labels.inProgress}</span><span className="text-sm font-black text-content">{attempt.correct}/{attempt.total} · {attempt.percent}%</span></button>)}</div>}
      {hasMore && <button type="button" disabled={busy} onClick={() => startAction(async () => {
        try { const older = await testAttemptHistoryAction(initial.id, attempts.at(-1)?.id); setAttempts((current) => [...current, ...older.filter((row) => !current.some((item) => item.id === row.id))]); setHasMore(older.length === 50); }
        catch { setError(true); }
      })} className="mt-4 min-h-10 rounded-xl border border-line px-4 text-xs font-bold text-accent disabled:opacity-50">{busy ? labels.loading : labels.loadMore}</button>}
      {error && <p role="alert" className="mt-3 text-sm text-[var(--t-rose)]">{labels.error}</p>}
    </section>
  </div>;
}
