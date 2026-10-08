import type { ReactNode } from "react";
import type { TestExercise, TestQuestion } from "@/lib/tests/types";

/** Render structured text only: imported HTML and scripts are never executed. */
export function TestPassage({ exercise, renderGap }: {
  exercise: TestExercise; renderGap: (question: TestQuestion, number: number) => ReactNode;
}) {
  const questions = new Map(exercise.questions.map((question, index) => [question.id, { question, number: index + 1 }]));
  return <article data-test-passage className="flex flex-col gap-5 rounded-3xl border border-line bg-surface p-5 text-sm leading-[3] text-content shadow-sm sm:p-7 sm:text-base">
    {exercise.passage?.map((paragraph, index) => <p key={index} className="whitespace-pre-line">{paragraph.map((part, partIndex) => {
      if ("text" in part) return <span key={partIndex}>{part.text}</span>;
      const gap = questions.get(part.questionId);
      return gap ? <span key={part.questionId} className="inline-block max-w-full"><sup aria-hidden className="mr-1 rounded bg-accent-soft px-1.5 py-0.5 text-[10px] font-black text-accent">{gap.number}</sup>{renderGap(gap.question, gap.number)}</span> : null;
    })}</p>)}
  </article>;
}
