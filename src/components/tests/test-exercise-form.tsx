import type { TestAnswers, TestExercise } from "@/lib/tests/types";

export function TestExerciseQuestions({ testId, exercise, answers, busy, onAnswer }: {
  testId: string; exercise: TestExercise; answers: TestAnswers; busy: boolean;
  onAnswer: (questionId: string, value: string | null) => void;
}) {
  return <>{exercise.questions.map((question, index) => <div key={question.id} data-test-question={question.id} className="flex items-start gap-3 rounded-2xl border border-line bg-surface p-4 sm:gap-4 sm:p-5">
    <span aria-hidden className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-xs font-black text-accent">{index + 1}</span>
    <label className="min-w-0 flex-1 text-sm leading-[2.8] text-content sm:text-base" htmlFor={`test-${testId}-${exercise.id}-${question.id}`}>
      {question.before}<select id={`test-${testId}-${exercise.id}-${question.id}`} aria-label={`${index + 1}. ${question.before}…${question.after}`} disabled={busy} value={answers[question.id] ?? ""} onChange={(event) => onAnswer(question.id, event.target.value || null)} className="mx-1 inline-block min-w-28 max-w-full cursor-pointer rounded-xl border border-accent/30 bg-surface-2 px-3 py-2 align-middle text-sm font-bold text-content outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 disabled:opacity-60">
        <option value="" hidden />{question.options.map((option) => <option key={option} value={option}>{option}</option>)}
      </select>{question.after}
    </label>
  </div>)}</>;
}
