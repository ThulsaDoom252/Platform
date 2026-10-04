"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { IconTrash, IconX } from "@/components/icons";
import { deleteStudentHomeworkAssignmentAction } from "@/lib/actions/lesson-homework";
import { deleteWordDeckHomeworkAction } from "@/lib/actions/word-deck";

export function DeleteStudentHomeworkButton({
  assignmentId,
  kind = "LESSON",
  labels,
}: {
  assignmentId: string;
  kind?: "LESSON" | "ACTIVITY";
  labels: {
    deleteHomework: string;
    deleteHomeworkConfirm: string;
    deletingHomework: string;
    deleteHomeworkError: string;
    cancelDelete: string;
  };
}) {
  const router = useRouter();
  const [armed, setArmed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, startDelete] = useTransition();

  const remove = () => {
    setError(null);
    startDelete(async () => {
      const result = kind === "ACTIVITY"
        ? await deleteWordDeckHomeworkAction(assignmentId)
        : await deleteStudentHomeworkAssignmentAction(assignmentId);
      if (result.error) {
        setError(result.error || labels.deleteHomeworkError);
        return;
      }
      router.refresh();
    });
  };

  if (!armed) {
    return (
      <button
        type="button"
        onClick={() => setArmed(true)}
        title={labels.deleteHomework}
        aria-label={labels.deleteHomework}
        className="flex h-9 w-9 items-center justify-center rounded-xl bg-rose-50 text-rose-500 shadow-sm ring-1 ring-rose-200 transition hover:bg-rose-500 hover:text-white dark:bg-rose-950/45 dark:ring-rose-900"
      >
        <IconTrash className="h-4 w-4" />
      </button>
    );
  }

  return (
    <div className="max-w-[min(26rem,calc(100vw-2rem))] rounded-xl bg-surface p-2 shadow-xl ring-1 ring-rose-300 dark:ring-rose-900">
      <div className="flex items-center gap-2">
        <p className="hidden max-w-52 text-[11px] font-bold leading-tight text-content md:block">
          {labels.deleteHomeworkConfirm}
        </p>
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            setArmed(false);
            setError(null);
          }}
          title={labels.cancelDelete}
          aria-label={labels.cancelDelete}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted transition hover:bg-surface-2 hover:text-content disabled:opacity-50"
        >
          <IconX className="h-4 w-4" />
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={remove}
          className="flex h-8 shrink-0 items-center gap-1.5 rounded-lg bg-rose-500 px-3 text-[11px] font-black text-white transition hover:bg-rose-600 disabled:opacity-60"
        >
          <IconTrash className="h-3.5 w-3.5" />
          {busy ? labels.deletingHomework : labels.deleteHomework}
        </button>
      </div>
      {error && <p className="mt-1.5 text-[10px] font-bold text-rose-500">{error}</p>}
    </div>
  );
}
