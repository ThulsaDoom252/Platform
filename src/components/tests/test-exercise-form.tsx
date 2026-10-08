import type { TestAnswer, TestAnswers, TestExercise, TestQuestion } from "@/lib/tests/types";
import { TestPassage } from "./test-passage";

const fieldClass = "mx-1 inline-block min-w-28 max-w-full cursor-pointer rounded-xl border border-accent/30 bg-surface-2 px-3 py-2 align-middle text-sm font-bold text-content outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 disabled:opacity-60";

export function toggleTestChoice(question: TestQuestion, answer: TestAnswer, option: string): TestAnswer {
  if (!question.options.includes(option)) return answer;
  const selected = Array.isArray(answer) ? answer : [];
  const next = selected.includes(option) ? selected.filter((value) => value !== option) : selected.length < (question.selectionCount ?? 2) ? [...selected, option] : selected;
  return next.length ? next : null;
}

export function TestExerciseQuestions({ testId, exercise, answers, busy, onAnswer }: {
  testId: string; exercise: TestExercise; answers: TestAnswers; busy: boolean;
  onAnswer: (questionId: string, value: TestAnswer) => void;
}) {
  const fieldId = (question: TestQuestion) => `test-${testId}-${exercise.id}-${question.id}`;
  const renderField = (question: TestQuestion, number: number) => question.kind === "text" ?
    <input type="text" id={fieldId(question)} data-test-question={question.id} aria-label={`${number}. ${question.before}…${question.after}`} disabled={busy} maxLength={200} autoComplete="off" autoCapitalize="none" spellCheck={false} value={typeof answers[question.id] === "string" ? answers[question.id] as string : ""} onChange={(event) => onAnswer(question.id, event.target.value || null)} className={`${fieldClass} w-40 cursor-text`} /> :
    <select id={fieldId(question)} aria-label={`${number}. ${question.before}…${question.after}`} disabled={busy} value={typeof answers[question.id] === "string" ? answers[question.id] as string : ""} onChange={(event) => onAnswer(question.id, event.target.value || null)} className={fieldClass}>
      <option value="" hidden />{question.options.map((option) => <option key={option} value={option}>{option}</option>)}
    </select>;
  if (exercise.passage) return <TestPassage exercise={exercise} renderGap={renderField} />;
  return <>{exercise.questions.map((question, index) => <div key={question.id} data-test-question={question.id} className="flex items-start gap-3 rounded-2xl border border-line bg-surface p-4 sm:gap-4 sm:p-5">
    <span aria-hidden className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-xs font-black text-accent">{index + 1}</span>
    {question.kind === "multiple" ? <fieldset className="min-w-0 flex-1">
      <legend className="text-sm leading-loose text-content sm:text-base">{question.before}<span aria-hidden className="mx-1 inline-block w-16 border-b-2 border-accent/50 align-baseline" />{question.after}</legend>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <span className="mr-1 text-[11px] font-bold text-accent">Choose TWO correct options · {(Array.isArray(answers[question.id]) ? (answers[question.id] as string[]).length : 0)}/{question.selectionCount ?? 2}</span>
        {question.options.map((option) => {
          const selected = Array.isArray(answers[question.id]) ? answers[question.id] as string[] : [];
          const checked = selected.includes(option);
          return <label key={option} className={`inline-flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 text-sm font-bold transition ${checked ? "border-accent bg-accent-soft text-accent" : "border-line bg-surface-2 text-content"}`}>
            <input type="checkbox" checked={checked} disabled={busy || !checked && selected.length >= (question.selectionCount ?? 2)} onChange={() => onAnswer(question.id, toggleTestChoice(question, answers[question.id] ?? null, option))} className="h-4 w-4 accent-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-40" />{option}
          </label>;
        })}
      </div>
    </fieldset> : <label className="min-w-0 flex-1 text-sm leading-[2.8] text-content sm:text-base" htmlFor={fieldId(question)}>
      {question.before}{renderField(question, index + 1)}{question.after}
    </label>}
  </div>)}</>;
}
