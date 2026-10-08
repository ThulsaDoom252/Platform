"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { CheckCheck, ChevronLeft, ChevronRight, Clock3, RotateCcw } from "lucide-react";
import { useT } from "@/components/i18n-provider";
import { checkAssignedTestAction, checkPracticeTestAction } from "@/lib/actions/tests";
import { TEST_LABELS } from "@/lib/tests/labels";
import { readyTestExercises, testResultsScore, type TestAnswers, type TestAttempt, type TestDefinition, type TestResults } from "@/lib/tests/types";
import { cn } from "@/lib/utils";
import { TestExerciseReview, TestScore } from "./test-result-view";
import { TestExerciseQuestions } from "./test-exercise-form";

export function TestRunner({ test, assignmentId, exerciseIds, initialAttempt, readOnly = false, onSaved, onRetry }: {
  test: TestDefinition; assignmentId?: string; exerciseIds?: string[]; initialAttempt?: TestAttempt | null;
  readOnly?: boolean; onSaved?: (attempt: TestAttempt) => void; onRetry?: () => void;
}) {
  const { locale } = useT();
  const labels = TEST_LABELS[locale];
  const selected = exerciseIds ?? readyTestExercises(test).map((exercise) => exercise.id);
  const visible = assignmentId ? test.exercises.filter((exercise) => selected.includes(exercise.id)) : test.exercises;
  const [activeId, setActiveId] = useState(visible[0]?.id ?? "");
  const [answers, setAnswers] = useState<Record<string, TestAnswers>>({});
  const [results, setResults] = useState<TestResults>(initialAttempt?.results ?? {});
  const [error, setError] = useState<string | null>(null);
  const [busy, startCheck] = useTransition();
  const attemptId = useRef<string | null>(initialAttempt?.id ?? null);
  const resultRef = useRef<HTMLDivElement>(null);
  const focusResult = useRef(false);
  const active = visible.find((exercise) => exercise.id === activeId) ?? visible[0];
  const result = active && results[active.id];
  const score = testResultsScore(results, selected);
  const activeIndex = visible.findIndex((exercise) => exercise.id === active?.id);

  useEffect(() => {
    if (!focusResult.current) return;
    focusResult.current = false;
    resultRef.current?.focus({ preventScroll: true });
    resultRef.current?.scrollIntoView({ block: "start", behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" });
  }, [results]);

  function check() {
    if (busy || !active?.questions.length || result || readOnly) return;
    const exerciseId = active.id;
    // Reuse this id even after a timeout: retry cannot duplicate a saved attempt.
    attemptId.current ??= crypto.randomUUID();
    startCheck(async () => {
      setError(null);
      try {
        if (assignmentId) {
          const response = await checkAssignedTestAction({ assignmentId, attemptId: attemptId.current!, exerciseId, answers: answers[exerciseId] ?? {} });
          if (!response.ok) { setError(response.error === "forbidden" ? labels.forbidden : labels.error); return; }
          setResults(response.value.results);
          onSaved?.(response.value);
        } else {
          const response = await checkPracticeTestAction(test.id, { exerciseId, answers: answers[exerciseId] ?? {} });
          if (!response.ok) { setError(response.error === "forbidden" ? labels.forbidden : labels.error); return; }
          setResults((current) => ({ ...current, [exerciseId]: response.value }));
        }
        focusResult.current = true;
      } catch { setError(labels.error); }
    });
  }

  function retry() {
    if (onRetry) { onRetry(); return; }
    attemptId.current = null; setAnswers({}); setResults({}); setError(null); setActiveId(visible[0]?.id ?? "");
  }

  return <div className="flex min-w-0 flex-col gap-5" aria-busy={busy}>
    <nav aria-label={labels.exercises} className="flex flex-wrap items-center gap-2 rounded-2xl border border-line bg-surface p-2">
      {visible.map((exercise) => <button key={exercise.id} type="button" aria-pressed={activeId === exercise.id} aria-controls={`test-panel-${test.id}`} disabled={busy} onClick={() => { setActiveId(exercise.id); setError(null); }} className={cn("inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl px-3 py-2 text-xs font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-60 sm:flex-none sm:px-5", activeId === exercise.id ? "bg-accent text-white shadow-sm" : "text-muted hover:bg-surface-2 hover:text-content")}>
        {labels.exercise} {exercise.number}{results[exercise.id] ? <CheckCheck aria-hidden className="h-4 w-4" /> : !exercise.questions.length ? <Clock3 aria-hidden className="h-3.5 w-3.5 opacity-60" /> : null}
      </button>)}
    </nav>

    {score.total > 0 && <div ref={resultRef} tabIndex={-1} className="flex scroll-mt-24 flex-col gap-2 outline-none">
      <TestScore percent={score.percent} correct={score.correct} total={score.total} title={score.complete ? labels.completed : labels.overall} labels={labels} />
      <p className="px-1 text-xs text-muted">{labels.checked}: {score.checkedExerciseIds.length}/{selected.length}{!score.complete && ` · ${labels.unfinished}`}{assignmentId && ` · ${labels.saved}`}</p>
    </div>}

    {active && <section id={`test-panel-${test.id}`} aria-label={`${labels.exercise} ${active.number}`} className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3"><h2 className="text-lg font-bold text-content">{labels.exercise} {active.number}</h2>{active.questions.length > 0 && <span className="rounded-full bg-accent-soft px-3 py-1 text-[11px] font-bold text-accent">{active.questions.length} {labels.questions}</span>}</div>
      {!active.questions.length ? <div className="rounded-3xl border border-dashed border-line bg-surface p-8 text-center"><Clock3 aria-hidden className="mx-auto h-9 w-9 text-accent" /><p className="mt-3 font-bold text-content">{labels.pending}</p><p className="mt-2 text-sm text-muted">{labels.pendingHint}</p></div> : result ? <div className="flex flex-col gap-4">
        {selected.length > 1 && <TestScore percent={result.percent} correct={result.correct} total={result.total} title={labels.exerciseCompleted} labels={labels} />}
        <TestExerciseReview exercise={active} result={result} locale={locale} labels={labels} />
      </div> : readOnly ? <p className="rounded-2xl border border-line bg-surface p-6 text-sm text-muted">{labels.notStarted}</p> : <>
        <p className="rounded-2xl border border-line bg-accent-soft px-4 py-3 text-sm leading-relaxed text-content">{active.instruction}</p>
        <form onSubmit={(event) => { event.preventDefault(); check(); }} className="flex flex-col gap-3">
          <TestExerciseQuestions testId={test.id} exercise={active} answers={answers[active.id] ?? {}} busy={busy} labels={labels} onAnswer={(questionId, value) => setAnswers((current) => ({ ...current, [active.id]: { ...current[active.id], [questionId]: value } }))} />
          {error && <p role="alert" className="rounded-xl border border-[var(--t-rose)] bg-surface px-4 py-3 text-sm text-[var(--t-rose)]">{error}</p>}
          <div className="mt-2 flex justify-end"><button type="submit" disabled={busy} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-accent px-6 py-3 text-sm font-bold text-white shadow-lg shadow-accent/15 transition hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface disabled:opacity-60"><CheckCheck aria-hidden className="h-5 w-5" />{busy ? labels.checking : labels.check}</button></div>
        </form>
      </>}
    </section>}

    <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line pt-4">
      <div className="flex gap-2"><button type="button" disabled={busy || activeIndex <= 0} onClick={() => setActiveId(visible[activeIndex - 1].id)} aria-label={`${labels.exercise} ${visible[activeIndex - 1]?.number ?? ""}`} className="rounded-xl border border-line bg-surface p-2.5 text-muted transition hover:text-accent disabled:opacity-30"><ChevronLeft aria-hidden className="h-4 w-4" /></button><button type="button" disabled={busy || activeIndex >= visible.length - 1} onClick={() => setActiveId(visible[activeIndex + 1].id)} aria-label={`${labels.exercise} ${visible[activeIndex + 1]?.number ?? ""}`} className="rounded-xl border border-line bg-surface p-2.5 text-muted transition hover:text-accent disabled:opacity-30"><ChevronRight aria-hidden className="h-4 w-4" /></button></div>
      {!readOnly && score.total > 0 && <button type="button" disabled={busy} onClick={retry} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-line bg-surface px-4 py-2 text-xs font-bold text-muted transition hover:border-accent hover:text-accent disabled:opacity-50"><RotateCcw aria-hidden className="h-4 w-4" />{labels.retry}</button>}
    </div>
  </div>;
}
