import { Check, CircleAlert, Sparkles, X } from "lucide-react";
import type { CSSProperties } from "react";
import type { Locale } from "@/lib/i18n";
import type { TestLabels } from "@/lib/tests/labels";
import { testAnswerText, type TestExercise, type TestExerciseResult } from "@/lib/tests/types";
import { TestPassage } from "./test-passage";

export function testTone(percent: number): CSSProperties {
  return { "--test-tone": `var(--t-${percent >= 80 ? "green" : percent >= 50 ? "amber" : "rose"})` } as CSSProperties;
}

export function TestScore({ percent, correct, total, title, labels }: {
  percent: number; correct: number; total: number; title: string; labels: TestLabels;
}) {
  return <section data-test-score={percent} role="status" style={testTone(percent)} className="relative overflow-hidden rounded-3xl border border-[var(--test-tone)] bg-[color-mix(in_srgb,var(--test-tone)_10%,var(--surface))] p-6 sm:p-8">
    <Sparkles aria-hidden className="pointer-events-none absolute -right-2 -top-4 h-32 w-32 text-[var(--test-tone)] opacity-10" />
    <div className="relative flex flex-wrap items-center justify-between gap-4">
      <div><p className="text-sm font-bold text-content">{title}</p><p className="mt-2 text-sm text-muted">{labels.correctAnswers}: <strong className="text-content">{correct}/{total}</strong></p></div>
      <p className="text-5xl font-black tracking-tight text-[var(--test-tone)] sm:text-6xl">{percent}%</p>
    </div>
  </section>;
}

/** One sentence per row, followed by the precise reason only when it is wrong. */
export function TestExerciseReview({ exercise, result, locale, labels }: {
  exercise: TestExercise; result: TestExerciseResult; locale: Locale; labels: TestLabels;
}) {
  return <div data-test-review className="flex flex-col gap-4">
    {exercise.passage && <TestPassage exercise={exercise} renderGap={(question) => {
      const row = result.questions.find((item) => item.id === question.id);
      return <strong data-test-passage-answer={question.id} style={testTone(row?.correct ? 100 : 0)} className="mx-1 inline-block rounded-lg border border-[var(--test-tone)] bg-[color-mix(in_srgb,var(--test-tone)_10%,var(--surface))] px-2 py-0.5 text-[var(--test-tone)]">{testAnswerText(row?.selected ?? null, labels.noAnswer)}</strong>;
    }} />}
    <h3 className="text-base font-bold text-content">{labels.errors}</h3>
    {result.correct === result.total && <p className="rounded-2xl bg-accent-soft px-4 py-3 text-sm font-bold text-accent">{labels.noErrors}</p>}
    {exercise.questions.map((question, index) => {
      const row = result.questions.find((item) => item.id === question.id);
      if (!row) return null;
      // Older attempts retain the removed notice in their saved explanation.
      const explanation = row.selected === null ? row.explanation[locale].replace(/^(?:No answer was selected\. This counts as an error\.|Ответ не выбран\. Это считается ошибкой\.|Відповідь не вибрано\. Це вважається помилкою\.)\s*/, "") : row.explanation[locale];
      return <article key={row.id} data-test-question-result={row.correct ? "correct" : row.selected ? "incorrect" : "no-answer"} style={testTone(row.correct ? 100 : 0)} className="rounded-2xl border border-line bg-surface p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-surface-2 text-xs font-black text-muted">{index + 1}</span>
          <p className="min-w-0 flex-1 pt-0.5 text-sm leading-loose text-content sm:text-base">{question.before}<strong className="mx-1 inline-block rounded-lg border border-[var(--test-tone)] bg-[color-mix(in_srgb,var(--test-tone)_10%,var(--surface))] px-2 py-0.5 text-[var(--test-tone)]">{testAnswerText(row.selected, labels.noAnswer)}</strong>{question.after}</p>
          {row.correct ? <Check aria-label={labels.correctAnswer} className="mt-1 h-5 w-5 shrink-0 text-[var(--test-tone)]" /> : <X aria-label={labels.errors} className="mt-1 h-5 w-5 shrink-0 text-[var(--test-tone)]" />}
        </div>
        {!row.correct && <div className="mt-3 rounded-xl border border-line bg-surface-2 p-3 sm:ml-11 sm:p-4">
          <p className="text-sm font-bold text-[var(--t-green)]">{labels.correctAnswer}: {testAnswerText(row.answer)}</p>
          <p className="mt-2 flex items-start gap-2 text-sm leading-relaxed text-muted"><CircleAlert aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-accent" /><span>{explanation}</span></p>
        </div>}
      </article>;
    })}
  </div>;
}
