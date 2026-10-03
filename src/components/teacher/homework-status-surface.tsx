"use client";

import type { ReactNode } from "react";
import { IconEye, IconEyeOff } from "@/components/icons";
import type { TeacherHomeworkOverviewState } from "@/lib/teacher-homework-order";
import { useLocalFlag } from "@/lib/use-local-flag";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "teacher-homework-status-backgrounds-hidden";

export function HomeworkBackgroundToggle({
  showLabel,
  hideLabel,
}: {
  showLabel: string;
  hideLabel: string;
}) {
  const [hidden, setHidden] = useLocalFlag(STORAGE_KEY);
  const Icon = hidden ? IconEye : IconEyeOff;

  return (
    <button
      type="button"
      aria-pressed={!hidden}
      onClick={() => setHidden(!hidden)}
      className="ml-auto flex h-8 items-center gap-1.5 rounded-lg px-3 text-[12px] font-semibold text-muted transition hover:bg-surface-2 hover:text-content"
    >
      <Icon className="h-3.5 w-3.5" />
      {hidden ? showLabel : hideLabel}
    </button>
  );
}

export function HomeworkStatusSurface({
  state,
  children,
}: {
  state: TeacherHomeworkOverviewState;
  children: ReactNode;
}) {
  const [hidden] = useLocalFlag(STORAGE_KEY);

  return (
    <article className={cn(
      "overflow-hidden rounded-2xl shadow-sm ring-1 ring-line transition-colors",
      hidden || state === "notStarted"
        ? "bg-surface"
        : state === "inProgress"
          ? "bg-amber-50/95 dark:bg-amber-950/30"
          : state === "submitted"
            ? "bg-emerald-50/95 dark:bg-emerald-950/25"
            : "bg-emerald-200/90 dark:bg-emerald-900/55",
    )}>
      {children}
    </article>
  );
}
