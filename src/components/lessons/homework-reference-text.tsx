import type { HomeworkExercise } from "@/lib/lesson-homework";

/** Plain student-only reading material; never render an imported source as HTML. */
export function HomeworkReferenceText({ exercise }: { exercise: HomeworkExercise }) {
  if (!exercise.referenceText) return null;
  return <details data-homework-reference className="my-4 min-w-0 rounded-xl border border-line bg-surface-2 p-4">
    <summary className="cursor-pointer break-words text-sm font-bold text-content">{exercise.referenceTitle || exercise.title}</summary>
    <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-relaxed text-content">{exercise.referenceText}</p>
  </details>;
}
