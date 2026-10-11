import Image from "next/image";
import type { TestExercise } from "@/lib/tests/types";

export function TestExerciseContext({ exercise }: { exercise: TestExercise }) {
  if (!exercise.context && !exercise.images?.length) return null;
  return <div data-test-exercise-context className="mb-4 flex flex-col gap-4">
    {exercise.context && <p className="whitespace-pre-line rounded-2xl border border-line bg-surface-2 p-4 text-sm leading-relaxed text-content">{exercise.context}</p>}
    {exercise.images?.map(image => <Image key={image.src} src={image.src} alt={image.alt} width={image.width} height={image.height} unoptimized className="h-auto max-w-full self-start rounded-xl bg-white" />)}
  </div>;
}
