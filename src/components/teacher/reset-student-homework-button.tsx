"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { IconReset, IconX } from "@/components/icons";
import { resetStudentHomeworkAssignmentAction } from "@/lib/actions/lesson-homework";
import { resetWordDeckHomeworkAction } from "@/lib/actions/word-deck";
import { resetRevisionHomeworkAction } from "@/lib/actions/revision";

export type ResetHomeworkKind = "LESSON" | "ACTIVITY" | "REVISION";

export function ResetStudentHomeworkButton({
  assignmentId,
  kind = "LESSON",
  labels,
  showLabel = false,
}: {
  assignmentId: string;
  kind?: ResetHomeworkKind;
  labels: {
    resetHomework: string;
    resetHomeworkConfirm: string;
    resettingHomework: string;
    resetHomeworkError: string;
    cancelReset: string;
  };
  showLabel?: boolean;
}) {
  const router = useRouter();
  const [armed, setArmed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, startReset] = useTransition();

  const reset = () => {
    setError(null);
    startReset(async () => {
      const result = kind === "ACTIVITY"
        ? await resetWordDeckHomeworkAction(assignmentId)
        : kind === "REVISION"
          ? await resetRevisionHomeworkAction(assignmentId)
          : await resetStudentHomeworkAssignmentAction(assignmentId);
      if (result.error) {
        setError(result.error || labels.resetHomeworkError);
        return;
      }
      setArmed(false);
      router.refresh();
    });
  };

  if (!armed) {
    return (
      <button
        type="button"
        onClick={() => setArmed(true)}
        title={labels.resetHomework}
        aria-label={labels.resetHomework}
        className={`flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-xl bg-amber-50 text-amber-700 shadow-sm ring-1 ring-amber-200 transition hover:bg-amber-500 hover:text-white dark:bg-amber-950/45 dark:text-amber-300 dark:ring-amber-900 ${showLabel ? "px-3 text-xs font-black" : "w-9"}`}
      >
        <IconReset className="h-4 w-4" />
        {showLabel && <span>{labels.resetHomework}</span>}
      </button>
    );
  }

  return (
    <div className="max-w-[min(30rem,calc(100vw-2rem))] rounded-xl bg-surface p-2 shadow-xl ring-1 ring-amber-300 dark:ring-amber-900">
      <div className="flex items-center gap-2">
        <p className="hidden max-w-64 text-[11px] font-bold leading-tight text-content md:block">
          {labels.resetHomeworkConfirm}
        </p>
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            setArmed(false);
            setError(null);
          }}
          title={labels.cancelReset}
          aria-label={labels.cancelReset}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted transition hover:bg-surface-2 hover:text-content disabled:opacity-50"
        >
          <IconX className="h-4 w-4" />
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={reset}
          className="flex h-8 shrink-0 items-center gap-1.5 rounded-lg bg-amber-500 px-3 text-[11px] font-black text-white transition hover:bg-amber-600 disabled:opacity-60"
        >
          <IconReset className="h-3.5 w-3.5" />
          {busy ? labels.resettingHomework : labels.resetHomework}
        </button>
      </div>
      {error && <p className="mt-1.5 text-[10px] font-bold text-rose-500">{error}</p>}
    </div>
  );
}
