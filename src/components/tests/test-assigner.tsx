"use client";

import Link from "next/link";
import { useRef, useState, useTransition } from "react";
import { UserPlus } from "lucide-react";
import { useT } from "@/components/i18n-provider";
import { assignTestAction, testStudentsAction } from "@/lib/actions/tests";
import { TEST_LABELS } from "@/lib/tests/labels";
import { readyTestExercises, type TestDefinition } from "@/lib/tests/types";

export function TestAssigner({ test }: { test: TestDefinition }) {
  const { locale } = useT();
  const labels = TEST_LABELS[locale];
  const [students, setStudents] = useState<{ id: string; name: string }[] | null>(null);
  const [studentId, setStudentId] = useState("");
  const [whole, setWhole] = useState(true);
  const [chosen, setChosen] = useState(readyTestExercises(test).map((exercise) => exercise.id));
  const [message, setMessage] = useState<string | null>(null);
  const [success, setSuccess] = useState<{ id: string; fingerprint: string } | null>(null);
  const [busy, startAction] = useTransition();
  const request = useRef<{ id: string; fingerprint: string } | null>(null);
  const fingerprint = JSON.stringify({ studentId, exerciseIds: whole ? null : chosen });
  const assigned = success?.fingerprint === fingerprint ? success : null;

  function loadStudents() {
    if (students !== null || busy) return;
    startAction(async () => {
      try { setStudents(await testStudentsAction()); setMessage(null); }
      catch { setMessage(labels.error); }
    });
  }
  function assign() {
    if (busy || assigned) return;
    if (!studentId || !whole && !chosen.length) { setMessage(labels.invalid); return; }
    if (!request.current || request.current.fingerprint !== fingerprint) request.current = { id: crypto.randomUUID(), fingerprint };
    const requestId = request.current.id;
    startAction(async () => {
      setMessage(null);
      try {
        const response = await assignTestAction({ testId: test.id, studentId, exerciseIds: whole ? null : chosen, requestId });
        if (!response.ok) { setMessage(response.error === "invalid" ? labels.invalid : response.error === "forbidden" ? labels.forbidden : labels.error); return; }
        setSuccess({ id: response.value.id, fingerprint });
      } catch { setMessage(labels.error); }
    });
  }

  return <details onToggle={(event) => { if (event.currentTarget.open) loadStudents(); }} className="rounded-2xl border border-line bg-surface">
    <summary className="flex min-h-12 cursor-pointer list-none items-center gap-2 rounded-2xl bg-accent-soft px-4 py-3 text-sm font-bold text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"><UserPlus aria-hidden className="h-4 w-4" />{labels.assign}</summary>
    <form onSubmit={(event) => { event.preventDefault(); assign(); }} className="flex flex-col gap-4 p-4 sm:p-5">
      <label className="flex flex-col gap-2 text-xs font-bold text-muted">{labels.student}<select disabled={busy || students === null} value={studentId} onChange={(event) => { setStudentId(event.target.value); setMessage(null); }} className="min-h-11 rounded-xl border border-line bg-surface-2 px-3 text-sm text-content outline-none focus:ring-2 focus:ring-accent"><option value="">{busy && students === null ? labels.loading : labels.chooseStudent}</option>{students?.map((student) => <option key={student.id} value={student.id}>{student.name}</option>)}</select></label>
      {students?.length === 0 && <p className="text-sm text-muted">{labels.noStudents}</p>}
      {students === null && !busy && message && <button type="button" onClick={loadStudents} className="text-left text-sm font-bold text-accent">{labels.retry}</button>}
      <fieldset disabled={busy} className="flex flex-col gap-3"><legend className="sr-only">{labels.exercises}</legend>
        <div className="flex flex-wrap gap-4">{[true, false].map((value) => <label key={String(value)} className="flex cursor-pointer items-center gap-2 text-sm font-bold text-content"><input type="radio" name={`test-scope-${test.id}`} checked={whole === value} onChange={() => { setWhole(value); setMessage(null); }} className="h-4 w-4 accent-[var(--accent)]" />{value ? labels.all : labels.selected}</label>)}</div>
        {!whole && <div className="flex flex-wrap gap-2">{test.exercises.map((exercise) => <label key={exercise.id} className="flex cursor-pointer items-center gap-2 rounded-xl border border-line bg-surface-2 px-3 py-2 text-xs font-bold text-content has-disabled:cursor-default has-disabled:opacity-40"><input type="checkbox" disabled={!exercise.questions.length} checked={chosen.includes(exercise.id)} onChange={(event) => { setChosen((current) => event.target.checked ? [...current, exercise.id] : current.filter((id) => id !== exercise.id)); setMessage(null); }} className="h-4 w-4 accent-[var(--accent)]" />{labels.exercise} {exercise.number}</label>)}</div>}
        <p className="text-xs leading-relaxed text-muted">{labels.available}</p>
      </fieldset>
      {message && <p role="alert" className="text-sm text-[var(--t-rose)]">{message}</p>}
      {assigned && <p role="status" className="rounded-xl bg-accent-soft p-3 text-sm text-accent">{labels.assigned} <Link href={`/teacher/homeworks/tests/${assigned.id}`} className="font-bold underline">{labels.review} →</Link></p>}
      <button type="submit" disabled={busy || !studentId || !whole && !chosen.length || !!assigned} className="ml-auto min-h-11 rounded-xl bg-accent px-5 py-2 text-sm font-bold text-white transition hover:brightness-95 disabled:opacity-50">{busy ? labels.assigning : labels.assign}</button>
    </form>
  </details>;
}
